import { expect, test } from '@playwright/test';
import { hash } from 'argon2';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../backend/dist/modules/prisma/prisma.service.js';
import { readEnvironment } from '../../backend/dist/config/environment.js';

const prefix = `settings-${randomUUID()}`;
const adminEmail = `${prefix}-admin@example.test`;
const customerEmail = `${prefix}-customer@example.test`;
const password = 'settings-e2e-only-password-123!';
let db: PrismaService | undefined;
let settingsCreated = false;
let saved: { shippingFeeVnd: number; bankDeadlineMinutes: number; bankName: string | null; bankBin: string | null;
  bankAccountNumber: string | null; bankAccountName: string | null };

function assertTestDatabase() {
  let valid = false;
  try {
    const url = new URL(process.env['DATABASE_URL'] ?? '');
    valid = process.env['NODE_ENV'] === 'test' && ['postgres:', 'postgresql:'].includes(url.protocol)
      && decodeURIComponent(url.pathname).endsWith('_test');
  } catch { /* Do not print credentials. */ }
  if (!valid) throw new Error('Settings E2E requires NODE_ENV=test and a PostgreSQL *_test database');
}

test.beforeAll(async () => {
  assertTestDatabase();
  db = new PrismaService(readEnvironment(process.env));
  const passwordHash = await hash(password);
  await db.user.createMany({ data: [
    { email: adminEmail, name: 'Admin cài đặt thử', role: 'ADMIN', passwordHash, emailVerifiedAt: new Date() },
    { email: customerEmail, name: 'Khách cài đặt thử', role: 'CUSTOMER', passwordHash, emailVerifiedAt: new Date() },
  ] });
  if (!await db.shopSettings.findUnique({ where: { id: 'default' } })) {
    await db.shopSettings.create({ data: { id: 'default', shippingFeeVnd: 45000, bankDeadlineMinutes: 150,
      bankName: 'Ngân hàng thử E2E', bankBin: '970422', bankAccountNumber: '12345678', bankAccountName: 'CONG TY THU' } });
    settingsCreated = true;
  }
  const row = await db.shopSettings.findUniqueOrThrow({ where: { id: 'default' } });
  saved = { shippingFeeVnd: row.shippingFeeVnd, bankDeadlineMinutes: row.bankDeadlineMinutes, bankName: row.bankName,
    bankBin: row.bankBin, bankAccountNumber: row.bankAccountNumber, bankAccountName: row.bankAccountName };
});

test.afterAll(async () => {
  assertTestDatabase();
  if (!db) return;
  // Steps clean independently; leftover counts and step errors must fail the suite instead of leaving
  // a green run with residue. The shared settings row is only removed when this run created it.
  const problems: string[] = [];
  const attempt = (label: string, step: () => Promise<unknown>) =>
    step().catch((error: unknown) => { problems.push(`${label}: ${error instanceof Error ? error.message : String(error)}`); });
  try {
    if (settingsCreated) await attempt('shop settings', () => db!.shopSettings.deleteMany({ where: { id: 'default' } }));
    await attempt('users', async () => {
      const users = await db!.user.findMany({ where: { email: { in: [adminEmail, customerEmail] } }, select: { id: true } });
      for (const user of users) await db!.session.deleteMany({ where: { sess: { path: ['userId'], equals: user.id } } });
      await db!.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
    });
    const leftovers: string[] = [];
    if (settingsCreated && await db.shopSettings.count({ where: { id: 'default' } }) > 0) leftovers.push('shop settings');
    if (await db.user.count({ where: { email: { in: [adminEmail, customerEmail] } } }) > 0) leftovers.push('users');
    if (problems.length || leftovers.length) {
      throw new Error(`Cleanup incomplete (failed steps: ${problems.join('; ') || 'none'}; leftovers: ${leftovers.join(', ') || 'none'})`);
    }
  } finally { await db.$disconnect(); }
});

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
}

test('admin opens settings from the dashboard, reads real values and survives refresh and mobile', async ({ page }, info) => {
  await login(page, adminEmail);
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('link', { name: 'Cài đặt', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await expect(page.getByRole('heading', { name: 'Cài đặt cửa hàng', exact: true })).toBeVisible();
  // Digits only: the currency formatter inserts a non-breaking space before the symbol, so the fee
  // matches as a substring while every other field matches its whole text.
  const feeGroup = new Intl.NumberFormat('vi-VN').format(saved.shippingFeeVnd);
  await expect(page.getByText('Phí giao hàng', { exact: true })).toBeVisible();
  await expect(page.getByText(feeGroup)).toBeVisible();
  await expect(page.getByText(`${saved.bankDeadlineMinutes} phút`, { exact: true })).toBeVisible();
  for (const [label, value] of [['Ngân hàng', saved.bankName], ['Mã BIN', saved.bankBin],
    ['Số tài khoản', saved.bankAccountNumber], ['Tên chủ tài khoản', saved.bankAccountName]] as const) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
    await expect(page.getByText(value ?? 'Chưa cấu hình', { exact: true })).toBeVisible();
  }
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Cài đặt cửa hàng', exact: true })).toBeVisible();
  await expect(page.getByText(feeGroup)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('settings-mobile.png'), fullPage: true });
});

test('backend enforces settings access independently of the frontend redirect', async ({ page }) => {
  await page.goto('/admin/settings');
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get('/api/v1/admin/settings')).status()).toBe(401);
  const publicView: { shippingFeeVnd: number; bankDeadlineMinutes: number } = await (await page.request.get('/api/v1/shop-settings/public')).json();
  expect(Object.keys(publicView).sort()).toEqual(['bankDeadlineMinutes', 'shippingFeeVnd']);
  expect(publicView.shippingFeeVnd).toBe(saved.shippingFeeVnd);
  await login(page, customerEmail);
  await expect(page).toHaveURL(/\/account$/);
  await page.goto('/admin/settings');
  await expect(page).toHaveURL(/\/account$/);
  expect((await page.request.get('/api/v1/admin/settings')).status()).toBe(403);
});

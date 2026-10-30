import { expect, test } from '@playwright/test';
import { hash } from 'argon2';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../backend/dist/modules/prisma/prisma.service.js';
import { readEnvironment } from '../../backend/dist/config/environment.js';

// Runs only through tools/test-e2e.mjs in a fresh run-owned database.

const prefix = `settings-${randomUUID()}`;
const adminEmail = `${prefix}-admin@example.test`;
const customerEmail = `${prefix}-customer@example.test`;
const password = 'settings-e2e-only-password-123!';
let db: PrismaService | undefined;
let settingsCreated = false;
let adminUserId = '';
let current: { shippingFeeVnd: number; bankDeadlineMinutes: number; bankName: string | null; bankBin: string | null;
  bankAccountNumber: string | null; bankAccountName: string | null; version: number };

function assertTestDatabase() {
  let valid = false;
  try {
    const url = new URL(process.env['DATABASE_URL'] ?? '');
    valid = process.env['NODE_ENV'] === 'test' && ['postgres:', 'postgresql:'].includes(url.protocol)
      && decodeURIComponent(url.pathname).slice(1) === process.env['CLOTHING_TEST_DATABASE']
      && /^clothing_e2e_[a-f0-9]{16}_test$/.test(process.env['CLOTHING_TEST_DATABASE'] ?? '');
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
  adminUserId = (await db.user.findUniqueOrThrow({ where: { email: adminEmail } })).id;
  if (await db.shopSettings.findUnique({ where: { id: 'default' } })) {
    throw new Error('Settings fixture is already owned; use a fresh isolated E2E run.');
  }
  await db.shopSettings.create({ data: { id: 'default', shippingFeeVnd: 45000, bankDeadlineMinutes: 150,
    bankName: 'Ngân hàng thử E2E', bankBin: '970422', bankAccountNumber: '12345678', bankAccountName: 'CONG TY THU' } });
  settingsCreated = true;
  const row = await db.shopSettings.findUniqueOrThrow({ where: { id: 'default' } });
  current = { shippingFeeVnd: row.shippingFeeVnd, bankDeadlineMinutes: row.bankDeadlineMinutes, bankName: row.bankName,
    bankBin: row.bankBin, bankAccountNumber: row.bankAccountNumber, bankAccountName: row.bankAccountName, version: row.version };
});

test.afterAll(async () => {
  assertTestDatabase();
  if (!db) return;
  // Steps clean independently; leftover counts and step errors must fail the suite instead of
  // leaving a green run with residue. Only records created by this run are removed.
  const database = db!;
  const problems: string[] = [];
  const attempt = (label: string, step: () => Promise<unknown>) =>
    step().catch((error: unknown) => { problems.push(`${label}: ${error instanceof Error ? error.message : String(error)}`); });
  try {
    if (adminUserId) await attempt('idempotency records', () => database.idempotencyRecord.deleteMany({
      where: { scope: 'settings.update', identity: `admin:${adminUserId}` } }));
    if (settingsCreated) {
      await attempt('shop settings', () => database.shopSettings.deleteMany({ where: { id: 'default' } }));
    }
    await attempt('users', async () => {
      const users = await database.user.findMany({ where: { email: { in: [adminEmail, customerEmail] } }, select: { id: true } });
      for (const user of users) await database.session.deleteMany({ where: { sess: { path: ['userId'], equals: user.id } } });
      await database.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
    });
    const leftovers: string[] = [];
    if (settingsCreated && await database.shopSettings.count({ where: { id: 'default' } }) > 0) leftovers.push('shop settings');
    if (await database.user.count({ where: { email: { in: [adminEmail, customerEmail] } } }) > 0) leftovers.push('users');
    if (problems.length || leftovers.length) {
      throw new Error(`Cleanup incomplete (failed steps: ${problems.join('; ') || 'none'}; leftovers: ${leftovers.join(', ') || 'none'})`);
    }
  } finally { await database.$disconnect(); }
});

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
}

async function openAdminSettings(page: import('@playwright/test').Page) {
  await page.getByRole('link', { name: 'Cài đặt', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await expect(page.getByRole('heading', { name: 'Cài đặt cửa hàng', exact: true })).toBeVisible();
}

test('admin opens settings from the dashboard, saves new values and survives refresh and mobile', async ({ page }, info) => {
  await login(page, adminEmail);
  await expect(page).toHaveURL(/\/admin$/);
  await openAdminSettings(page);
  await expect(page.getByLabel('Phí giao hàng')).toHaveValue(String(current.shippingFeeVnd));
  await expect(page.getByLabel('Hạn chuyển khoản')).toHaveValue(String(current.bankDeadlineMinutes));
  await expect(page.getByText(/báo giá và đơn hàng đã tạo giữ nguyên/)).toContainText(`phiên bản ${current.version}`);
  // A real edit: raise the fee and rename the account holder, then save once.
  await page.getByLabel('Phí giao hàng').fill('51000');
  await page.getByLabel('Tên chủ tài khoản').fill('CONG TY MOI');
  await page.getByRole('button', { name: 'Lưu cài đặt' }).click();
  await expect(page.getByText('Đã lưu cài đặt. Cấu hình mới áp dụng cho các đơn mới.')).toBeVisible();
  current = { ...current, shippingFeeVnd: 51000, bankAccountName: 'CONG TY MOI', version: current.version + 1 };
  // The saved room state survives a reload; the note shows the server-provided version.
  await page.reload();
  await expect(page.getByLabel('Phí giao hàng')).toHaveValue('51000');
  await expect(page.getByLabel('Tên chủ tài khoản')).toHaveValue('CONG TY MOI');
  await expect(page.getByText(/báo giá và đơn hàng đã tạo giữ nguyên/)).toContainText(`phiên bản ${current.version}`);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('settings-mobile.png'), fullPage: true });
});

test('two admin tabs: one save wins, the other conflicts and ends with the fresh configuration', async ({ browser }) => {
  const context = await browser.newContext();
  const winner = await context.newPage();
  await login(winner, adminEmail);
  // A second tab of the same admin shares the session.
  const loser = await context.newPage();
  await loser.goto('/admin/settings');
  await winner.goto('/admin/settings');
  await expect(winner.getByLabel('Phí giao hàng')).toHaveValue(String(current.shippingFeeVnd));
  await expect(loser.getByLabel('Phí giao hàng')).toHaveValue(String(current.shippingFeeVnd));
  // Tab B saves first.
  await loser.getByLabel('Phí giao hàng').fill('60000');
  await loser.getByRole('button', { name: 'Lưu cài đặt' }).click();
  await expect(loser.getByText('Đã lưu cài đặt. Cấu hình mới áp dụng cho các đơn mới.')).toBeVisible();
  current = { ...current, shippingFeeVnd: 60000, version: current.version + 1 };
  // Tab A still holds the older snapshot; its save must conflict and keep the draft.
  await winner.getByLabel('Phí giao hàng').fill('51000');
  await winner.getByRole('button', { name: 'Lưu cài đặt' }).click();
  await expect(winner.getByRole('alert')).toContainText('Cài đặt đã thay đổi');
  await expect(winner.getByLabel('Phí giao hàng')).toHaveValue('51000');
  // Loading the fresh configuration discards the draft only after an explicit confirmation.
  await winner.getByRole('button', { name: 'Tải cấu hình mới' }).click();
  await expect(winner.getByRole('dialog', { name: 'Tải cấu hình mới?' })).toBeVisible();
  await winner.getByRole('button', { name: 'Xoá và tải cấu hình mới' }).click();
  await expect(winner.getByLabel('Phí giao hàng')).toHaveValue('60000');
  await expect(winner.getByLabel('Hạn chuyển khoản')).toHaveValue(String(current.bankDeadlineMinutes));
  await expect(winner.getByRole('alert')).toHaveCount(0);
  await context.close();
});

test('backend enforces settings access independently of the frontend redirect', async ({ page }) => {
  await page.goto('/admin/settings');
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get('/api/v1/admin/settings')).status()).toBe(401);
  const publicView: { shippingFeeVnd: number; bankDeadlineMinutes: number } = await (await page.request.get('/api/v1/shop-settings/public')).json();
  expect(Object.keys(publicView).sort()).toEqual(['bankDeadlineMinutes', 'shippingFeeVnd']);
  expect(publicView.shippingFeeVnd).toBe(current.shippingFeeVnd);
  await login(page, customerEmail);
  await expect(page).toHaveURL(/\/account$/);
  await page.goto('/admin/settings');
  await expect(page).toHaveURL(/\/account$/);
  expect((await page.request.get('/api/v1/admin/settings')).status()).toBe(403);
});

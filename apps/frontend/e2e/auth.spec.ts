import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const identities = new Set<string>();
const password = 'browser-test-password-123!';
const base = 'http://127.0.0.1:5174';

async function linkFor(email: string, page: 'verify-email' | 'reset-password'): Promise<string> {
  for (const filename of await readdir(path.resolve('../../.local/test-mailbox'))) {
    if (!filename.endsWith('.json')) continue;
    const value: unknown = JSON.parse(await readFile(path.resolve('../../.local/test-mailbox', filename), 'utf8'));
    if (!value || typeof value !== 'object' || !('to' in value) || value.to !== email || !('text' in value) || typeof value.text !== 'string') continue;
    const link = value.text.split(/\s/).find((word) => word.startsWith(`${base}/${page}#`));
    if (link) return link;
  }
  throw new Error('Preview email not found for test identity');
}

test.afterAll(async () => {
  if (!process.env['DATABASE_URL'] || !new URL(process.env['DATABASE_URL']).pathname.endsWith('_test')) throw new Error('E2E cleanup requires a *_test database');
  // Node-only test code; backend modules/secrets are never part of the frontend bundle.
  const { PrismaService } = await import('../../backend/dist/prisma/prisma.service.js');
  const { readEnvironment } = await import('../../backend/dist/config/environment.js');
  const db = new PrismaService(readEnvironment(process.env));
  try {
    const users = await db.user.findMany({ where: { email: { in: [...identities] } }, select: { id: true } });
    for (const user of users) await db.session.deleteMany({ where: { sess: { path: ['userId'], equals: user.id } } });
    await db.user.deleteMany({ where: { email: { in: [...identities] } } });
  } finally { await db.$disconnect(); }
});

test('register, verify, login, refresh session, reset and logout through the real proxy', async ({ page }) => {
  const email = `e2e-${randomUUID()}@example.test`;
  identities.add(email);
  await page.goto('/register');
  await page.getByLabel('Họ và tên').fill('Khách trình duyệt');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('hướng dẫn sẽ được gửi');
  await page.goto(await linkFor(email, 'verify-email'));
  await page.getByRole('button', { name: 'Xác minh email', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Email đã được xác minh');
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(`${base}/account`);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tài khoản của bạn' })).toBeVisible();
  await expect(page.getByText('Email đã được xác minh.', { exact: true })).toBeVisible();
  await page.goto('/forgot-password');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Gửi hướng dẫn' }).click();
  await expect(page.getByRole('alert')).toContainText('hướng dẫn sẽ được gửi');
  await page.goto(await linkFor(email, 'reset-password'));
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('new-browser-password-456!');
  await page.getByRole('button', { name: 'Lưu mật khẩu mới' }).click();
  await expect(page.getByRole('alert')).toContainText('Mật khẩu đã được cập nhật');
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('new-browser-password-456!');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(`${base}/account`);
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page).toHaveURL(`${base}/login`);
  await page.goto('/account');
  await expect(page).toHaveURL(`${base}/login`);
});

test('mobile login has labels, keyboard focus and no horizontal overflow', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Chào bạn trở lại' })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Đến nội dung chính' })).toBeFocused();
  await page.screenshot({ path: info.outputPath('auth-mobile.png'), fullPage: true });
});

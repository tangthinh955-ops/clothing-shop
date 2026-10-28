import { expect, test } from '@playwright/test';
import { hash } from 'argon2';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../backend/dist/modules/prisma/prisma.service.js';
import { readEnvironment } from '../../backend/dist/config/environment.js';

const prefix = `categories-${randomUUID()}`;
const adminEmail = `${prefix}-admin@example.test`;
const customerEmail = `${prefix}-customer@example.test`;
const password = 'categories-e2e-only-password-123!';
const slugs = [`${prefix}-active`, `${prefix}-inactive`, `${prefix}-edit`, `${prefix}-occupied`, `${prefix}-renamed`, `${prefix}-conflict`] as const;
let db: PrismaService | undefined;

function assertTestDatabase() {
  let valid = false;
  try {
    const url = new URL(process.env['DATABASE_URL'] ?? '');
    valid = process.env['NODE_ENV'] === 'test'
      && ['postgres:', 'postgresql:'].includes(url.protocol)
      && decodeURIComponent(url.pathname).endsWith('_test');
  } catch { /* Never include credentials in errors. */ }
  if (!valid) throw new Error('Category E2E requires NODE_ENV=test and a PostgreSQL *_test database');
}

test.beforeAll(async () => {
  assertTestDatabase();
  db = new PrismaService(readEnvironment(process.env));
  const passwordHash = await hash(password);
  await db.user.createMany({ data: [
    { email: adminEmail, name: 'Admin danh mục thử', role: 'ADMIN', passwordHash, emailVerifiedAt: new Date() },
    { email: customerEmail, name: 'Khách danh mục thử', role: 'CUSTOMER', passwordHash, emailVerifiedAt: new Date() },
  ] });
});

test.afterAll(async () => {
  assertTestDatabase();
  if (!db) return;
  try {
    await db.category.deleteMany({ where: { slug: { in: slugs } } });
    const users = await db.user.findMany({ where: { email: { in: [adminEmail, customerEmail] } }, select: { id: true } });
    for (const user of users) {
      await db.session.deleteMany({ where: { sess: { path: ['userId'], equals: user.id } } });
      await db.user.delete({ where: { id: user.id } });
    }
  } finally { await db.$disconnect(); }
});

test('admin creates active/inactive categories, survives refresh and handles duplicate slug on mobile', async ({ page }, info) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(adminEmail);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('link', { name: 'Danh mục', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/categories$/);
  await page.getByLabel('Tên danh mục', { exact: true }).fill('Áo thun thử trình duyệt');
  await page.getByLabel('Đường dẫn danh mục', { exact: true }).fill(slugs[0]!);
  await page.getByRole('button', { name: 'Thêm danh mục', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Đã lưu danh mục');
  await expect(page.getByRole('heading', { name: 'Áo thun thử trình duyệt', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Áo thun thử trình duyệt', exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Tên danh mục', { exact: true }).fill('Áo khoác tạm tắt');
  await page.getByLabel('Đường dẫn danh mục', { exact: true }).fill(slugs[0]!);
  await page.getByRole('checkbox', { name: 'Bật danh mục khi tạo' }).uncheck();
  await page.getByRole('button', { name: 'Thêm danh mục', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Đường dẫn danh mục đã được sử dụng.');
  await expect(page.getByLabel('Tên danh mục', { exact: true })).toHaveValue('Áo khoác tạm tắt');
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await page.getByLabel('Đường dẫn danh mục', { exact: true }).fill(slugs[1]!);
  await page.getByRole('button', { name: 'Thêm danh mục', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Đã lưu danh mục');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Áo khoác tạm tắt', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Đến nội dung chính' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main-content$/);
  await page.screenshot({ path: info.outputPath('categories-mobile.png'), fullPage: true });

  if (!db) throw new Error('Missing test database');
  const saved = await db.category.findMany({ where: { slug: { in: slugs } } });
  expect(saved).toHaveLength(2);
  expect(saved.find((item) => item.slug === slugs[0])?.active).toBe(true);
  expect(saved.find((item) => item.slug === slugs[1])?.active).toBe(false);
});

test('anonymous and CUSTOMER cannot enter category management or write through its API', async ({ page }) => {
  await page.goto('/admin/categories');
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get('/api/v1/admin/categories')).status()).toBe(401);
  const anonymousCsrf = await page.request.get('/api/v1/auth/csrf');
  const anonymousToken: { csrfToken: string } = await anonymousCsrf.json();
  expect((await page.request.post('/api/v1/admin/categories', {
    headers: { Origin: 'http://127.0.0.1:5174', 'X-CSRF-Token': anonymousToken.csrfToken },
    data: { name: 'Không được tạo', slug: slugs[0], active: true },
  })).status()).toBe(401);
  expect((await page.request.patch(`/api/v1/admin/categories/${randomUUID()}`, {
    headers: { Origin: 'http://127.0.0.1:5174', 'X-CSRF-Token': anonymousToken.csrfToken },
    data: { name: 'Không được sửa', slug: slugs[0], active: false, expectedVersion: 0 },
  })).status()).toBe(401);

  await page.getByLabel('Email', { exact: true }).fill(customerEmail);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.goto('/admin/categories');
  await expect(page).toHaveURL(/\/account$/);
  expect((await page.request.get('/api/v1/admin/categories')).status()).toBe(403);
  const csrfResponse = await page.request.get('/api/v1/auth/csrf');
  const token: { csrfToken: string } = await csrfResponse.json();
  expect((await page.request.post('/api/v1/admin/categories', {
    headers: { Origin: 'http://127.0.0.1:5174', 'X-CSRF-Token': token.csrfToken },
    data: { name: 'Không được tạo', slug: slugs[0], active: true },
  })).status()).toBe(403);
  expect((await page.request.patch(`/api/v1/admin/categories/${randomUUID()}`, {
    headers: { Origin: 'http://127.0.0.1:5174', 'X-CSRF-Token': token.csrfToken },
    data: { name: 'Không được sửa', slug: slugs[0], active: false, expectedVersion: 0 },
  })).status()).toBe(403);
});

test('admin edits name/slug/status, keeps duplicate input, and public visibility follows the saved status', async ({ page }, info) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(adminEmail);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/categories');
  for (const entry of [{ name: 'Danh mục cần sửa', slug: slugs[2] }, { name: 'Danh mục giữ đường dẫn', slug: slugs[3] }]) {
    await page.getByLabel('Tên danh mục', { exact: true }).fill(entry.name);
    await page.getByLabel('Đường dẫn danh mục', { exact: true }).fill(entry.slug);
    await page.getByRole('button', { name: 'Thêm danh mục', exact: true }).click();
    await expect(page.getByRole('heading', { name: entry.name, exact: true })).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Sửa Danh mục cần sửa', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sửa danh mục', exact: true });
  await dialog.getByLabel('Tên danh mục', { exact: true }).fill('Danh mục đã sửa');
  await dialog.getByLabel('Đường dẫn danh mục', { exact: true }).fill(slugs[3]);
  await dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Danh mục đã thay đổi hoặc đường dẫn bị trùng.');
  await expect(dialog.getByLabel('Tên danh mục', { exact: true })).toHaveValue('Danh mục đã sửa');
  await dialog.getByLabel('Đường dẫn danh mục', { exact: true }).fill(slugs[4]);
  await dialog.getByRole('checkbox', { name: 'Bật danh mục', exact: true }).uncheck();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('category-edit-mobile.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Danh mục đã sửa', exact: true })).toBeVisible();
  if (!db) throw new Error('Missing test database');
  expect(await db.category.findUniqueOrThrow({ where: { slug: slugs[4] } })).toMatchObject({ active: false, version: 1 });
  const hidden: { slug: string }[] = await (await page.request.get('/api/v1/categories')).json();
  expect(hidden.some((row) => row.slug === slugs[4])).toBe(false);
  await page.getByRole('button', { name: 'Sửa Danh mục đã sửa', exact: true }).click();
  await expect(dialog.getByLabel('Đường dẫn danh mục', { exact: true })).toHaveValue(slugs[4]);
  await dialog.getByRole('checkbox', { name: 'Bật danh mục', exact: true }).check();
  await dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const visible: { slug: string }[] = await (await page.request.get('/api/v1/categories')).json();
  expect(visible.some((row) => row.slug === slugs[4])).toBe(true);
});

test('two real tabs reject an outdated version and only rebase after explicitly reloading', async ({ page, context }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(adminEmail);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/categories');
  await page.getByLabel('Tên danh mục', { exact: true }).fill('Danh mục hai tab');
  await page.getByLabel('Đường dẫn danh mục', { exact: true }).fill(slugs[5]);
  await page.getByRole('button', { name: 'Thêm danh mục', exact: true }).click();
  await page.getByRole('button', { name: 'Sửa Danh mục hai tab', exact: true }).click();
  const first = page.getByRole('dialog', { name: 'Sửa danh mục', exact: true });
  await first.getByLabel('Tên danh mục', { exact: true }).fill('Bản nhập tab một');
  const other = await context.newPage();
  try {
    await other.goto('/admin/categories');
    await other.getByRole('button', { name: 'Sửa Danh mục hai tab', exact: true }).click();
    const second = other.getByRole('dialog', { name: 'Sửa danh mục', exact: true });
    await second.getByLabel('Tên danh mục', { exact: true }).fill('Tab hai đã lưu');
    await second.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await expect(second).toHaveCount(0);
    await page.bringToFront();
    await first.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await expect(first.getByRole('alert')).toContainText('Danh mục đã thay đổi hoặc đường dẫn bị trùng.');
    await expect(first.getByLabel('Tên danh mục', { exact: true })).toHaveValue('Bản nhập tab một');
    if (!db) throw new Error('Missing test database');
    expect(await db.category.findUniqueOrThrow({ where: { slug: slugs[5] } })).toMatchObject({ name: 'Tab hai đã lưu', version: 1 });
    await first.getByRole('button', { name: 'Tải dữ liệu mới', exact: true }).click();
    await expect(first.getByLabel('Tên danh mục', { exact: true })).toHaveValue('Tab hai đã lưu');
    await first.getByLabel('Tên danh mục', { exact: true }).fill('Tab một lưu sau khi tải mới');
    await first.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await expect(first).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Tab một lưu sau khi tải mới', exact: true })).toBeVisible();
    expect(await db.category.findUniqueOrThrow({ where: { slug: slugs[5] } })).toMatchObject({ name: 'Tab một lưu sau khi tải mới', version: 2 });
  } finally { await other.close(); }
});

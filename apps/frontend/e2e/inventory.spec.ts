import { expect, test } from '@playwright/test';
import { hash } from 'argon2';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../backend/dist/modules/prisma/prisma.service.js';
import { readEnvironment } from '../../backend/dist/config/environment.js';

const prefix = `INV-${randomUUID()}`;
const adminEmail = `${prefix}-admin@example.test`.toLowerCase();
const customerEmail = `${prefix}-customer@example.test`.toLowerCase();
const password = 'inventory-e2e-only-password-123!';
const productName = `Áo kho thử ${prefix}`;
const longSku = 'W'.repeat(32) + randomUUID().replaceAll('-', '').toUpperCase();
let productId = '';
let categoryId = '';
let db: PrismaService | undefined;

function assertTestDatabase() {
  let valid = false;
  try {
    const url = new URL(process.env['DATABASE_URL'] ?? '');
    valid = process.env['NODE_ENV'] === 'test' && ['postgres:', 'postgresql:'].includes(url.protocol)
      && decodeURIComponent(url.pathname).endsWith('_test');
  } catch { /* Never print database credentials. */ }
  if (!valid) throw new Error('Inventory E2E requires NODE_ENV=test and a PostgreSQL *_test database');
}

test.beforeAll(async () => {
  assertTestDatabase();
  db = new PrismaService(readEnvironment(process.env));
  const passwordHash = await hash(password);
  await db.user.createMany({ data: [
    { email: adminEmail, name: 'Admin kho thử', role: 'ADMIN', passwordHash, emailVerifiedAt: new Date() },
    { email: customerEmail, name: 'Khách kho thử', role: 'CUSTOMER', passwordHash, emailVerifiedAt: new Date() },
  ] });
  const category = await db.category.create({ data: { name: 'Danh mục kho thử', slug: `${prefix}-category`.toLowerCase() } });
  categoryId = category.id;
  const product = await db.product.create({ data: {
    name: productName, slug: prefix.toLowerCase(), description: '', categoryId, priceFrom: 100000,
    variants: { create: Array.from({ length: 25 }, (_, index) => ({
      sku: index === 0 ? longSku : `${prefix}-${String(index).padStart(2, '0')}`.toUpperCase(),
      size: 'M', color: `màu ${index}`, price: 100000,
      inventory: { create: { onHand: index === 0 ? 12 : 0, reserved: index === 0 ? 2 : 0 } },
    })) },
  } });
  productId = product.id;
});

test.afterAll(async () => {
  assertTestDatabase();
  if (!db) return;
  try {
    if (productId) {
      await db.inventoryMovement.deleteMany({ where: { variant: { productId } } });
      await db.inventory.deleteMany({ where: { variant: { productId } } });
      await db.variant.deleteMany({ where: { productId } });
      await db.product.delete({ where: { id: productId } });
    }
    if (categoryId) await db.category.delete({ where: { id: categoryId } });
    const users = await db.user.findMany({ where: { email: { in: [adminEmail, customerEmail] } }, select: { id: true } });
    for (const user of users) {
      await db.session.deleteMany({ where: { sess: { path: ['userId'], equals: user.id } } });
      await db.user.delete({ where: { id: user.id } });
    }
  } finally { await db.$disconnect(); }
});

test('admin searches real inventory by SKU/name, persists URL pagination and reads stock on mobile', async ({ page }, info) => {
  test.setTimeout(60000);
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(adminEmail);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('link', { name: 'Kho', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const search = page.getByLabel('Tìm theo SKU hoặc tên sản phẩm', { exact: true });
  await search.fill(longSku.toLowerCase());
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  const row = page.getByRole('listitem', { name: longSku, exact: true });
  await expect(row).toBeVisible();
  for (const text of [productName, 'Tồn thực có', '12', 'Đang giữ', '2', 'Còn bán', '10']) {
    await expect(row.getByText(text, { exact: true })).toBeVisible();
  }
  await expect(page).toHaveURL(new RegExp(`q=${longSku.toLowerCase()}&page=1`));
  await page.reload();
  await expect(search).toHaveValue(longSku.toLowerCase());
  await expect(row).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('inventory-mobile-390.png'), fullPage: true });

  await search.fill(productName);
  await search.press('Enter');
  await expect(page.getByRole('list', { name: 'Danh sách tồn kho' }).getByRole('listitem')).toHaveCount(24);
  await page.getByRole('button', { name: 'Trang 2', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole('list', { name: 'Danh sách tồn kho' }).getByRole('listitem')).toHaveCount(1);
  await page.reload();
  await expect(search).toHaveValue(productName);
  await expect(page.getByRole('list', { name: 'Danh sách tồn kho' }).getByRole('listitem')).toHaveCount(1);
  await page.goBack();
  await expect(page).toHaveURL(/page=1/);
  await expect(search).toHaveValue(productName);

  await search.fill(`missing-${randomUUID()}`);
  await search.press('Enter');
  await expect(page.getByText('Không có SKU khớp từ khóa tìm kiếm.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (!db) throw new Error('Missing test database');
  const persisted = await db.inventory.findFirstOrThrow({ where: { variant: { sku: longSku } } });
  expect(persisted).toMatchObject({ onHand: 12, reserved: 2, version: 0 });
});

test('admin can retry a failed inventory read', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(adminEmail);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.route('**/api/v1/admin/inventory?**', (route) => route.abort('failed'), { times: 1 });
  await page.goto(`/admin/inventory?q=${longSku}`);
  await expect(page.getByRole('alert')).toContainText('Không thể kết nối');
  await page.getByRole('button', { name: 'Tải lại tồn kho', exact: true }).click();
  await expect(page.getByRole('listitem', { name: longSku, exact: true })).toBeVisible();
});

test('guest and CUSTOMER cannot enter inventory or read its API', async ({ page }) => {
  await page.goto('/admin/inventory');
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get('/api/v1/admin/inventory')).status()).toBe(401);
  await page.getByLabel('Email', { exact: true }).fill(customerEmail);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.goto('/admin/inventory');
  await expect(page).toHaveURL(/\/account$/);
  expect((await page.request.get('/api/v1/admin/inventory')).status()).toBe(403);
});

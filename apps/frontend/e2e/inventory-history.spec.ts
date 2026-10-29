import { expect, test } from '@playwright/test';
import { hash } from 'argon2';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../backend/dist/modules/prisma/prisma.service.js';
import { readEnvironment } from '../../backend/dist/config/environment.js';

const prefix = `HIST-${randomUUID()}`;
const adminEmail = `${prefix}-admin@example.test`.toLowerCase();
const password = 'inventory-history-e2e-password-123!';
const productName = `Áo lịch sử ${prefix}`;
const skuFor = (index: number) => `${prefix}-${String(index).padStart(2, '0')}`.toUpperCase();
let productId = '';
let categoryId = '';
let adminId = '';
let db: PrismaService | undefined;
const variantId = new Map<string, string>();

function assertTestDatabase() {
  let valid = false;
  try {
    const url = new URL(process.env['DATABASE_URL'] ?? '');
    valid = process.env['NODE_ENV'] === 'test' && ['postgres:', 'postgresql:'].includes(url.protocol)
      && decodeURIComponent(url.pathname).endsWith('_test');
  } catch { /* Never print database credentials. */ }
  if (!valid) throw new Error('Inventory E2E requires NODE_ENV=test and a PostgreSQL *_test database');
}

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/(admin|account)$/);
}

test.beforeAll(async () => {
  assertTestDatabase();
  db = new PrismaService(readEnvironment(process.env));
  const passwordHash = await hash(password);
  const admin = await db.user.create({ data: {
    email: adminEmail, name: 'Admin lịch sử thử', role: 'ADMIN', passwordHash, emailVerifiedAt: new Date(),
  } });
  adminId = admin.id;
  const category = await db.category.create({ data: { name: 'Danh mục lịch sử thử', slug: `${prefix}-category`.toLowerCase(), active: true } });
  categoryId = category.id;
  const product = await db.product.create({ data: {
    name: productName, slug: prefix.toLowerCase(), description: '', categoryId, priceFrom: 100000,
    variants: { create: [skuFor(0), skuFor(1), skuFor(2)].map((sku, index) => ({
      sku, size: 'M', color: `màu ${index}`, price: 100000,
      inventory: { create: { onHand: index === 0 ? 12 : 0, reserved: index === 0 ? 2 : 0 } },
    })) },
  } });
  productId = product.id;
  const variants = await db.variant.findMany({ where: { productId }, select: { id: true, sku: true } });
  for (const item of variants) variantId.set(item.sku, item.id);
  // Twelve seeded movements for the paginated history test, oldest first.
  await db.inventoryMovement.createMany({ data: Array.from({ length: 12 }, (_, index) => ({
    variantId: variantId.get(skuFor(1))!, actorId: adminId,
    key: `hist-e2e-${String(index).padStart(2, '0')}-${randomUUID().replaceAll('-', '')}`,
    requestHash: 'e2e-history-seed'.padEnd(16, '0'),
    delta: 1, reason: `Nhập hàng đợt ${index}`, before: index, after: index + 1, reserved: 0, version: index + 1,
    createdAt: new Date(Date.UTC(2026, 8, 20, 1, index)),
  })) });
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
    await db.session.deleteMany({ where: { sess: { path: ['userId'], equals: adminId } } });
    if (adminId) await db.user.delete({ where: { id: adminId } });
  } finally { await db.$disconnect(); }
});

test('an adjustment appears in the SKU history right away', async ({ page }) => {
  await login(page, adminEmail);
  const sku = skuFor(0);
  await page.goto(`/admin/inventory?variantId=${variantId.get(sku)}`);
  const row = page.getByRole('listitem', { name: sku, exact: true });
  await expect(row).toBeVisible();

  await page.getByRole('button', { name: `Điều chỉnh ${sku}`, exact: true }).click();
  await page.getByLabel('Số lượng thay đổi').fill('5');
  await page.getByLabel('Lý do điều chỉnh').fill('Nhập kho e2e');
  await page.getByRole('button', { name: 'Lưu điều chỉnh', exact: true }).click();
  await expect(page.getByText('Khả dụng: 15', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();

  await page.getByRole('button', { name: `Lịch sử ${sku}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Lịch sử ${sku}` });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Tìm thấy 1 giao dịch.')).toBeVisible();
  const entries = dialog.getByRole('list', { name: `Lịch sử ${sku}` }).getByRole('listitem');
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText('+5');
  await expect(entries.first()).toContainText('12 → 17');
  await expect(entries.first()).toContainText('Lý do: Nhập kho e2e');
  await expect(entries.first()).toContainText('Người thực hiện: Admin lịch sử thử');
  await expect(entries.first().locator('time')).toHaveAttribute('datetime', /^20\d\d-/);
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

test('history paginates twelve movements into two pages', async ({ page }) => {
  test.setTimeout(60000);
  await login(page, adminEmail);
  const sku = skuFor(1);
  await page.goto(`/admin/inventory?variantId=${variantId.get(sku)}`);
  await expect(page.getByRole('button', { name: `Lịch sử ${sku}`, exact: true })).toBeVisible();

  await page.getByRole('button', { name: `Lịch sử ${sku}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Lịch sử ${sku}` });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Tìm thấy 12 giao dịch.')).toBeVisible();
  const entries = dialog.getByRole('list', { name: `Lịch sử ${sku}` }).getByRole('listitem');
  await expect(entries).toHaveCount(10);
  await expect(dialog.getByText('Lý do: Nhập hàng đợt 11')).toBeVisible();

  await dialog.getByRole('button', { name: 'Trang 2' }).click();
  await expect(entries).toHaveCount(2);
  await expect(dialog.getByText('Lý do: Nhập hàng đợt 0')).toBeVisible();
  await expect(dialog.getByText('Tìm thấy 12 giao dịch.')).toBeVisible();
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

test('a variant without movements shows an empty history', async ({ page }) => {
  await login(page, adminEmail);
  const sku = skuFor(2);
  await page.goto(`/admin/inventory?variantId=${variantId.get(sku)}`);
  await expect(page.getByRole('button', { name: `Lịch sử ${sku}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Lịch sử ${sku}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Lịch sử ${sku}` });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Chưa có giao dịch cho SKU này.')).toBeVisible();
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

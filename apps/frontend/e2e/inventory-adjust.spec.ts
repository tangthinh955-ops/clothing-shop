import { expect, test } from '@playwright/test';
import { hash } from 'argon2';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../backend/dist/modules/prisma/prisma.service.js';
import { readEnvironment } from '../../backend/dist/config/environment.js';

const prefix = `ADJ-${randomUUID()}`;
const adminEmail = `${prefix}-admin@example.test`.toLowerCase();
const customerEmail = `${prefix}-customer@example.test`.toLowerCase();
const password = 'inventory-adjust-e2e-password-123!';
const productName = `Áo điều chỉnh ${prefix}`;
const longSku = 'V'.repeat(32) + randomUUID().replaceAll('-', '').toUpperCase();
const skuFor = (index: number) => (index === 0 ? longSku : `${prefix}-${String(index).padStart(2, '0')}`).toUpperCase();
let productId = '';
let categoryId = '';
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

async function seedVariantStock(sku: string, data: { onHand: number; reserved: number; version: number }) {
  if (!db) throw new Error('Missing test database');
  await db.inventory.update({ where: { variantId: variantId.get(sku) }, data });
}

async function productSnapshot(sku: string) {
  if (!db) throw new Error('Missing test database');
  const stock = await db.inventory.findUniqueOrThrow({ where: { variantId: variantId.get(sku) } });
  const movements = await db.inventoryMovement.count({ where: { variantId: variantId.get(sku) } });
  return { stock, movements };
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
  await db.user.createMany({ data: [
    { email: adminEmail, name: 'Admin điều chỉnh thử', role: 'ADMIN', passwordHash, emailVerifiedAt: new Date() },
    { email: customerEmail, name: 'Khách điều chỉnh thử', role: 'CUSTOMER', passwordHash, emailVerifiedAt: new Date() },
  ] });
  const category = await db.category.create({ data: { name: 'Danh mục điều chỉnh thử', slug: `${prefix}-category`.toLowerCase(), active: true } });
  categoryId = category.id;
  const product = await db.product.create({ data: {
    name: productName, slug: prefix.toLowerCase(), description: '', categoryId, priceFrom: 100000,
    variants: { create: Array.from({ length: 25 }, (_, index) => ({
      sku: skuFor(index), size: 'M', color: `màu ${index}`, price: 100000,
      inventory: { create: { onHand: index === 0 ? 12 : 0, reserved: index === 0 ? 2 : 0 } },
    })) },
  } });
  productId = product.id;
  const variants = await db.variant.findMany({ where: { productId }, select: { id: true, sku: true } });
  for (const item of variants) variantId.set(item.sku, item.id);
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

test('variantId filter shows one SKU and a +5 adjustment lands once', async ({ page }) => {
  await login(page, adminEmail);
  const sku = skuFor(0);
  await page.goto(`/admin/inventory?variantId=${variantId.get(sku)}`);
  const list = page.getByRole('list', { name: 'Danh sách tồn kho' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  const row = list.getByRole('listitem', { name: sku, exact: true });
  await expect(row).toBeVisible();

  await page.getByRole('button', { name: `Điều chỉnh ${sku}`, exact: true }).click();
  await page.getByLabel('Số lượng thay đổi').fill('5');
  await page.getByLabel('Lý do điều chỉnh').fill('Nhập kho e2e');
  await page.getByRole('button', { name: 'Lưu điều chỉnh', exact: true }).click();
  await expect(page.getByText('Khả dụng: 15', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(row.getByText('17', { exact: true })).toBeVisible();
  await expect(row.getByText('15', { exact: true })).toBeVisible();

  const { stock, movements } = await productSnapshot(sku);
  expect(stock).toMatchObject({ onHand: 17, reserved: 2, version: 1 });
  expect(movements).toBe(1);
  const movement = await db!.inventoryMovement.findFirstOrThrow({
    where: { variantId: variantId.get(sku) },
    select: { delta: true, before: true, after: true, version: true, actor: { select: { name: true } } },
  });
  expect(movement).toMatchObject({ delta: 5, before: 12, after: 17, version: 1, actor: { name: 'Admin điều chỉnh thử' } });
});

test('a lost response locks the form and resending the same key applies once', async ({ page }) => {
  test.setTimeout(60000);
  await login(page, adminEmail);
  const sku = skuFor(1);
  await page.goto('/admin/inventory');
  await expect(page.getByRole('button', { name: `Điều chỉnh ${sku}`, exact: true })).toBeVisible();
  await seedVariantStock(sku, { onHand: 12, reserved: 2, version: 0 });
  await page.goto(`/admin/inventory?variantId=${variantId.get(sku)}`);

  await page.route('**/api/v1/admin/inventory/adjustments', (route) => route.abort('failed'), { times: 1 });
  await page.getByRole('button', { name: `Điều chỉnh ${sku}`, exact: true }).click();
  await page.getByLabel('Số lượng thay đổi').fill('5');
  await page.getByLabel('Lý do điều chỉnh').fill('Nhập kho e2e lần hai');
  await page.getByRole('button', { name: 'Lưu điều chỉnh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Không thể kết nối');
  await expect(page.getByLabel('Số lượng thay đổi')).toBeDisabled();

  await page.getByRole('button', { name: 'Gửi lại', exact: true }).click();
  await expect(page.getByText('Khả dụng: 15', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const { stock, movements } = await productSnapshot(sku);
  expect(stock).toMatchObject({ onHand: 17, version: 1 });
  expect(movements).toBe(1);
});

test('a same-key replay returns the stored movement and never double-credits', async ({ page }) => {
  test.setTimeout(60000);
  await login(page, adminEmail);
  const sku = skuFor(2);
  await page.goto('/admin/inventory');
  await expect(page.getByRole('button', { name: `Điều chỉnh ${sku}`, exact: true })).toBeVisible();
  await seedVariantStock(sku, { onHand: 20, reserved: 0, version: 0 });
  await page.goto(`/admin/inventory?variantId=${variantId.get(sku)}`);
  await expect(page.getByRole('button', { name: `Điều chỉnh ${sku}`, exact: true })).toBeVisible();

  const key = `e2e-replay-${randomUUID().replaceAll('-', '')}`;
  const results = await page.evaluate(async ({ variantId: id, key: idem }) => {
    const csrf = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin' }).then((r) => r.json());
    const send = () => fetch('/api/v1/admin/inventory/adjustments', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idem, 'X-CSRF-Token': csrf.csrfToken },
      body: JSON.stringify({ variantId: id, delta: 1, reason: 'Gửi lại cùng khoá e2e', expectedVersion: 0 }),
    }).then(async (r) => ({ status: r.status, body: await r.json() }));
    return [await send(), await send()];
  }, { variantId: variantId.get(sku), key });

  expect(results).toEqual([results[0], results[0]]);
  const { stock, movements } = await productSnapshot(sku);
  expect(stock).toMatchObject({ onHand: 21, version: 1 });
  expect(movements).toBe(1);
});

test('an export below the reserved amount is rejected 409 without changing stock', async ({ page }) => {
  test.setTimeout(60000);
  await login(page, adminEmail);
  const sku = skuFor(3);
  await page.goto('/admin/inventory');
  await expect(page.getByRole('button', { name: `Điều chỉnh ${sku}`, exact: true })).toBeVisible();
  await seedVariantStock(sku, { onHand: 12, reserved: 2, version: 0 });
  await page.goto(`/admin/inventory?variantId=${variantId.get(sku)}`);

  await page.getByRole('button', { name: `Điều chỉnh ${sku}`, exact: true }).click();
  await page.getByLabel('Số lượng thay đổi').fill('-11');
  await page.getByLabel('Lý do điều chỉnh').fill('Xuất kho e2e quá giữ');
  await page.getByRole('button', { name: 'Lưu điều chỉnh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Tồn kho không được âm');
  expect(page.getByRole('button', { name: 'Gửi lại', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const { stock, movements } = await productSnapshot(sku);
  expect(stock).toMatchObject({ onHand: 12, reserved: 2, version: 0 });
  expect(movements).toBe(0);
});

test('CUSTOMER cannot adjust stock through the API', async ({ page }) => {
  test.setTimeout(60000);
  await login(page, customerEmail);
  await page.goto('/account');
  const baselineMovements = (await productSnapshot(skuFor(0))).movements;
  const status = await page.evaluate(async ({ variantId: id }) => {
    const csrf = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin' }).then((r) => r.json());
    const response = await fetch('/api/v1/admin/inventory/adjustments', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'e2e-customer-forbidden-00001', 'X-CSRF-Token': csrf.csrfToken },
      body: JSON.stringify({ variantId: id, delta: 1, reason: 'Khách không được phép', expectedVersion: 0 }),
    });
    return response.status;
  }, { variantId: variantId.get(skuFor(0)) });
  expect(status).toBe(403);
  const snapshots = await productSnapshot(skuFor(0));
  expect(snapshots.movements).toBe(baselineMovements);
});

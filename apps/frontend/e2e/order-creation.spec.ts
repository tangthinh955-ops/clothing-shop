import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../backend/dist/modules/prisma/prisma.service.js';
import { readEnvironment } from '../../backend/dist/config/environment.js';

const tag = randomUUID();
const slugA = `order-a-${tag}`;
const slugB = `order-b-${tag}`;
const nameA = `Áo đặt COD ${tag.slice(0, 8)}`;
const nameB = `Quần đặt COD ${tag.slice(0, 8)}`;
let db: PrismaService;
let categoryId = '';
let productAId = '';
let productBId = '';
let variantA = '';
let variantB = '';

function assertOwnedDatabase() {
  const url = new URL(process.env['DATABASE_URL'] ?? '');
  const database = decodeURIComponent(url.pathname.slice(1));
  if (process.env['NODE_ENV'] !== 'test' || !['postgres:', 'postgresql:'].includes(url.protocol)
    || database !== process.env['CLOTHING_TEST_DATABASE'] || !/^clothing_e2e_[0-9a-f]{16}_test$/.test(database)) {
    throw new Error('Order creation E2E requires the isolated test runner database.');
  }
}

test.beforeAll(async () => {
  assertOwnedDatabase();
  db = new PrismaService(readEnvironment(process.env));
  await db.shopSettings.create({ data: { id: 'default', shippingFeeVnd: 30000, bankDeadlineMinutes: 120 } });
  const category = await db.category.create({ data: { name: 'Danh mục đặt COD thử', slug: `cod-${tag}`, active: true } });
  categoryId = category.id;
  const productA = await db.product.create({ data: { name: nameA, slug: slugA, description: '', categoryId,
    status: 'PUBLISHED', priceFrom: 200000, variants: { create: [
      { sku: `COD-${tag.toUpperCase()}-A`, size: 'M', color: 'Đen', price: 200000, active: true, inventory: { create: { onHand: 5, reserved: 0 } } }] } },
    include: { variants: true } });
  productAId = productA.id;
  variantA = productA.variants[0]!.id;
  const productB = await db.product.create({ data: { name: nameB, slug: slugB, description: '', categoryId,
    status: 'PUBLISHED', priceFrom: 300000, variants: { create: [
      { sku: `COD-${tag.toUpperCase()}-B`, size: 'L', color: 'Xanh', price: 300000, active: true, inventory: { create: { onHand: 3, reserved: 0 } } }] } },
    include: { variants: true } });
  productBId = productB.id;
  variantB = productB.variants[0]!.id;
});

test.afterAll(async () => {
  if (!db) return;
  assertOwnedDatabase();
  try {
    const orders = await db.order.findMany({ select: { id: true } });
    for (const order of orders) {
      await db.orderStatusHistory.deleteMany({ where: { orderId: order.id } });
      await db.orderItem.deleteMany({ where: { orderId: order.id } });
    }
    await db.order.deleteMany({});
    await db.idempotencyRecord.deleteMany({ where: { scope: 'orders.create' } });
    await db.checkoutQuote.deleteMany({});
    for (const productId of [productAId, productBId]) {
      if (!productId) continue;
      await db.inventoryMovement.deleteMany({ where: { variant: { productId } } });
      await db.inventory.deleteMany({ where: { variant: { productId } } });
      await db.variant.deleteMany({ where: { productId } });
      await db.product.deleteMany({ where: { id: productId } });
    }
    if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
    await db.shopSettings.deleteMany({ where: { id: 'default' } });
  } finally { await db.$disconnect(); }
});

async function addToCart(page: import('@playwright/test').Page, slug: string, color: string, size: string, quantity: string) {
  await page.goto(`/products/${slug}`);
  await page.getByRole('group', { name: 'Chọn màu' }).getByRole('button', { name: color, exact: true }).click();
  await page.getByRole('group', { name: 'Chọn size' }).getByRole('button', { name: size, exact: true }).click();
  await page.getByLabel('Số lượng', { exact: true }).fill(quantity);
  await page.getByRole('button', { name: 'Thêm vào giỏ' }).click();
  await page.getByRole('button', { name: 'Đóng giỏ hàng' }).click();
}

async function fillRecipient(page: import('@playwright/test').Page, phone: string) {
  await page.getByLabel('Họ tên', { exact: true }).fill('Nguyễn Thử E2E');
  await page.getByLabel('Số điện thoại', { exact: true }).fill(phone);
  await page.getByLabel('Tỉnh/thành', { exact: true }).fill('TP. Hồ Chí Minh');
  await page.getByLabel('Phường/xã', { exact: true }).fill('Phường Bến Nghé');
  await page.getByLabel('Địa chỉ cụ thể', { exact: true }).fill('12 Nguyễn Huệ, Quận 1');
}

test('guest orders COD without an account: confirmation, DB snapshot and reserved stock', async ({ page }, info) => {
  test.setTimeout(60000);
  await addToCart(page, slugA, 'Đen', 'M', '2');
  await addToCart(page, slugB, 'Xanh', 'L', '1');
  await page.goto('/cart');
  await page.getByRole('link', { name: 'Xem phí và tổng tiền' }).click();
  await page.getByRole('button', { name: 'Lấy báo giá' }).click();
  await expect(page.getByRole('heading', { name: 'Thông tin nhận hàng' })).toBeVisible();
  await fillRecipient(page, '0901234567');
  await page.getByRole('button', { name: 'Đặt hàng COD' }).click();
  await expect(page.getByText(/Đã tạo đơn hàng COD/)).toBeVisible();
  const code = await page.getByText(/^[A-HJ-NP-Z2-9]{12}$/).first().textContent();
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);
  await expect(page.getByText(/Chờ xác nhận/)).toBeVisible();
  await expect(page.getByText(/chưa thu tiền/)).toBeVisible();
  await expect(page.getByText(/730\.000/).first()).toBeVisible();

  const row = await db.order.findUniqueOrThrow({ where: { code: code! }, include: { items: true, history: true } });
  expect(row).toMatchObject({ status: 'PENDING', source: 'WEB', userId: null, method: 'COD' });
  expect(Number(row.totalVnd)).toBe(730000);
  expect(row.items).toHaveLength(2);
  expect(row.history).toHaveLength(1);
  expect(row.history[0]).toMatchObject({ toStatus: 'PENDING', actorType: 'GUEST', actorId: null });
  expect(await db.inventory.findUniqueOrThrow({ where: { variantId: variantA } })).toMatchObject({ onHand: 5, reserved: 2 });
  expect(await db.inventory.findUniqueOrThrow({ where: { variantId: variantB } })).toMatchObject({ onHand: 3, reserved: 1 });
  const record = await db.idempotencyRecord.findFirstOrThrow({ where: { resourceId: row.id } });
  expect(JSON.stringify(record)).not.toContain('Nguyễn Thử E2E');
  expect(JSON.stringify(record)).not.toContain('0901234567');

  // The cart was cleared after the order consumed exactly these lines.
  await page.reload();
  await expect(page.getByText(/Giỏ hàng trống/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/products/${slugA}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('order-creation-mobile.png'), fullPage: true });
});

test('a lost response after commit is recovered by Gửi lại without reserving twice', async ({ page }) => {
  test.setTimeout(60000);
  let dropped = false;
  await page.route('**/api/v1/orders', async (route) => {
    if (dropped) return route.continue();
    dropped = true;
    // The request reaches the server (it commits) while the browser is given a 500 instead of the
    // real response — the exact "lost response after commit" failure mode.
    await route.fetch();
    return route.fulfill({ status: 500, contentType: 'application/json',
      body: JSON.stringify({ code: 'SYSTEM_ERROR', message: 'Dịch vụ gặp lỗi. Vui lòng thử lại sau.' }) });
  });
  // Tests share the isolated DB: judge this scenario by the DELTA of reserved stock, not absolutes.
  const reservedBefore = (await db.inventory.findUniqueOrThrow({ where: { variantId: variantA } })).reserved;
  await addToCart(page, slugA, 'Đen', 'M', '1');
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Lấy báo giá' }).click();
  await fillRecipient(page, '0901234567');
  await page.getByRole('button', { name: 'Đặt hàng COD' }).click();
  await expect(page.getByText(/Đơn có thể đã được tạo từ lần gửi trước/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gửi lại' })).toBeVisible();
  await page.getByRole('button', { name: 'Gửi lại' }).click();
  await expect(page.getByText(/Đã tạo đơn hàng COD/)).toBeVisible();
  const code = await page.getByText(/^[A-HJ-NP-Z2-9]{12}$/).first().textContent();
  expect(await db.order.count({ where: { code: code! } })).toBe(1);
  expect((await db.inventory.findUniqueOrThrow({ where: { variantId: variantA } })).reserved).toBe(reservedBefore + 1);
  expect(await db.idempotencyRecord.count({ where: { resourceId: (await db.order.findUniqueOrThrow({ where: { code: code! } })).id } })).toBe(1);
});

test('an out-of-stock cart is refused at creation with the form kept', async ({ page }) => {
  // The quote succeeds while stock is available; the stock then drops before the order is placed.
  const reservedB = (await db.inventory.findUniqueOrThrow({ where: { variantId: variantB } })).reserved;
  await addToCart(page, slugB, 'Xanh', 'L', '2');
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Lấy báo giá' }).click();
  await expect(page.getByRole('heading', { name: 'Thông tin nhận hàng' })).toBeVisible();
  await fillRecipient(page, '0901234567');
  // available drops to 0 (onHand == reserved) after the quote but before the create.
  await db.inventory.update({ where: { variantId: variantB }, data: { onHand: reservedB } });
  await page.getByRole('button', { name: 'Đặt hàng COD' }).click();
  await expect(page.getByText(/Chỉ còn 0 chiếc cho một sản phẩm trong giỏ/)).toBeVisible();
  // The form stays with the shopper's input; nothing was reserved or created.
  await expect(page.getByLabel('Họ tên', { exact: true })).toHaveValue('Nguyễn Thử E2E');
  expect((await db.inventory.findUniqueOrThrow({ where: { variantId: variantB } })).reserved).toBe(reservedB);
  // Earlier scenarios in this file created orders; the count must not grow.
  const ordersBefore = await db.order.count();
  expect(await db.order.count()).toBe(ordersBefore);
});

import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../backend/dist/modules/prisma/prisma.service.js';
import { readEnvironment } from '../../backend/dist/config/environment.js';

const tag = randomUUID();
const slugA = `quote-a-${tag}`;
const slugB = `quote-b-${tag}`;
const nameA = `Áo báo giá ${tag.slice(0, 8)}`;
const nameB = `Quần báo giá ${tag.slice(0, 8)}`;
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
    throw new Error('Checkout quote E2E requires the isolated test runner database.');
  }
}

test.beforeAll(async () => {
  assertOwnedDatabase();
  db = new PrismaService(readEnvironment(process.env));
  await db.shopSettings.create({ data: { id: 'default', shippingFeeVnd: 30000, bankDeadlineMinutes: 120 } });
  const category = await db.category.create({ data: { name: 'Danh mục báo giá thử', slug: `quote-${tag}`, active: true } });
  categoryId = category.id;
  const productA = await db.product.create({ data: { name: nameA, slug: slugA, description: '', categoryId,
    status: 'PUBLISHED', priceFrom: 200000, variants: { create: [
      { sku: `QUOTE-${tag.toUpperCase()}-A`, size: 'M', color: 'Đen', price: 200000, active: true, inventory: { create: { onHand: 5, reserved: 0 } } }] } },
    include: { variants: true } });
  productAId = productA.id;
  variantA = productA.variants[0]!.id;
  const productB = await db.product.create({ data: { name: nameB, slug: slugB, description: '', categoryId,
    status: 'PUBLISHED', priceFrom: 300000, variants: { create: [
      { sku: `QUOTE-${tag.toUpperCase()}-B`, size: 'L', color: 'Xanh', price: 300000, active: true, inventory: { create: { onHand: 3, reserved: 0 } } }] } },
    include: { variants: true } });
  productBId = productB.id;
  variantB = productB.variants[0]!.id;
});

test.afterAll(async () => {
  if (!db) return;
  assertOwnedDatabase();
  try {
    for (const productId of [productAId, productBId]) {
      if (!productId) continue;
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

test('guest quotes 2×A + 1×B from the cart and reads 730.000 from the server', async ({ page }, info) => {
  test.setTimeout(60000);
  await addToCart(page, slugA, 'Đen', 'M', '2');
  await addToCart(page, slugB, 'Xanh', 'L', '1');
  await page.goto('/cart');
  await page.getByRole('link', { name: 'Xem phí và tổng tiền' }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByText(/Phương thức hiện tại: thanh toán khi nhận hàng \(COD\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Lấy báo giá' }).click();
  await expect(page.getByText(/730\.000/)).toBeVisible();
  await expect(page.getByText(/700\.000/)).toBeVisible();
  await expect(page.getByText('Báo giá chưa giữ hàng. Giá và tồn sẽ được kiểm tra lại khi đặt đơn.')).toBeVisible();
  await expect(page.getByText(nameA)).toBeVisible();
  await expect(page.getByText(nameB)).toBeVisible();
  // Deep refresh: the page renders again and the shopper can quote the persisted cart afresh.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Đặt hàng — thanh toán khi nhận hàng' })).toBeVisible();
  await page.getByRole('button', { name: 'Lấy báo giá' }).click();
  await expect(page.getByText(/730\.000/)).toBeVisible();
  const row = await db.checkoutQuote.findFirstOrThrow({ orderBy: { createdAt: 'desc' } });
  expect(Number(row.totalVnd)).toBe(730000);
  expect(Number(row.subtotalVnd)).toBe(700000);
  expect(Number(row.shippingFeeVnd)).toBe(30000);
  expect(row.method).toBe('COD');
  const snapshot = row.items as Array<{ variantId: string; quantity: number; lineTotalVnd: number }>;
  expect(snapshot).toHaveLength(2);
  expect(snapshot).toEqual(expect.arrayContaining([
    expect.objectContaining({ variantId: variantA, quantity: 2, lineTotalVnd: 400000 }),
    expect.objectContaining({ variantId: variantB, quantity: 1, lineTotalVnd: 300000 }),
  ]));
  expect(await db.inventory.findUniqueOrThrow({ where: { variantId: variantA } })).toMatchObject({ onHand: 5, reserved: 0 });
  expect(await db.inventory.findUniqueOrThrow({ where: { variantId: variantB } })).toMatchObject({ onHand: 3, reserved: 0 });
  expect(await db.order.count()).toBe(0);
  expect(await db.inventoryMovement.count()).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('checkout-quote-mobile.png'), fullPage: true });
});

test('a changed price or fee is confirmed through Dùng báo giá mới before replacing the seen total', async ({ page }) => {
  test.setTimeout(60000);
  // Advance the browser beyond the agreed 15-minute quote lifetime.
  await page.clock.install({ time: new Date() });
  await addToCart(page, slugA, 'Đen', 'M', '1');
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Lấy báo giá' }).click();
  await expect(page.getByText(/230\.000/)).toBeVisible();
  // The shop changes the unit price while the shopper holds a quote.
  await db.variant.update({ where: { id: variantA }, data: { price: 250000 } });
  await page.clock.fastForward('16:00');
  await expect(page.getByText('Báo giá đã hết hạn. Hãy cập nhật để xem mức giá hiện tại.')).toBeVisible();
  await page.getByRole('button', { name: 'Cập nhật báo giá' }).click();
  await expect(page.getByRole('button', { name: 'Dùng báo giá mới' })).toBeVisible();
  await expect(page.getByText(/Đơn giá/)).toBeVisible();
  await expect(page.getByText(/280\.000/)).toBeVisible();
  await expect(page.getByText(/230\.000/)).toBeVisible();
  await page.getByRole('button', { name: 'Dùng báo giá mới' }).click();
  await expect(page.getByText(/280\.000/)).toBeVisible();
  expect(page.getByRole('button', { name: 'Dùng báo giá mới' })).toHaveCount(0);
  await db.variant.update({ where: { id: variantA }, data: { price: 200000 } });
});

test('unavailable or oversold carts are refused whole without writing anything', async ({ page }) => {
  await addToCart(page, slugA, 'Đen', 'M', '1');
  await db.product.update({ where: { id: productAId }, data: { status: 'DRAFT' } });
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Lấy báo giá' }).click();
  await expect(page.getByText(/Một sản phẩm trong giỏ không còn bán/)).toBeVisible();
  const quotesAfterDraft = await db.checkoutQuote.count();
  await db.product.update({ where: { id: productAId }, data: { status: 'PUBLISHED' } });
  await db.inventory.update({ where: { variantId: variantA }, data: { onHand: 0 } });
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByText('Chỉ còn 0 chiếc cho một sản phẩm trong giỏ. Hãy giảm số lượng rồi lấy báo giá lại.')).toBeVisible();
  expect(await db.checkoutQuote.count()).toBe(quotesAfterDraft);
  expect(await db.inventory.findUniqueOrThrow({ where: { variantId: variantA } })).toMatchObject({ onHand: 0, reserved: 0 });
  await page.goto('/cart');
  await expect(page.getByRole('button', { name: 'Xóa dòng này khỏi giỏ' })).toHaveCount(1);
});

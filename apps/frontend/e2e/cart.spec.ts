import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../backend/dist/modules/prisma/prisma.service.js';
import { readEnvironment } from '../../backend/dist/config/environment.js';

const tag = randomUUID();
const slug = `cart-e2e-${tag}`;
const name = `Áo giỏ ${tag.slice(0, 8)}`;
let db: PrismaService;
let productId: string;
let categoryId: string;
let variantM: string;
let variantL: string;

function assertOwnedDatabase() {
  const url = new URL(process.env['DATABASE_URL'] ?? '');
  const database = decodeURIComponent(url.pathname.slice(1));
  if (process.env['NODE_ENV'] !== 'test' || !['postgres:', 'postgresql:'].includes(url.protocol)
    || database !== process.env['CLOTHING_TEST_DATABASE'] || !/^clothing_e2e_[0-9a-f]{16}_test$/.test(database)) {
    throw new Error('Cart E2E requires the isolated test runner database.');
  }
}

test.beforeAll(async () => {
  assertOwnedDatabase();
  db = new PrismaService(readEnvironment(process.env));
  const category = await db.category.create({ data: { name: 'Danh mục giỏ thử', slug, active: true } });
  categoryId = category.id;
  const product = await db.product.create({ data: { name, slug, description: '', categoryId,
    status: 'PUBLISHED', priceFrom: 200000, variants: { create: [
      { sku: `CART-${tag.toUpperCase()}-M`, color: 'Đen', size: 'M', price: 200000, active: true, inventory: { create: { onHand: 5, reserved: 1 } } },
      { sku: `CART-${tag.toUpperCase()}-L`, color: 'Trắng', size: 'L', price: 250000, active: true, inventory: { create: { onHand: 3, reserved: 0 } } },
    ] } }, include: { variants: true } });
  productId = product.id;
  const medium = product.variants.find((item) => item.size === 'M');
  const large = product.variants.find((item) => item.size === 'L');
  if (!medium || !large) throw new Error('Cart fixture must contain both variants.');
  variantM = medium.id;
  variantL = large.id;
});

test.afterAll(async () => {
  if (!db) return;
  assertOwnedDatabase();
  try {
    if (productId) {
      await db.inventory.deleteMany({ where: { variant: { productId } } });
      await db.variant.deleteMany({ where: { productId } });
      await db.product.deleteMany({ where: { id: productId } });
    }
    if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
  } finally { await db.$disconnect(); }
});

test('guest adds variants, opens drawer, edits cart and sees fresh availability without reserving stock', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/products/${slug}`);
  await page.getByRole('group', { name: 'Chọn màu' }).getByRole('button', { name: 'Đen', exact: true }).click();
  await page.getByRole('group', { name: 'Chọn size' }).getByRole('button', { name: 'M', exact: true }).click();
  await page.getByLabel('Số lượng', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Thêm vào giỏ' }).click();
  await expect(page.getByRole('dialog', { name: 'GIỎ HÀNG' })).toContainText(name);
  await page.getByRole('button', { name: 'Đóng giỏ hàng' }).click();
  await page.getByRole('group', { name: 'Chọn màu' }).getByRole('button', { name: 'Trắng', exact: true }).click();
  await page.getByRole('group', { name: 'Chọn size' }).getByRole('button', { name: 'L', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm vào giỏ' }).click();
  await expect(page.getByRole('dialog', { name: 'GIỎ HÀNG' })).toContainText('size M');
  await expect(page.getByRole('dialog', { name: 'GIỎ HÀNG' })).toContainText('size L');
  await page.getByRole('button', { name: 'Đóng giỏ hàng' }).click();
  await page.getByRole('button', { name: 'Giỏ hàng: 3 sản phẩm' }).click();
  await page.getByRole('link', { name: 'Đi tới giỏ hàng' }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await page.reload();
  await expect(page.getByRole('link', { name, exact: true })).toHaveCount(2);
  const fields = page.getByRole('textbox', { name: `Số lượng của ${name}` });
  await fields.first().fill('3');
  await fields.first().press('Tab');
  await expect(page.getByRole('button', { name: 'Giỏ hàng: 4 sản phẩm' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await db.inventory.findUniqueOrThrow({ where: { variantId: variantM } })).toMatchObject({ onHand: 5, reserved: 1 });
  expect(await db.inventory.findUniqueOrThrow({ where: { variantId: variantL } })).toMatchObject({ onHand: 3, reserved: 0 });
  await db.inventory.update({ where: { variantId: variantM }, data: { onHand: 2 } });
  await page.reload();
  await expect(page.getByText('Chỉ còn 1 chiếc', { exact: true })).toBeVisible();
  await db.product.update({ where: { id: productId }, data: { status: 'HIDDEN' } });
  await page.reload();
  await expect(page.getByText('Sản phẩm không truy cập được')).toHaveCount(2);
  await page.getByRole('button', { name: 'Xóa dòng này khỏi giỏ' }).first().click();
  await expect(page.getByText('Sản phẩm không truy cập được')).toHaveCount(1);
});

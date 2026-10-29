import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../backend/dist/modules/prisma/prisma.service.js';
import { readEnvironment } from '../../backend/dist/config/environment.js';

const prefix = `detail-${randomUUID()}`;
const token = prefix.slice(-13);
const detailName = `Áo chi tiết ${token}`;
const hiddenName = `Áo ẩn chi tiết ${token}`;
const descriptionText = 'Chi tiết mô tả lưới thời trang.';
const productSlug = `${prefix}-ao`;
const hiddenSlug = `${prefix}-an`;
const categorySlug = `${prefix}-danh-muc`;
const skuToken = token.toUpperCase();
let db: PrismaService | undefined;

function assertTestDatabase() {
  let valid = false;
  try {
    const url = new URL(process.env['DATABASE_URL'] ?? '');
    valid = process.env['NODE_ENV'] === 'test' && ['postgres:', 'postgresql:'].includes(url.protocol)
      && decodeURIComponent(url.pathname).endsWith('_test');
  } catch { /* Do not print credentials. */ }
  if (!valid) throw new Error('Catalog detail E2E requires NODE_ENV=test and a PostgreSQL *_test database');
}

function variantButtons(page: Page) {
  return page.getByRole('group', { name: 'Chọn biến thể' }).getByRole('button');
}

test.beforeAll(async () => {
  assertTestDatabase();
  db = new PrismaService(readEnvironment(process.env));
  const category = await db.category.create({ data: { name: 'Danh mục chi tiết công khai', slug: categorySlug, active: true } });
  await db.product.create({ data: { name: detailName, slug: productSlug, description: descriptionText, categoryId: category.id,
    priceFrom: 200000, status: 'PUBLISHED', createdAt: new Date(),
    variants: { create: [
      { sku: `DETAIL-${skuToken}-M`, size: 'M', color: 'đen', price: 250000, active: true, inventory: { create: { onHand: 12, reserved: 2 } } },
      { sku: `DETAIL-${skuToken}-S`, size: 'S', color: 'trắng', price: 200000, active: true, inventory: { create: { onHand: 5, reserved: 2 } } },
    ] } } });
  await db.product.create({ data: { name: hiddenName, slug: hiddenSlug, description: '', categoryId: category.id,
    priceFrom: 150000, status: 'HIDDEN', createdAt: new Date(),
    variants: { create: { sku: `DETAIL-${skuToken}-H`, size: 'L', color: 'xanh', price: 150000, active: true, inventory: { create: {} } } } } });
});

test.afterAll(async () => {
  assertTestDatabase();
  if (!db) return;
  try {
    for (const slug of [productSlug, hiddenSlug]) {
      const product = await db.product.findUnique({ where: { slug } });
      if (product) {
        await db.inventory.deleteMany({ where: { variant: { productId: product.id } } });
        await db.productImage.deleteMany({ where: { productId: product.id } });
        await db.variant.deleteMany({ where: { productId: product.id } });
        await db.product.delete({ where: { id: product.id } });
      }
    }
    await db.category.deleteMany({ where: { slug: categorySlug } });
  } finally { await db.$disconnect(); }
});

test('opens the detail from the shop list and shows the chosen variant price and stock', async ({ page }) => {
  await page.goto(`/shop?q=${encodeURIComponent(token)}`);
  await page.getByRole('link', { name: detailName, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/products/${productSlug}$`));
  await expect(page.getByRole('heading', { name: detailName, exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Breadcrumb sản phẩm' })).toContainText(detailName);
  await expect(page.getByText(descriptionText)).toBeVisible();
  await expect(page.getByText(/Giá từ 200\.000\s*₫/)).toBeVisible();
  await expect(variantButtons(page)).toHaveText(['M · đen', 'S · trắng']); // Thứ tự sku tăng dần từ backend.
  await page.getByRole('button', { name: /M · đen/ }).click();
  await expect(page.getByText('Còn 10 sản phẩm', { exact: true })).toBeVisible();
  await expect(page.getByText(/250\.000\s*₫/)).toBeVisible();
  await expect(page.getByText(/Giá từ/)).toHaveCount(0);
  await page.getByRole('button', { name: /S · trắng/ }).click();
  await expect(page.getByText('Còn 3 sản phẩm', { exact: true })).toBeVisible();
  await expect(page.getByText(/200\.000\s*₫/)).toBeVisible();
  await expect(page.getByText(/250\.000\s*₫/)).toHaveCount(0);
});

test('reloads the deep link, resets the selection and stays within the viewport on mobile', async ({ page }, info) => {
  await page.goto(`/products/${productSlug}`);
  await page.getByRole('button', { name: /M · đen/ }).click();
  await expect(page.getByText('Còn 10 sản phẩm', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: detailName, exact: true })).toBeVisible();
  await expect(page.getByText(/Giá từ 200\.000\s*₫/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('catalog-detail-mobile.png'), fullPage: true, animations: 'disabled' });
});

test('reports hidden and unknown products as not found with a way back', async ({ page }) => {
  await page.goto(`/products/${hiddenSlug}`);
  await expect(page.getByRole('alert')).toContainText('Không tìm thấy sản phẩm');
  await expect(page.getByRole('link', { name: 'Quay lại bộ sưu tập' })).toBeVisible();
  await page.goto(`/products/khong-ton-tai-${token}`);
  await expect(page.getByRole('alert')).toContainText('Không tìm thấy sản phẩm');
});

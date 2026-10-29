import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../backend/dist/modules/prisma/prisma.service.js';
import { readEnvironment } from '../../backend/dist/config/environment.js';

const prefix = `grid-${randomUUID()}`;
const token = prefix.slice(-13);
const newName = `Áo lưới ${token} mới`;
const oldName = `Áo lưới ${token} cũ`;
const hiddenName = `Áo ẩn ${token}`;
const unlistedName = `Áo tắt danh mục ${token}`;
const activeCategorySlug = `${prefix}-danh-muc`;
const offCategorySlug = `${prefix}-danh-muc-tat`;
const skuToken = token.toUpperCase();
let db: PrismaService | undefined;
let categoryId = '';

function assertTestDatabase() {
  let valid = false;
  try {
    const url = new URL(process.env['DATABASE_URL'] ?? '');
    valid = process.env['NODE_ENV'] === 'test' && ['postgres:', 'postgresql:'].includes(url.protocol)
      && decodeURIComponent(url.pathname).endsWith('_test');
  } catch { /* Do not print credentials. */ }
  if (!valid) throw new Error('Catalog list E2E requires NODE_ENV=test and a PostgreSQL *_test database');
}

function gridItems(page: Page) {
  return page.getByRole('list', { name: 'Danh sách sản phẩm' }).getByRole('listitem');
}

test.beforeAll(async () => {
  assertTestDatabase();
  db = new PrismaService(readEnvironment(process.env));
  const activeCategory = await db.category.create({ data: { name: 'Danh mục lưới công khai', slug: activeCategorySlug, active: true } });
  const offCategory = await db.category.create({ data: { name: 'Danh mục đã tắt', slug: offCategorySlug, active: false } });
  categoryId = activeCategory.id;
  await db.product.create({ data: { name: newName, slug: `${prefix}-moi`, description: '', categoryId, priceFrom: 250000,
    status: 'PUBLISHED', createdAt: new Date(),
    variants: { create: { sku: `GRID-${skuToken}-M`, size: 'M', color: 'đen', price: 250000, active: true, inventory: { create: {} } } } } });
  await db.product.create({ data: { name: oldName, slug: `${prefix}-cu`, description: '', categoryId, priceFrom: 200000,
    status: 'PUBLISHED', createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    variants: { create: { sku: `GRID-${skuToken}-S`, size: 'S', color: 'trắng', price: 200000, active: true, inventory: { create: {} } } } } });
  await db.product.create({ data: { name: hiddenName, slug: `${prefix}-an`, description: '', categoryId, priceFrom: 150000,
    status: 'HIDDEN', createdAt: new Date(),
    variants: { create: { sku: `GRID-${skuToken}-L`, size: 'L', color: 'xanh', price: 150000, active: true, inventory: { create: {} } } } } });
  await db.product.create({ data: { name: unlistedName, slug: `${prefix}-tat`, description: '', categoryId: offCategory.id, priceFrom: 180000,
    status: 'PUBLISHED', createdAt: new Date(),
    variants: { create: { sku: `GRID-${skuToken}-X`, size: 'FREESIZE', color: 'vàng', price: 180000, active: true, inventory: { create: {} } } } } });
});

test.afterAll(async () => {
  assertTestDatabase();
  if (!db) return;
  try {
    for (const slug of [`${prefix}-moi`, `${prefix}-cu`, `${prefix}-an`, `${prefix}-tat`]) {
      const product = await db.product.findUnique({ where: { slug } });
      if (product) {
        await db.inventory.deleteMany({ where: { variant: { productId: product.id } } });
        await db.productImage.deleteMany({ where: { productId: product.id } });
        await db.variant.deleteMany({ where: { productId: product.id } });
        await db.product.delete({ where: { id: product.id } });
      }
    }
    await db.category.deleteMany({ where: { slug: { in: [activeCategorySlug, offCategorySlug] } } });
  } finally { await db.$disconnect(); }
});

test('lists only published products of an active category, keyed by an impossible to collide token', async ({ page }) => {
  await page.goto(`/shop?q=${encodeURIComponent(token)}`);
  const items = gridItems(page);
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toHaveAccessibleName(newName);
  await expect(items.nth(1)).toHaveAccessibleName(oldName);
  await expect(page.getByText('Tìm thấy 2 sản phẩm.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: hiddenName })).toHaveCount(0);
  await expect(page.getByRole('link', { name: unlistedName })).toHaveCount(0);
  await expect(page.getByRole('link', { name: newName })).toHaveAttribute('href', `/products/${prefix}-moi`);
});

test('combined URL filters survive a reload and clearing returns the default newest view', async ({ page }) => {
  await page.goto(`/shop?q=${encodeURIComponent(token)}&categoryId=${categoryId}&sort=price-asc`);
  await expect(page.getByLabel('Tìm theo tên hoặc SKU')).toHaveValue(token);
  await expect(page.getByLabel('Danh mục')).toHaveValue(categoryId);
  await expect(page.getByLabel('Thứ tự sắp xếp')).toHaveValue('price-asc');
  await expect(gridItems(page)).toHaveCount(2);
  await expect(gridItems(page).nth(0)).toHaveAccessibleName(oldName);
  await expect(gridItems(page).nth(1)).toHaveAccessibleName(newName);
  await page.reload();
  await expect(gridItems(page)).toHaveCount(2);
  await page.getByRole('button', { name: 'Xóa lọc', exact: true }).click();
  await expect(page.getByLabel('Thứ tự sắp xếp')).toHaveValue('newest');
  await expect(gridItems(page).nth(0)).toHaveAccessibleName(newName);
});

test('explains an empty keyword result and recovers after a failed request', async ({ page }) => {
  await page.goto(`/shop?q=zzz-khong-co-${token}`);
  await expect(page.getByText('Chưa có sản phẩm phù hợp bộ lọc hiện tại.', { exact: true })).toBeVisible();
  await page.route('**/api/v1/products?*', (route) => { void route.abort(); });
  await page.goto('/shop');
  await expect(page.getByText('Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.', { exact: true })).toBeVisible();
  await page.unroute('**/api/v1/products?*');
  await page.getByRole('button', { name: 'Tải lại bộ sưu tập', exact: true }).click();
  await expect(gridItems(page)).toHaveCount(2);
});

test('keeps the newest product on top and stays within the viewport on mobile', async ({ page }, info) => {
  await page.goto('/shop');
  await expect(gridItems(page).nth(0)).toHaveAccessibleName(newName);
  await expect(gridItems(page).nth(1)).toHaveAccessibleName(oldName);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('catalog-list-mobile.png'), fullPage: true, animations: 'disabled' });
});

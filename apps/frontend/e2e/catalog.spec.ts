import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { hash } from 'argon2';
import { PrismaService } from '../../backend/dist/modules/prisma/prisma.service.js';
import { readEnvironment } from '../../backend/dist/config/environment.js';

const slug = `browser-${randomUUID()}`;
const email = `${slug}@example.test`;
const password = 'catalog-browser-password-123!';
let db: PrismaService;
test.beforeAll(async () => {
  if (process.env['NODE_ENV'] !== 'test' || !new URL(process.env['DATABASE_URL'] ?? '').pathname.endsWith('_test')) throw new Error('E2E requires test DB');
  db = new PrismaService(readEnvironment(process.env));
  await db.user.create({ data: { email, name: 'Admin browser', role: 'ADMIN', passwordHash: await hash(password), emailVerifiedAt: new Date() } });
});
test.afterAll(async () => {
  if (!db) return;
  try {
    const product = await db.product.findUnique({ where: { slug } });
    if (product) {
      await db.inventoryMovement.deleteMany({ where: { variant: { productId: product.id } } });
      await db.productImage.deleteMany({ where: { productId: product.id } });
      await db.inventory.deleteMany({ where: { variant: { productId: product.id } } });
      await db.variant.deleteMany({ where: { productId: product.id } });
      await db.product.delete({ where: { id: product.id } });
    }
    await db.category.deleteMany({ where: { slug } });
    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      const assets = await db.uploadAsset.findMany({ where: { ownerId: user.id } });
      await db.uploadAsset.deleteMany({ where: { ownerId: user.id } });
      for (const asset of assets) if (/^[0-9a-f-]{36}\.webp$/.test(asset.storageKey)) await unlink(path.resolve('../../.local/test-uploads', asset.storageKey)).catch(() => undefined);
      await db.session.deleteMany({ where: { sess: { path: ['userId'], equals: user.id } } });
      await db.user.delete({ where: { id: user.id } });
    }
  } finally { await db.$disconnect(); }
});

test('admin publishes actual product/image/stock; public filters/detail/mobile and hiding work', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('link', { name: 'Danh mục', exact: true }).click();
  await page.getByLabel('Tên danh mục', { exact: true }).fill('Bộ sưu tập thử');
  await page.getByLabel('Đường dẫn danh mục').fill(slug);
  await page.getByRole('button', { name: 'Thêm danh mục', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Đã lưu danh mục');
  const category = await db.category.findUniqueOrThrow({ where: { slug } });
  await page.goto('/admin/products');
  await page.getByRole('link', { name: 'Thêm sản phẩm', exact: true }).click();
  await page.getByLabel('Tên sản phẩm', { exact: true }).fill('Áo cotton trình duyệt');
  await page.getByLabel('Đường dẫn sản phẩm').fill(slug);
  await page.getByLabel('Danh mục', { exact: true }).selectOption(category.id);
  await page.getByLabel('SKU 1', { exact: true }).fill(`BROWSER-${randomUUID()}`);
  await page.getByLabel('Màu 1', { exact: true }).fill('Đen');
  await page.getByLabel('Giá 1 (VND)', { exact: true }).fill('250000');
  await page.getByRole('button', { name: 'Lưu sản phẩm', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/products$/);
  await expect(page.getByRole('alert')).toContainText('Đã tạo sản phẩm nháp');
  const product = await db.product.findUniqueOrThrow({ where: { slug } });
  await page.goto(`/admin/products/${product.id}`);
  await expect(page.getByRole('heading', { name: 'Sửa sản phẩm' })).toBeVisible();
  const image = await sharp({ create: { width: 300, height: 400, channels: 3, background: '#b5a78f' } }).png().toBuffer();
  await page.getByLabel('Tải ảnh sản phẩm').setInputFiles({ name: 'cotton.png', mimeType: 'image/png', buffer: image });
  await page.getByRole('button', { name: 'Lưu thứ tự ảnh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Đã lưu ảnh');
  const variant = await db.variant.findFirstOrThrow({ where: { product: { slug } } });
  await page.goto(`/admin/inventory?variantId=${variant.id}`);
  await page.getByRole('button', { name: `Điều chỉnh ${variant.sku}`, exact: true }).click();
  await page.getByLabel('Số lượng thay đổi').fill('10');
  await page.getByLabel('Lý do điều chỉnh').fill('Nhập hàng thử trên browser');
  await page.getByRole('button', { name: 'Lưu điều chỉnh', exact: true }).click();
  await expect(page.getByText('Khả dụng: 10', { exact: true })).toBeVisible();
  await page.goto(`/admin/products/${product.id}`);
  await page.getByRole('button', { name: 'Xuất bản', exact: true }).click();
  await expect(page.getByText('Đã xuất bản sản phẩm.')).toBeVisible();
  await page.goto(`/shop?categoryId=${category.id}&q=${encodeURIComponent('cotton trình duyệt')}&sort=price-asc`);
  await page.getByRole('link', { name: 'Áo cotton trình duyệt', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Áo cotton trình duyệt', exact: true })).toBeVisible();
  await page.getByRole('group', { name: 'Chọn size' }).getByRole('button', { name: 'M', exact: true }).click();
  await expect(page.getByText('Còn 10 sản phẩm', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/catalog-mobile.png', fullPage: true });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Áo cotton trình duyệt', exact: true })).toBeVisible();
  await page.goto(`/admin/products/${product.id}`);
  await page.getByRole('button', { name: 'Ẩn sản phẩm', exact: true }).click();
  await expect(page.getByText('Đã ẩn sản phẩm.')).toBeVisible();
  await page.goto(`/products/${slug}`);
  await expect(page.getByRole('alert')).toContainText('Không tìm thấy sản phẩm');
});

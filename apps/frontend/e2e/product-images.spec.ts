import { expect, test, type Page } from '@playwright/test';
import { hash } from 'argon2';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { PrismaService } from '../../backend/dist/modules/prisma/prisma.service.js';
import { readEnvironment } from '../../backend/dist/config/environment.js';

const prefix = `images-${randomUUID()}`;
const adminEmail = `${prefix}-admin@example.test`;
const password = 'images-e2e-only-password-123!';
const slugs = [`${prefix}-attach`, `${prefix}-order`] as const;
let categoryId = '';
let db: PrismaService | undefined;

function assertTestDatabase() {
  let valid = false;
  try {
    const url = new URL(process.env['DATABASE_URL'] ?? '');
    valid = process.env['NODE_ENV'] === 'test' && ['postgres:', 'postgresql:'].includes(url.protocol)
      && decodeURIComponent(url.pathname).endsWith('_test');
  } catch { /* Do not print credentials. */ }
  if (!valid) throw new Error('Product image E2E requires NODE_ENV=test and a PostgreSQL *_test database');
}

async function createDraft(name: string, slug: string) {
  if (!db) throw new Error('Missing test DB');
  return db.product.create({ data: { name, slug, description: '', categoryId, priceFrom: 250000,
    variants: { create: { sku: `IMG-${randomUUID()}`.toUpperCase(), size: 'M', color: 'be', price: 250000, active: true, inventory: { create: {} } } } } });
}

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(adminEmail);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

function png(background: string) {
  return sharp({ create: { width: 300, height: 400, channels: 3, background } }).png().toBuffer();
}

test.beforeAll(async () => {
  assertTestDatabase();
  db = new PrismaService(readEnvironment(process.env));
  await db.user.create({ data: { email: adminEmail, name: 'Admin ảnh thử', role: 'ADMIN', passwordHash: await hash(password), emailVerifiedAt: new Date() } });
  const category = await db.category.create({ data: { name: 'Danh mục ảnh thử', slug: `${prefix}-category`, active: true } });
  categoryId = category.id;
});

test.afterAll(async () => {
  assertTestDatabase();
  if (!db) return;
  try {
    const products = await db.product.findMany({ where: { slug: { in: [...slugs] } }, select: { id: true } });
    const productIds = products.map((product) => product.id);
    await db.productImage.deleteMany({ where: { productId: { in: productIds } } });
    await db.inventory.deleteMany({ where: { variant: { productId: { in: productIds } } } });
    await db.variant.deleteMany({ where: { productId: { in: productIds } } });
    await db.product.deleteMany({ where: { id: { in: productIds } } });
    if (categoryId) await db.category.delete({ where: { id: categoryId } });
    const user = await db.user.findUnique({ where: { email: adminEmail } });
    if (user) {
      // Only assets uploaded by this run's admin; their WebP files live in the test upload folder.
      const assets = await db.uploadAsset.findMany({ where: { ownerId: user.id } });
      await db.uploadAsset.deleteMany({ where: { ownerId: user.id } });
      for (const asset of assets) {
        if (/^[0-9a-f-]{36}\.webp$/.test(asset.storageKey)) await unlink(path.resolve('../../.local/test-uploads', asset.storageKey)).catch(() => undefined);
      }
      await db.session.deleteMany({ where: { sess: { path: ['userId'], equals: user.id } } });
      await db.user.delete({ where: { id: user.id } });
    }
  } finally { await db.$disconnect(); }
});

test('admin uploads a real image, rejects fake bytes, attaches it and keeps the info draft saveable', async ({ page }, info) => {
  test.setTimeout(60000);
  if (!db) throw new Error('Missing test DB');
  const draft = await createDraft('Áo có ảnh thử', slugs[0]);
  await loginAsAdmin(page);
  await page.goto(`/admin/products/${draft.id}`);
  await expect(page.getByText('Sản phẩm chưa có ảnh. Cần ít nhất một ảnh trước khi xuất bản.')).toBeVisible();
  await page.getByLabel('Tải ảnh sản phẩm').setInputFiles({ name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('<svg></svg>') });
  await expect(page.getByRole('alert')).toContainText('Chỉ nhận JPEG, PNG, WebP tĩnh');
  await page.getByLabel('Tải ảnh sản phẩm').setInputFiles({ name: 'ao.png', mimeType: 'image/png', buffer: await png('#b5a78f') });
  await expect(page.getByRole('img', { name: 'Ảnh 1 của Áo có ảnh thử (chưa lưu)' })).toBeVisible();
  await page.getByLabel('Tên sản phẩm', { exact: true }).fill('Áo có ảnh đã sửa');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Lưu thứ tự ảnh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Đã lưu ảnh');
  const attached = await db.product.findUniqueOrThrow({ where: { id: draft.id }, include: { images: true } });
  expect(attached.version).toBe(1);
  expect(attached.images).toHaveLength(1);
  expect(attached.images[0]?.position).toBe(0);
  await expect(page.getByLabel('Tên sản phẩm', { exact: true })).toHaveValue('Áo có ảnh đã sửa');
  await page.screenshot({ path: info.outputPath('product-images-mobile.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/products$/);
  expect(await db.product.findUniqueOrThrow({ where: { id: draft.id } })).toMatchObject({ name: 'Áo có ảnh đã sửa', version: 2 });
  await page.goto(`/admin/products/${draft.id}`);
  const thumbnail = page.getByRole('img', { name: 'Ảnh 1 của Áo có ảnh đã sửa', exact: true });
  await expect(thumbnail).toBeVisible();
  await expect.poll(() => thumbnail.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  const assetId = attached.images[0]?.assetId ?? '';
  // The public media route serves only images of published products, so a draft image stays private.
  const media = await page.request.get(`/api/v1/media/${assetId}`);
  expect(media.status()).toBe(404);
});

test('admin reorders attached images, removes one after an undo, and the saved order survives refresh', async ({ page }, info) => {
  test.setTimeout(60000);
  if (!db) throw new Error('Missing test DB');
  const draft = await createDraft('Áo nhiều ảnh thử', slugs[1]);
  const positions = async () => (await db?.productImage.findMany({ where: { productId: draft.id }, orderBy: { position: 'asc' } }) ?? [])
    .map((image) => image.assetId);
  await loginAsAdmin(page);
  await page.goto(`/admin/products/${draft.id}`);
  await page.getByLabel('Tải ảnh sản phẩm').setInputFiles({ name: 'do.png', mimeType: 'image/png', buffer: await png('#a33b3b') });
  await expect(page.getByRole('img', { name: 'Ảnh 1 của Áo nhiều ảnh thử (chưa lưu)' })).toBeVisible();
  await page.getByLabel('Tải ảnh sản phẩm').setInputFiles({ name: 'xanh.png', mimeType: 'image/png', buffer: await png('#3b5ba3') });
  await expect(page.getByRole('img', { name: 'Ảnh 2 của Áo nhiều ảnh thử (chưa lưu)' })).toBeVisible();
  await page.getByRole('button', { name: 'Lưu thứ tự ảnh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Đã lưu ảnh');
  const [red, blue] = await positions();
  if (!red || !blue) throw new Error('Expected two attached images');

  await page.getByRole('button', { name: 'Đưa ảnh 2 lên trước', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Ảnh 1 của Áo nhiều ảnh thử', exact: true })).toHaveAttribute('src', new RegExp(`${blue}$`));
  await page.getByRole('button', { name: 'Lưu thứ tự ảnh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Đã lưu ảnh');
  expect(await positions()).toEqual([blue, red]);

  await page.reload();
  await expect(page.getByRole('img', { name: 'Ảnh 1 của Áo nhiều ảnh thử', exact: true })).toHaveAttribute('src', new RegExp(`${blue}$`));
  await expect(page.getByText('Ảnh chính', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Gỡ ảnh 2', exact: true }).click();
  await expect(page.getByText('Ảnh đã gỡ sẽ không khôi phục được sau khi lưu.')).toBeVisible();
  await page.getByRole('button', { name: 'Hủy thay đổi ảnh', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Ảnh 2 của Áo nhiều ảnh thử', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Gỡ ảnh 2', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('product-images-order-mobile.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Lưu thứ tự ảnh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Đã lưu ảnh');
  expect(await positions()).toEqual([blue]);
  expect(await db.product.findUniqueOrThrow({ where: { id: draft.id } })).toMatchObject({ version: 3 });

  await page.reload();
  await expect(page.getByRole('img')).toHaveCount(1);
  await expect(page.getByRole('img', { name: 'Ảnh 1 của Áo nhiều ảnh thử', exact: true })).toHaveAttribute('src', new RegExp(`${blue}$`));
});

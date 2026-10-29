import { expect, test, type Page } from '@playwright/test';
import { hash } from 'argon2';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { PrismaService } from '../../backend/dist/modules/prisma/prisma.service.js';
import { readEnvironment } from '../../backend/dist/config/environment.js';

const prefix = `status-${randomUUID()}`;
const adminEmail = `${prefix}-admin@example.test`;
const customerEmail = `${prefix}-customer@example.test`;
const password = 'status-e2e-only-password-123!';
const slug = `${prefix}-product`;
const productName = `Áo trạng thái ${prefix.slice(-8)}`;
const origin = 'http://127.0.0.1:5174';
let categoryId = '';
let db: PrismaService | undefined;

function assertTestDatabase() {
  let valid = false;
  try {
    const url = new URL(process.env['DATABASE_URL'] ?? '');
    valid = process.env['NODE_ENV'] === 'test' && ['postgres:', 'postgresql:'].includes(url.protocol)
      && decodeURIComponent(url.pathname).endsWith('_test');
  } catch { /* Do not print credentials. */ }
  if (!valid) throw new Error('Product status E2E requires NODE_ENV=test and a PostgreSQL *_test database');
}

async function login(page: Page, email: string, landing: RegExp) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(landing);
}

test.beforeAll(async () => {
  assertTestDatabase();
  db = new PrismaService(readEnvironment(process.env));
  const passwordHash = await hash(password);
  await db.user.createMany({ data: [
    { email: adminEmail, name: 'Admin trạng thái thử', role: 'ADMIN', passwordHash, emailVerifiedAt: new Date() },
    { email: customerEmail, name: 'Khách trạng thái thử', role: 'CUSTOMER', passwordHash, emailVerifiedAt: new Date() },
  ] });
  const category = await db.category.create({ data: { name: 'Danh mục trạng thái thử', slug: `${prefix}-category`, active: true } });
  categoryId = category.id;
});

test.afterAll(async () => {
  assertTestDatabase();
  if (!db) return;
  try {
    const product = await db.product.findUnique({ where: { slug } });
    if (product) {
      await db.productImage.deleteMany({ where: { productId: product.id } });
      await db.inventory.deleteMany({ where: { variant: { productId: product.id } } });
      await db.variant.deleteMany({ where: { productId: product.id } });
      await db.product.delete({ where: { id: product.id } });
    }
    if (categoryId) await db.category.delete({ where: { id: categoryId } });
    const users = await db.user.findMany({ where: { email: { in: [adminEmail, customerEmail] } }, select: { id: true } });
    for (const user of users) {
      // Only assets uploaded by this run's users; their WebP files live in the test upload folder.
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

test('admin publishes only a ready, saved product; hide and republish follow public visibility and the server rechecks rules', async ({ page }, info) => {
  test.setTimeout(90000);
  if (!db) throw new Error('Missing test DB');
  const draft = await db.product.create({ data: { name: productName, slug, description: '', categoryId, priceFrom: 250000,
    variants: { create: { sku: `ST-${randomUUID()}`.toUpperCase(), size: 'M', color: 'đen', price: 250000, active: true, inventory: { create: {} } } } } });
  const publish = page.getByRole('button', { name: 'Xuất bản', exact: true });
  await login(page, adminEmail, /\/admin$/);
  await page.goto(`/admin/products/${draft.id}`);
  await expect(page.getByText('Nháp', { exact: true })).toBeVisible();
  await expect(publish).toBeDisabled();
  await expect(page.getByText('Chưa đạt', { exact: true })).toHaveCount(1);

  const image = await sharp({ create: { width: 300, height: 400, channels: 3, background: '#6b8f71' } }).png().toBuffer();
  await page.getByLabel('Tải ảnh sản phẩm').setInputFiles({ name: 'ao.png', mimeType: 'image/png', buffer: image });
  await expect(publish).toBeDisabled();
  await page.getByRole('button', { name: 'Lưu thứ tự ảnh', exact: true }).click();
  await expect(page.getByText('Đã lưu ảnh sản phẩm.')).toBeVisible();
  await expect(publish).toBeEnabled();

  const name = page.getByLabel('Tên sản phẩm', { exact: true });
  await name.fill('Tên chưa lưu');
  await expect(publish).toBeDisabled();
  await expect(page.getByText('Lưu hoặc hủy các thay đổi đang nhập trước khi xuất bản.')).toBeVisible();
  await name.fill(productName);
  await expect(publish).toBeEnabled();
  await publish.click();
  await expect(page.getByText('Đã xuất bản sản phẩm.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sửa sản phẩm đang bán', level: 1 })).toBeVisible();
  await expect(page.getByLabel('Tên sản phẩm', { exact: true })).toBeVisible();
  const published = await db.product.findUniqueOrThrow({ where: { id: draft.id }, include: { images: true } });
  expect(published).toMatchObject({ status: 'PUBLISHED', version: 2 });
  const assetId = published.images[0]?.assetId ?? '';
  expect((await page.request.get(`/api/v1/products/${slug}`)).status()).toBe(200);
  const listed: { items: { slug: string }[] } = await (await page.request.get(`/api/v1/products?q=${encodeURIComponent(productName)}`)).json();
  expect(listed.items.map((item) => item.slug)).toContain(slug);
  expect((await page.request.get(`/api/v1/media/${assetId}`)).status()).toBe(200);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('product-status-mobile.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Ẩn sản phẩm', exact: true }).click();
  await expect(page.getByText('Đã ẩn sản phẩm.')).toBeVisible();
  expect(await db.product.findUniqueOrThrow({ where: { id: draft.id } })).toMatchObject({ status: 'HIDDEN', version: 3 });
  expect((await page.request.get(`/api/v1/products/${slug}`)).status()).toBe(404);
  expect((await page.request.get(`/api/v1/media/${assetId}`)).status()).toBe(404);

  await page.goto('/admin/products');
  await page.getByRole('link', { name: `Quản lý ${productName}`, exact: true }).click();
  await expect(page.getByText('Đã ẩn', { exact: true })).toBeVisible();
  // Let the page finish loading categories first, so it still believes the category is active; the server must recheck and refuse.
  await expect(page.getByText('Chưa đạt', { exact: true })).toHaveCount(0);
  await expect(publish).toBeEnabled();
  await db.category.update({ where: { id: categoryId }, data: { active: false } });
  await publish.click();
  await expect(page.getByText('Cần danh mục bật, ít nhất một ảnh và một biến thể bật để xuất bản.')).toBeVisible();
  expect(await db.product.findUniqueOrThrow({ where: { id: draft.id } })).toMatchObject({ status: 'HIDDEN', version: 3 });
  await db.category.update({ where: { id: categoryId }, data: { active: true } });
  await publish.click();
  await expect(page.getByText('Đã xuất bản sản phẩm.')).toBeVisible();
  expect(await db.product.findUniqueOrThrow({ where: { id: draft.id } })).toMatchObject({ status: 'PUBLISHED', version: 4 });
  expect((await page.request.get(`/api/v1/products/${slug}`)).status()).toBe(200);
});

test('anonymous and CUSTOMER cannot publish or hide products', async ({ page }) => {
  const target = randomUUID();
  const anonymous: { csrfToken: string } = await (await page.request.get('/api/v1/auth/csrf')).json();
  for (const action of ['publish', 'hide']) {
    expect((await page.request.post(`/api/v1/admin/products/${target}/${action}`, { data: { expectedVersion: 0 },
      headers: { Origin: origin, 'X-CSRF-Token': anonymous.csrfToken } })).status()).toBe(401);
  }
  await login(page, customerEmail, /\/account$/);
  const token: { csrfToken: string } = await (await page.request.get('/api/v1/auth/csrf')).json();
  for (const action of ['publish', 'hide']) {
    expect((await page.request.post(`/api/v1/admin/products/${target}/${action}`, { data: { expectedVersion: 0 },
      headers: { Origin: origin, 'X-CSRF-Token': token.csrfToken } })).status()).toBe(403);
  }
});

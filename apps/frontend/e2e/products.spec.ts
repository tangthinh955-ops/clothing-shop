import { expect, test } from '@playwright/test';
import { hash } from 'argon2';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../backend/dist/modules/prisma/prisma.service.js';
import { readEnvironment } from '../../backend/dist/config/environment.js';

const prefix = `products-${randomUUID()}`;
const adminEmail = `${prefix}-admin@example.test`;
const customerEmail = `${prefix}-customer@example.test`;
const password = 'products-e2e-only-password-123!';
const slugs = [`${prefix}-one`, `${prefix}-two`, `${prefix}-edit`, `${prefix}-tab`, `${prefix}-blocked`, `${prefix}-sku-owner`] as const;
const sku = `M33-${randomUUID()}`;
// Valid boundary: 64 characters without hyphens or other natural wrap points.
const editSku = 'W'.repeat(32) + randomUUID().replaceAll('-', '').toUpperCase();
const publishedSku = `M341P-${randomUUID()}`.toUpperCase();
const tabSku = `M341T-${randomUUID()}`.toUpperCase();
const addedSku = `M342A-${randomUUID()}`.toUpperCase();
const takenSku = `M342T-${randomUUID()}`.toUpperCase();
let categoryId = '';
let db: PrismaService | undefined;

function assertTestDatabase() {
  let valid = false;
  try {
    const url = new URL(process.env['DATABASE_URL'] ?? '');
    valid = process.env['NODE_ENV'] === 'test' && ['postgres:', 'postgresql:'].includes(url.protocol)
      && decodeURIComponent(url.pathname).endsWith('_test');
  } catch { /* Do not print credentials. */ }
  if (!valid) throw new Error('Product E2E requires NODE_ENV=test and a PostgreSQL *_test database');
}

test.beforeAll(async () => {
  assertTestDatabase();
  db = new PrismaService(readEnvironment(process.env));
  const passwordHash = await hash(password);
  await db.user.createMany({ data: [
    { email: adminEmail, name: 'Admin sản phẩm thử', role: 'ADMIN', passwordHash, emailVerifiedAt: new Date() },
    { email: customerEmail, name: 'Khách sản phẩm thử', role: 'CUSTOMER', passwordHash, emailVerifiedAt: new Date() },
  ] });
  const category = await db.category.create({ data: { name: 'Danh mục sản phẩm thử', slug: `${prefix}-category`, active: true } });
  categoryId = category.id;
});

test.afterAll(async () => {
  assertTestDatabase();
  if (!db) return;
  try {
    const products = await db.product.findMany({ where: { slug: { in: [...slugs] } }, select: { id: true } });
    const productIds = products.map((product) => product.id);
    await db.inventory.deleteMany({ where: { variant: { productId: { in: productIds } } } });
    await db.variant.deleteMany({ where: { productId: { in: productIds } } });
    await db.product.deleteMany({ where: { id: { in: productIds } } });
    if (categoryId) await db.category.delete({ where: { id: categoryId } });
    const users = await db.user.findMany({ where: { email: { in: [adminEmail, customerEmail] } }, select: { id: true } });
    for (const user of users) {
      await db.session.deleteMany({ where: { sess: { path: ['userId'], equals: user.id } } });
      await db.user.delete({ where: { id: user.id } });
    }
  } finally { await db.$disconnect(); }
});

async function login(page: import('@playwright/test').Page, email: string) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  const [response] = await Promise.all([
    page.waitForResponse((answer) => {
      const path = new URL(answer.url()).pathname;
      return path === '/api/v1/auth/login' || (path === '/api/v1/auth/csrf' && !answer.ok());
    }),
    page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(),
  ]);
  expect(response.status(), `Login API: ${new URL(response.url()).pathname}`).toBe(200);
}

test('admin creates one-variant drafts, persists through refresh, handles duplicate identifiers and keeps drafts private', async ({ page }, info) => {
  test.setTimeout(60000); // Several create attempts exercise native validation and two unique constraints.
  await page.goto('/login');
  await login(page, adminEmail);
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('link', { name: 'Sản phẩm', exact: true }).click();
  await page.getByRole('link', { name: 'Thêm sản phẩm', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Tên sản phẩm', { exact: true }).fill('Áo cotton nháp thử');
  await page.getByLabel('Đường dẫn sản phẩm', { exact: true }).fill(slugs[0]);
  await page.getByLabel('Danh mục', { exact: true }).selectOption(categoryId);
  await page.getByLabel('Mô tả', { exact: true }).fill('Mô tả sản phẩm dùng thử');
  await page.getByLabel('SKU 1', { exact: true }).fill(sku.toLowerCase());
  await page.getByLabel('Size 1', { exact: true }).selectOption('M');
  await page.getByLabel('Màu 1', { exact: true }).fill('Đen');
  await page.getByLabel('Giá 1 (VND)', { exact: true }).fill('1.5');
  await page.getByRole('button', { name: 'Lưu sản phẩm', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/products\/new$/);
  expect(await page.getByLabel('Giá 1 (VND)', { exact: true }).evaluate((element) => element instanceof HTMLInputElement && !element.validity.valid)).toBe(true);
  await page.getByLabel('Giá 1 (VND)', { exact: true }).fill('250000');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('product-create-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Lưu sản phẩm', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/products$/);
  await expect(page.getByRole('heading', { name: 'Áo cotton nháp thử', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Áo cotton nháp thử', exact: true })).toBeVisible();
  await expect(page.getByText(sku.toUpperCase(), { exact: true })).toBeVisible();
  if (!db) throw new Error('Missing test DB');
  const saved = await db.product.findUniqueOrThrow({ where: { slug: slugs[0] }, include: { variants: { include: { inventory: true } } } });
  expect(saved.status).toBe('DRAFT');
  expect(saved.variants).toHaveLength(1);
  expect(saved.variants[0]).toMatchObject({ sku: sku.toUpperCase(), size: 'M', color: 'đen', price: expect.anything(), active: true,
    inventory: { onHand: 0, reserved: 0 } });
  expect(Number(saved.variants[0]?.price)).toBe(250000);
  const publicList: { items: { id: string }[] } = await (await page.request.get('/api/v1/products')).json();
  expect(publicList.items.some((row) => row.id === saved.id)).toBe(false);
  expect((await page.request.get(`/api/v1/products/${slugs[0]}`)).status()).toBe(404);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('products-list-mobile.png'), fullPage: true });

  await page.getByRole('link', { name: 'Thêm sản phẩm', exact: true }).click();
  await page.getByLabel('Tên sản phẩm', { exact: true }).fill('Áo cotton nháp thứ hai');
  await page.getByLabel('Đường dẫn sản phẩm', { exact: true }).fill(slugs[1]);
  await page.getByLabel('Danh mục', { exact: true }).selectOption(categoryId);
  await page.getByLabel('SKU 1', { exact: true }).fill(sku);
  await page.getByLabel('Màu 1', { exact: true }).fill('Trắng');
  await page.getByLabel('Giá 1 (VND)', { exact: true }).fill('270000');
  await page.getByRole('button', { name: 'Lưu sản phẩm', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('đã được sử dụng');
  await expect(page.getByLabel('Tên sản phẩm', { exact: true })).toHaveValue('Áo cotton nháp thứ hai');
  await page.getByLabel('SKU 1', { exact: true }).fill(`${sku}-SECOND`);
  await page.getByLabel('Đường dẫn sản phẩm', { exact: true }).fill(slugs[0]);
  await page.getByRole('button', { name: 'Lưu sản phẩm', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('đã được sử dụng');
  await page.getByLabel('Đường dẫn sản phẩm', { exact: true }).fill(slugs[1]);
  await page.getByRole('button', { name: 'Lưu sản phẩm', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/products$/);
  await expect(page.getByRole('heading', { name: 'Áo cotton nháp thứ hai', exact: true })).toBeVisible();
  expect(await db.product.count({ where: { slug: { in: [...slugs] } } })).toBe(2);
});

test('anonymous and CUSTOMER cannot list or create admin products', async ({ page }) => {
  await page.goto('/admin/products/new');
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get('/api/v1/admin/products')).status()).toBe(401);
  const anonymousToken: { csrfToken: string } = await (await page.request.get('/api/v1/auth/csrf')).json();
  const payload = { name: 'Không được tạo', slug: slugs[0], description: '', categoryId,
    variants: [{ sku, size: 'M', color: 'đen', price: 250000, active: true }] };
  const patchPayload = { name: 'Không được sửa', slug: slugs[0], description: '', categoryId,
    variants: [{ id: randomUUID(), sku, size: 'M', color: 'đen', price: 250000, active: true }], expectedVersion: 0 };
  expect((await page.request.post('/api/v1/admin/products', { data: payload,
    headers: { Origin: 'http://127.0.0.1:5174', 'X-CSRF-Token': anonymousToken.csrfToken },
  })).status()).toBe(401);
  expect((await page.request.patch(`/api/v1/admin/products/${randomUUID()}`, { data: patchPayload,
    headers: { Origin: 'http://127.0.0.1:5174', 'X-CSRF-Token': anonymousToken.csrfToken },
  })).status()).toBe(401);
  await login(page, customerEmail);
  await expect(page).toHaveURL(/\/account$/);
  await page.goto('/admin/products');
  await expect(page).toHaveURL(/\/account$/);
  await page.goto('/admin/products/new');
  await expect(page).toHaveURL(/\/account$/);
  expect((await page.request.get('/api/v1/admin/products')).status()).toBe(403);
  const token: { csrfToken: string } = await (await page.request.get('/api/v1/auth/csrf')).json();
  expect((await page.request.post('/api/v1/admin/products', { data: payload,
    headers: { Origin: 'http://127.0.0.1:5174', 'X-CSRF-Token': token.csrfToken },
  })).status()).toBe(403);
  expect((await page.request.patch(`/api/v1/admin/products/${randomUUID()}`, { data: patchPayload,
    headers: { Origin: 'http://127.0.0.1:5174', 'X-CSRF-Token': token.csrfToken },
  })).status()).toBe(403);
});

test('admin edits draft variants: keeps ids and stock, adds a variant, turns one off and gets server conflicts for taken SKUs', async ({ page }, info) => {
  test.setTimeout(60000);
  if (!db) throw new Error('Missing test DB');
  const draft = await db.product.create({ data: { name: 'Áo cotton cần sửa thử', slug: slugs[2], description: 'Mô tả trước khi sửa', categoryId,
    priceFrom: 250000, variants: { create: { sku: editSku, size: 'M', color: 'đen', price: 250000, active: true, inventory: { create: {} } } } } });
  await db.product.create({ data: { name: 'Sản phẩm giữ SKU thử', slug: slugs[5], description: '', categoryId,
    priceFrom: 100000, variants: { create: { sku: takenSku, size: 'M', color: 'xám', price: 100000, active: true, inventory: { create: {} } } } } });
  const variant = await db.variant.findUniqueOrThrow({ where: { sku: editSku } });
  await page.goto('/login');
  await login(page, adminEmail);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/products');
  await page.getByRole('link', { name: 'Sửa Áo cotton cần sửa thử', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/products/${draft.id}$`));
  await expect(page.getByLabel('Tên sản phẩm', { exact: true })).toHaveValue('Áo cotton cần sửa thử');
  await expect(page.getByLabel('Đường dẫn sản phẩm', { exact: true })).toHaveValue(slugs[2]);
  await expect(page.getByLabel('Danh mục', { exact: true })).toHaveValue(categoryId);
  await expect(page.getByLabel('Mô tả', { exact: true })).toHaveValue('Mô tả trước khi sửa');
  await expect(page.getByLabel('SKU 1', { exact: true })).toHaveValue(editSku);
  await expect(page.getByLabel('Giá 1 (VND)', { exact: true })).toHaveValue('250000');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Tên sản phẩm', { exact: true }).fill('Áo cotton đã sửa thử');
  await page.getByLabel('Mô tả', { exact: true }).fill('Mô tả đã sửa thử');
  await page.getByLabel('Giá 1 (VND)', { exact: true }).fill('199000');
  await page.getByRole('button', { name: 'Thêm biến thể', exact: true }).click();
  await page.getByLabel('SKU 2', { exact: true }).fill(takenSku);
  await page.getByLabel('Size 2', { exact: true }).selectOption('L');
  await page.getByLabel('Màu 2', { exact: true }).fill('đen');
  await page.getByLabel('Giá 2 (VND)', { exact: true }).fill('260000');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('product-edit-variants-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByText('Sản phẩm đã thay đổi, hoặc đường dẫn, SKU hoặc tổ hợp size/màu bị trùng. Hãy tải dữ liệu mới, kiểm tra lại rồi thử lại.')).toBeVisible();
  await expect(page.getByLabel('SKU 2', { exact: true })).toHaveValue(takenSku);
  await expect(page.getByLabel('Giá 1 (VND)', { exact: true })).toHaveValue('199000');
  const unchanged = await db.product.findUniqueOrThrow({ where: { id: draft.id }, include: { variants: true } });
  expect(unchanged.version).toBe(0);
  expect(unchanged.variants).toHaveLength(1);
  expect(Number(unchanged.variants[0]?.price)).toBe(250000);
  await page.getByLabel('SKU 2', { exact: true }).fill(addedSku);
  await page.getByLabel('Bật biến thể 1', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/products$/);
  await expect(page.getByText('Đã cập nhật sản phẩm “Áo cotton đã sửa thử”.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Áo cotton đã sửa thử', exact: true })).toBeVisible();
  const saved = await db.product.findUniqueOrThrow({ where: { id: draft.id }, include: { variants: { include: { inventory: true } } } });
  expect(saved).toMatchObject({ name: 'Áo cotton đã sửa thử', description: 'Mô tả đã sửa thử', status: 'DRAFT', version: 1, slug: slugs[2] });
  expect(Number(saved.priceFrom)).toBe(260000);
  expect(saved.variants).toHaveLength(2);
  const original = saved.variants.find((row) => row.id === variant.id);
  expect(original).toMatchObject({ sku: editSku, size: 'M', color: 'đen', active: false, inventory: { onHand: 0, reserved: 0 } });
  expect(Number(original?.price)).toBe(199000);
  const added = saved.variants.find((row) => row.sku === addedSku);
  expect(added).toMatchObject({ size: 'L', color: 'đen', active: true, inventory: { onHand: 0, reserved: 0 } });
  expect(Number(added?.price)).toBe(260000);
  await page.goto(`/admin/products/${draft.id}`);
  await expect(page.getByLabel('SKU 1', { exact: true })).toHaveValue(addedSku);
  await expect(page.getByLabel('Bật biến thể 2', { exact: true })).not.toBeChecked();
  await expect(page.getByRole('button', { name: /Bỏ biến thể mới/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('two tabs editing the same draft: the stale one is rejected and only rebases through Tải dữ liệu mới', async ({ page, context }) => {
  test.setTimeout(60000);
  if (!db) throw new Error('Missing test DB');
  const draft = await db.product.create({ data: { name: 'Áo hai tab thử', slug: slugs[3], description: '', categoryId,
    priceFrom: 250000, variants: { create: { sku: tabSku, size: 'L', color: 'trắng', price: 300000, active: true, inventory: { create: {} } } } } });
  await page.goto('/login');
  await login(page, adminEmail);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(`/admin/products/${draft.id}`);
  const first = page.getByRole('form', { name: 'Sửa sản phẩm nháp', exact: true });
  await expect(first.getByLabel('Tên sản phẩm', { exact: true })).toHaveValue('Áo hai tab thử');
  await first.getByLabel('Tên sản phẩm', { exact: true }).fill('Bản nhập tab một');
  const other = await context.newPage();
  try {
    await other.goto(`/admin/products/${draft.id}`);
    const second = other.getByRole('form', { name: 'Sửa sản phẩm nháp', exact: true });
    await second.getByLabel('Tên sản phẩm', { exact: true }).fill('Tab hai đã lưu');
    await second.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await expect(other).toHaveURL(/\/admin\/products$/);
    await page.bringToFront();
    await first.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await expect(page.getByText('Sản phẩm đã thay đổi, hoặc đường dẫn, SKU hoặc tổ hợp size/màu bị trùng. Hãy tải dữ liệu mới, kiểm tra lại rồi thử lại.')).toBeVisible();
    await expect(first.getByLabel('Tên sản phẩm', { exact: true })).toHaveValue('Bản nhập tab một');
    expect(await db.product.findUniqueOrThrow({ where: { id: draft.id } })).toMatchObject({ name: 'Tab hai đã lưu', version: 1 });
    await page.getByRole('button', { name: 'Tải dữ liệu mới', exact: true }).click();
    await expect(first.getByLabel('Tên sản phẩm', { exact: true })).toHaveValue('Tab hai đã lưu');
    await first.getByLabel('Tên sản phẩm', { exact: true }).fill('Tab một lưu sau khi tải mới');
    await first.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);
    await expect(page.getByText('Đã cập nhật sản phẩm “Tab một lưu sau khi tải mới”.')).toBeVisible();
    expect(await db.product.findUniqueOrThrow({ where: { id: draft.id } })).toMatchObject({ name: 'Tab một lưu sau khi tải mới', version: 2 });
  } finally { await other.close(); }
});

test('admin edits a published product and the shop shows the change at once', async ({ page }) => {
  if (!db) throw new Error('Missing test DB');
  const published = await db.product.create({ data: { name: 'Áo đã xuất bản thử', slug: slugs[4], description: '', categoryId,
    status: 'PUBLISHED', priceFrom: 250000,
    variants: { create: { sku: publishedSku, size: 'M', color: 'xanh', price: 250000, active: true, inventory: { create: {} } } } } });
  await page.goto('/login');
  await login(page, adminEmail);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(`/admin/products/${published.id}`);
  await expect(page.getByRole('heading', { name: 'Sửa sản phẩm đang bán', level: 1 })).toBeVisible();
  await expect(page.getByText(/Khách đang xem sản phẩm này/)).toBeVisible();
  await page.getByLabel('Tên sản phẩm', { exact: true }).fill('Áo đang bán đã sửa thử');
  await page.getByLabel('Giá 1 (VND)', { exact: true }).fill('270000');
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByText('Đã cập nhật sản phẩm “Áo đang bán đã sửa thử”.')).toBeVisible();
  expect(await db.product.findUniqueOrThrow({ where: { id: published.id } })).toMatchObject({ status: 'PUBLISHED', version: 1 });
  await page.goto(`/products/${slugs[4]}`);
  await expect(page.getByRole('heading', { name: 'Áo đang bán đã sửa thử', exact: true })).toBeVisible();
  await expect(page.getByText(/^270\.000\s*₫$/)).toBeVisible();
});

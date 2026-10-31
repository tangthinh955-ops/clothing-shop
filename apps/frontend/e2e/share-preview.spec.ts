import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../backend/dist/modules/prisma/prisma.service.js';
import { readEnvironment } from '../../backend/dist/config/environment.js';
import { hashPassword } from '../../backend/dist/modules/auth/auth.service.js';

const tag = randomUUID();
const slug = `share-e2e-${tag}`;
const name = `Áo share ${tag.slice(0, 8)}`;
let db: PrismaService;
let userId = '';
let categoryId = '';
let productId = '';
let assetId = '';

// The share preview fixture owns an image, and UploadAsset.ownerId is required, so an ADMIN user
// exists only inside the isolated runner database and is removed afterwards.
function assertOwnedDatabase() {
  const url = new URL(process.env['DATABASE_URL'] ?? '');
  const database = decodeURIComponent(url.pathname.slice(1));
  if (process.env['NODE_ENV'] !== 'test' || !['postgres:', 'postgresql:'].includes(url.protocol)
    || database !== process.env['CLOTHING_TEST_DATABASE'] || !/^clothing_e2e_[0-9a-f]{16}_test$/.test(database)) {
    throw new Error('Share preview E2E requires the isolated test runner database.');
  }
}

test.beforeAll(async () => {
  assertOwnedDatabase();
  db = new PrismaService(readEnvironment(process.env));
  const user = await db.user.create({ data: { email: `share-${tag}@example.test`, passwordHash: await hashPassword('share-e2e-password-123!'),
    name: 'Share E2E', role: 'ADMIN', emailVerifiedAt: new Date() } });
  userId = user.id;
  const category = await db.category.create({ data: { name: 'Danh mục share thử', slug, active: true } });
  categoryId = category.id;
  const asset = await db.uploadAsset.create({ data: { storageKey: `${randomUUID()}.webp`, width: 750, height: 1000, ownerId: userId } });
  assetId = asset.id;
  const product = await db.product.create({ data: { name, slug, description: 'E2E share fixture.', categoryId, status: 'PUBLISHED', priceFrom: 200000,
    images: { create: [{ assetId, position: 0 }] },
    variants: { create: [{ sku: `SHARE-${tag.toUpperCase()}-M`, color: 'đen', size: 'M', price: 200000, active: true, inventory: { create: { onHand: 5 } } }] } } });
  productId = product.id;
});

test.afterAll(async () => {
  if (!db) return;
  assertOwnedDatabase();
  try {
    if (productId) {
      await db.productImage.deleteMany({ where: { productId } });
      await db.inventory.deleteMany({ where: { variant: { productId } } });
      await db.variant.deleteMany({ where: { productId } });
      await db.product.deleteMany({ where: { id: productId } });
    }
    if (assetId) await db.uploadAsset.deleteMany({ where: { id: assetId } });
    if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
    if (userId) await db.user.deleteMany({ where: { id: userId } });
  } finally { await db.$disconnect(); }
});

test('share link serves crawler HTML and lands on the product page', async ({ page }) => {
  const response = await page.goto(`/api/v1/share/products/${slug}`);
  expect(response?.status()).toBe(200);
  // The zero-second meta refresh moves real visitors to the SPA detail page.
  await expect(page).toHaveURL(new RegExp(`/products/${slug}$`));
  await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
  // Crawler view: fetch the HTML directly and check the tags a card builder reads. The absolute
  // origin comes from the backend's own APP_ORIGIN, which differs between local and CI runners.
  const html = await page.request.get(`/api/v1/share/products/${slug}`);
  expect(html.status()).toBe(200);
  expect(html.headers()['content-type']).toContain('text/html');
  const body = await html.text();
  expect(body).toContain(`<title>${name} | RMG Labels</title>`);
  expect(body).toMatch(new RegExp(`<meta property="og:image" content="https?://[^"]+/api/v1/media/${assetId}" />`));
  expect(body).toContain(`<meta http-equiv="refresh" content="0; url=/products/${slug}" />`);
});

test('unknown product slug answers a uniform 404', async ({ request }) => {
  const response = await request.get('/api/v1/share/products/khong-ton-tai');
  expect(response.status()).toBe(404);
});

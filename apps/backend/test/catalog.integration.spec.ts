import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import supertest, { type Agent } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../dist/application.js';
import { readEnvironment } from '../dist/config/environment.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';

const origin = 'http://localhost:5173';
const email = `catalog-${randomUUID()}@example.test`;
const testEmails = new Set([email]);
let app: Awaited<ReturnType<typeof createApplication>>;
let db: PrismaService;
let server: Server;
let admin: Agent;
let categoryId = '';
let productId = '';
let assetId = '';
let productVersion = 0;
let variantId = '';
const slug = `test-${randomUUID()}`;
const sku = `TEST-${randomUUID()}`.toUpperCase();
const write = async (path: string, body: object, method: 'post' | 'patch' | 'put' = 'post', key?: string) => {
  const token = (await admin.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
  const call = admin[method](`/api/v1${path}`).set('Origin', origin).set('X-CSRF-Token', token);
  if (key) call.set('Idempotency-Key', key);
  return call.send(body);
};
const product = () => ({ name: 'Áo thử nghiệm', slug, description: 'Áo cotton dùng thử.', categoryId,
  variants: [{ sku, size: 'M', color: 'Đen', price: 250000, active: true }] });

beforeAll(async () => {
  if (process.env['NODE_ENV'] !== 'test' || !new URL(process.env['DATABASE_URL'] ?? '').pathname.endsWith('_test')) throw new Error('Test DB required');
  app = await createApplication(readEnvironment({ ...process.env, APP_ORIGIN: origin }));
  await app.listen(0, '127.0.0.1');
  db = app.get(PrismaService); server = app.getHttpServer() as Server;
  admin = supertest.agent(server);
  await write('/auth/register', { email, name: 'Admin thử', password: 'catalog-password-123!' }).then((r) => expect(r.status).toBe(202));
  await db.user.update({ where: { email }, data: { role: 'ADMIN', emailVerifiedAt: new Date() } });
  await write('/auth/login', { email, password: 'catalog-password-123!' }).then((r) => expect(r.status).toBe(200));
});

afterAll(async () => {
  if (productId) {
    await db.inventoryMovement.deleteMany({ where: { variant: { productId } } });
    await db.productImage.deleteMany({ where: { productId } });
    await db.inventory.deleteMany({ where: { variant: { productId } } });
    await db.variant.deleteMany({ where: { productId } });
    await db.product.deleteMany({ where: { id: productId } });
  }
  if (assetId) await db.uploadAsset.deleteMany({ where: { id: assetId } });
  if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
  if (db) {
    const users = await db.user.findMany({ where: { email: { in: [...testEmails] } }, select: { id: true } });
    for (const user of users) await db.session.deleteMany({ where: { sess: { path: ['userId'], equals: user.id } } });
    await db.user.deleteMany({ where: { email: { in: [...testEmails] } } });
  }
  if (app) await app.close();
});

describe('M3 catalog, actual uploads and inventory', () => {
  it('protects admin endpoints and validates pagination', async () => {
    await supertest(server).get('/api/v1/admin/products').expect(401);
    await supertest(server).get('/api/v1/products?pageSize=1000').expect(400);
    await supertest(server).get('/api/v1/products?sort=unsafe').expect(400);
  });
  it('creates a category and rejects a duplicate slug', async () => {
    const result = await write('/admin/categories', { name: 'Áo thử', slug, active: true });
    expect(result.status).toBe(201); categoryId = result.body.id as string;
    expect((await write('/admin/categories', { name: 'Trùng', slug, active: true })).status).toBe(409);
  });
  it('preserves category normalization, version checks and public visibility when updating', async () => {
    const updated = await write(`/admin/categories/${categoryId}`, { name: '  Áo danh mục mới  ', slug, active: false, expectedVersion: 0 }, 'patch');
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ id: categoryId, name: 'Áo danh mục mới', active: false, version: 1 });
    const publicList = await supertest(server).get('/api/v1/categories').expect(200);
    expect(publicList.body.some((row: { id: string }) => row.id === categoryId)).toBe(false);
    const adminList = await admin.get('/api/v1/admin/categories').expect(200);
    expect(adminList.body.find((row: { id: string }) => row.id === categoryId)).toMatchObject({ active: false, version: 1 });
    const stale = await write(`/admin/categories/${categoryId}`, { name: 'Tên cũ', slug, active: true, expectedVersion: 0 }, 'patch');
    expect(stale.status).toBe(409);
    expect((await write(`/admin/categories/${categoryId}`, { name: 'Áo danh mục mới', slug, active: true, expectedVersion: 1 }, 'patch')).status).toBe(200);
    const visible = await supertest(server).get('/api/v1/categories').expect(200);
    expect(visible.body.find((row: { id: string }) => row.id === categoryId)).toEqual({ id: categoryId, name: 'Áo danh mục mới', slug });
  });
  it('keeps category input allowlisted', async () => {
    const invalid = await write(`/admin/categories/${categoryId}`, { name: 'Tên giả', slug, active: true, expectedVersion: 2, role: 'ADMIN' }, 'patch');
    expect(invalid.status).toBe(400);
    const stored = await db.category.findUniqueOrThrow({ where: { id: categoryId } });
    expect(stored.name).toBe('Áo danh mục mới');
    expect(stored.version).toBe(2);
  });
  it('denies customer access across all admin controllers', async () => {
    const customerEmail = `catalog-customer-${randomUUID()}@example.test`;
    testEmails.add(customerEmail);
    expect((await write('/auth/register', { email: customerEmail, name: 'Khách thử quyền', password: 'customer-password-123!' })).status).toBe(202);
    const customer = supertest.agent(server);
    const token = (await customer.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
    await customer.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', token)
      .send({ email: customerEmail, password: 'customer-password-123!' }).expect(200);
    for (const endpoint of ['/admin/access', '/admin/categories', '/admin/products', '/admin/inventory', `/admin/uploads/images/${randomUUID()}`]) {
      await customer.get(`/api/v1${endpoint}`).expect(403);
    }
  });
  it('creates draft variants with zero stock and keeps drafts private', async () => {
    const result = await write('/admin/products', product());
    expect(result.status).toBe(201); productId = result.body.id as string; productVersion = result.body.version as number;
    variantId = result.body.variants[0].id as string;
    expect(result.body.variants[0].inventory.onHand).toBe(0);
    await supertest(server).get(`/api/v1/products/${slug}`).expect(404);
    expect((await write(`/admin/products/${productId}/publish`, { expectedVersion: productVersion })).status).toBe(409);
  });
  it('rejects duplicate normalized SKU and invalid size/price', async () => {
    expect((await write('/admin/products', { ...product(), slug: `other-${slug}` })).status).toBe(409);
    expect((await write('/admin/products', { ...product(), variants: [{ sku: 'NEW', size: 'INVALID', color: 'Đen', price: -1, active: true }] })).status).toBe(400);
  });
  it('requires an idempotency key, prevents negative inventory and records the actor/reason', async () => {
    const payload = { variantId, delta: 10, reason: 'Nhập thử', expectedVersion: 0 };
    expect((await write('/admin/inventory/adjustments', payload)).status).toBe(400);
    const key = randomUUID();
    const first = await write('/admin/inventory/adjustments', payload, 'post', key);
    expect(first.status).toBe(201); expect(first.body.onHand).toBe(10);
    const replay = await write('/admin/inventory/adjustments', payload, 'post', key);
    expect(replay.status).toBe(201); expect(replay.body).toEqual(first.body);
    expect((await write('/admin/inventory/adjustments', { ...payload, delta: 11 }, 'post', key)).status).toBe(409);
    expect((await write('/admin/inventory/adjustments', { ...payload, delta: -11, expectedVersion: 1 }, 'post', randomUUID())).status).toBe(409);
    const rows = await admin.get(`/api/v1/admin/inventory/movements?variantId=${variantId}`).expect(200);
    expect(rows.body.items).toHaveLength(1); expect(rows.body.items[0].reason).toBe('Nhập thử');
  });
  it('allows only one simultaneous adjustment with the same expected version', async () => {
    const changes = await Promise.all([1, 2].map((delta) => write('/admin/inventory/adjustments', { variantId, delta, reason: 'Cùng phiên', expectedVersion: 1 }, 'post', randomUUID())));
    expect(changes.map((r) => r.status).sort()).toEqual([201, 409]);
  });
  it('rejects fake image bytes and accepts a decoded PNG but keeps it private', async () => {
    const header = async () => (await admin.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
    let csrf = await header();
    await admin.post('/api/v1/admin/uploads/images').set('Origin', origin).set('X-CSRF-Token', csrf)
      .attach('file', Buffer.from('<svg></svg>'), { filename: 'fake.png', contentType: 'image/png' }).expect(415);
    const { default: sharp } = await import('sharp');
    const image = await sharp({ create: { width: 120, height: 160, channels: 3, background: '#e4dfd7' } }).png().toBuffer();
    csrf = await header();
    const result = await admin.post('/api/v1/admin/uploads/images').set('Origin', origin).set('X-CSRF-Token', csrf)
      .attach('file', image, { filename: 'real.png', contentType: 'image/png' }).expect(201);
    assetId = result.body.id as string;
    await supertest(server).get(`/api/v1/media/${assetId}`).expect(404).expect('Cache-Control', 'no-store');
    await supertest(server).get('/api/v1/media/not-a-uuid').expect(400).expect('Cache-Control', 'no-store');
    await admin.get(`/api/v1/admin/uploads/images/${assetId}`).expect(200).expect('Content-Type', /image\/webp/).expect('Cache-Control', 'no-store');
  });
  it('attaches an owned asset and publishes a public product without private data', async () => {
    const images = await write(`/admin/products/${productId}/images`, { assetIds: [assetId], expectedVersion: productVersion }, 'put');
    expect(images.status).toBe(200); productVersion = images.body.version as number;
    const published = await write(`/admin/products/${productId}/publish`, { expectedVersion: productVersion });
    expect(published.status).toBe(201); productVersion = published.body.version as number;
    const detail = await supertest(server).get(`/api/v1/products/${slug}`).expect(200);
    expect(detail.body.variants[0].sku).toBe(sku);
    expect(detail.body.variants[0].available).toBeGreaterThan(0);
    expect(JSON.stringify(detail.body)).not.toMatch(/ownerId|actorId|storageKey|passwordHash/);
    // Published images are public and never change for an asset id, so browsers may cache them; private reads stay no-store.
    await supertest(server).get(`/api/v1/media/${assetId}`).expect(200).expect('Cache-Control', 'public, max-age=86400');
    const list = await supertest(server).get(`/api/v1/products?categoryId=${categoryId}&q=${encodeURIComponent('Áo thử')}`).expect(200);
    expect(list.body.items.some((item: { id: string }) => item.id === productId)).toBe(true);
  });
  it('edits a published product live and explains publish-rule conflicts', async () => {
    const current = await admin.get(`/api/v1/admin/products/${productId}`).expect(200);
    const variant = { id: current.body.variants[0].id as string, sku, size: 'M', color: 'Đen', active: true };
    const edited = await write(`/admin/products/${productId}`, { ...product(), name: 'Áo thử đã sửa khi đang bán',
      description: 'Mô tả mới.', expectedVersion: productVersion, variants: [{ ...variant, price: 270000 }] }, 'patch');
    expect(edited.status).toBe(200); productVersion = edited.body.version as number;
    const live = await supertest(server).get(`/api/v1/products/${slug}`).expect(200);
    expect(live.body).toMatchObject({ name: 'Áo thử đã sửa khi đang bán', description: 'Mô tả mới.', priceFrom: 270000 });
    // A published product must keep an active variant and an image; the reason has its own code so the UI can show it.
    const noVariant = await write(`/admin/products/${productId}`, { ...product(), expectedVersion: productVersion,
      variants: [{ ...variant, price: 270000, active: false }] }, 'patch');
    expect(noVariant.status).toBe(409);
    expect(noVariant.body).toMatchObject({ code: 'PUBLISH_RULE', message: 'Sản phẩm đang xuất bản cần danh mục và biến thể đang bật.' });
    const noImage = await write(`/admin/products/${productId}/images`, { assetIds: [], expectedVersion: productVersion }, 'put');
    expect(noImage.status).toBe(409);
    expect(noImage.body).toMatchObject({ code: 'PUBLISH_RULE', message: 'Cần giữ ít nhất một ảnh cho sản phẩm đang xuất bản.' });
    expect((await admin.get(`/api/v1/admin/products/${productId}`).expect(200)).body.version).toBe(productVersion);
  });
  it('rejects stale updates and hides product details/media after hiding', async () => {
    expect((await write(`/admin/products/${productId}/hide`, { expectedVersion: 0 })).status).toBe(409);
    expect((await write(`/admin/products/${productId}/hide`, { expectedVersion: productVersion })).status).toBe(201);
    await supertest(server).get(`/api/v1/products/${slug}`).expect(404);
    await supertest(server).get(`/api/v1/media/${assetId}`).expect(404);
  });
});

import { createIsolatedTestDatabase } from '../../../tools/test-database.mjs';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { hash } from 'argon2';
import supertest, { type Agent } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../dist/application.js';
import { readEnvironment } from '../dist/config/environment.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';

// The guest cart resolver is a read-only map: cart IDs become public catalog data or a uniform
// "không còn bán" status. Hidden products, inventory internals and admin fields must never leak,
// and resolving must never mutate stock or create quotes/orders/idempotency records.

const origin = 'http://localhost:5173';
const ownerEmail = `cart-owner-${randomUUID()}@example.test`;
let app: Awaited<ReturnType<typeof createApplication>>;
let db: PrismaService;
let isolated: Awaited<ReturnType<typeof createIsolatedTestDatabase>> | undefined;
let server: Server;
let guest: Agent;

const tag = () => randomUUID().replaceAll('-', '').toUpperCase().slice(0, 12);
const uuid = () => randomUUID();

let ownerId = '';
let activeCategoryId = '';
let inactiveCategoryId = '';
let variantSellable = ''; // available 4 (onHand 5, reserved 1)
let variantSoldOut = ''; // available 0
let variantInactive = ''; // inactive variant of the published product
let variantDraft = '';
let variantHidden = '';
let variantShadow = ''; // published product under an inactive category
let assetId = '';
const productName = 'Áo cotton giỏ trình thử';
const productSlug = `cart-product-${tag().toLowerCase()}`;
const categorySlug = `cart-category-${tag().toLowerCase()}`;
const inactiveCategorySlug = `cart-closed-${tag().toLowerCase()}`;
const sku = (prefix: string) => `CART-${prefix}-${tag()}`;

/** Guest commands share the one CSRF mechanism: every request takes a fresh token first. */
async function resolve(body: unknown, options: { withoutCsrf?: boolean; origin?: string } = {}): Promise<supertest.Response> {
  // The token is fetched before the POST object exists: supertest attaches the agent's cookie
  // jar when the request is created, so a cookie fetched later would be missing from the wire.
  let csrfToken: string | undefined;
  if (!options.withoutCsrf) {
    const csrf = await guest.get('/api/v1/auth/csrf').expect(200);
    csrfToken = (csrf.body as { csrfToken: string }).csrfToken;
  }
  const request = guest.post('/api/v1/cart/resolve');
  if (csrfToken !== undefined) request.set('X-CSRF-Token', csrfToken);
  request.set('Origin', options.origin ?? origin).send(body);
  return await request;
}

function publicItemKeys(item: unknown): string[] {
  return Object.keys(item as object).sort();
}

beforeAll(async () => {
  if (process.env['NODE_ENV'] !== 'test' || !new URL(process.env['DATABASE_URL'] ?? '').pathname.endsWith('_test')) throw new Error('Test DB required');
  isolated = await createIsolatedTestDatabase(process.env['DATABASE_URL'], 'cart');
  app = await createApplication(readEnvironment({ ...process.env, DATABASE_URL: isolated.databaseUrl, APP_ORIGIN: origin }));
  await app.listen(0, '127.0.0.1');
  db = app.get(PrismaService); server = app.getHttpServer() as Server;
  guest = supertest.agent(server);
  ownerId = (await db.user.create({ data: { email: ownerEmail, name: 'Chủ ảnh giỏ thử', role: 'CUSTOMER',
    passwordHash: await hash('cart-integration-password-123!'), emailVerifiedAt: new Date() } })).id;
  const activeCategory = await db.category.create({ data: { name: 'Danh mục giỏ thử', slug: categorySlug, active: true } });
  activeCategoryId = activeCategory.id;
  inactiveCategoryId = (await db.category.create({ data: { name: 'Danh mục đã tắt', slug: inactiveCategorySlug, active: false } })).id;
  const published = await db.product.create({ data: { name: productName, slug: productSlug, description: 'Dòng công khai cho giỏ.',
    status: 'PUBLISHED', priceFrom: 200000, categoryId: activeCategoryId, variants: {
      create: [
        { id: (variantSellable = uuid()), sku: sku('A'), size: 'M', color: 'Đen', price: 200000, active: true,
          inventory: { create: { onHand: 5, reserved: 1 } } },
        { id: (variantSoldOut = uuid()), sku: sku('B'), size: 'S', color: 'Đen', price: 150000, active: true, inventory: { create: {} } },
        { id: (variantInactive = uuid()), sku: sku('C'), size: 'L', color: 'Đen', price: 160000, active: false, inventory: { create: {} } },
      ] } } });
  assetId = (await db.uploadAsset.create({ data: { ownerId, storageKey: `${uuid()}.webp`, width: 300, height: 400 } })).id;
  await db.productImage.create({ data: { productId: published.id, assetId, position: 0 } });
  await db.product.create({ data: { name: 'Sản phẩm nháp giỏ thử', slug: `cart-draft-${tag().toLowerCase()}`,
    description: 'Không công khai.', status: 'DRAFT', priceFrom: 300000, categoryId: activeCategoryId,
    variants: { create: { id: (variantDraft = uuid()), sku: sku('D'), size: 'M', color: 'Trắng', price: 300000, active: true,
      inventory: { create: { onHand: 2 } } } } } });
  await db.product.create({ data: { name: 'Sản phẩm đã ẩn giỏ thử', slug: `cart-hidden-${tag().toLowerCase()}`,
    description: 'Không công khai.', status: 'HIDDEN', priceFrom: 320000, categoryId: activeCategoryId,
    variants: { create: { id: (variantHidden = uuid()), sku: sku('H'), size: 'M', color: 'Trắng', price: 320000, active: true,
      inventory: { create: { onHand: 3 } } } } } });
  await db.product.create({ data: { name: 'Sản phẩm danh mục tắt', slug: `cart-shadow-${tag().toLowerCase()}`,
    description: 'Danh mục không bật.', status: 'PUBLISHED', priceFrom: 280000, categoryId: inactiveCategoryId,
    variants: { create: { id: (variantShadow = uuid()), sku: sku('X'), size: 'M', color: 'Trắng', price: 280000, active: true,
      inventory: { create: { onHand: 9 } } } } } });
});

afterAll(async () => {
  try { if (app) await app.close(); } finally { await isolated?.cleanup(); }
});

describe('POST /api/v1/cart/resolve (guest, read-only)', () => {
  it('treats uppercase UUIDs as the same variant before merging and checking quantity', async () => {
    const response = await resolve({ items: [{ variantId: variantSellable.toUpperCase(), quantity: 1 }] });
    expect(response.status).toBe(200);
    expect(response.body.items).toMatchObject([{ variantId: variantSellable, status: 'AVAILABLE' }]);
    const duplicate = await resolve({ items: [
      { variantId: variantSellable, quantity: 60 }, { variantId: variantSellable.toUpperCase(), quantity: 60 },
    ] });
    expect(duplicate.status).toBe(400);
  });
  it('maps a public cart item to public product data without internal fields', async () => {
    const response = await resolve({ items: [{ variantId: variantSellable, quantity: 2 }] });
    expect(response.status).toBe(200);
    const items = (response.body as { items: unknown[] }).items;
    expect(items).toHaveLength(1);
    const item = items[0] as Record<string, unknown>;
    expect(item).toMatchObject({ variantId: variantSellable, status: 'AVAILABLE', available: 4,
      sku: expect.stringMatching(/^CART-A-/), size: 'M', color: 'Đen', price: 200000,
      product: { name: productName, slug: productSlug }, image: { url: `/api/v1/media/${assetId}` } });
    expect(publicItemKeys(item)).toEqual(['available', 'color', 'image', 'price', 'product', 'size', 'sku', 'status', 'variantId']);
    expect(Object.keys(item.product as object).sort()).toEqual(['name', 'slug']);
    expect(Object.keys(item.image as object).sort()).toEqual(['url']);
  });

  it('answers every unavailable id with the same status and no catalog data', async () => {
    const unknownId = uuid();
    const response = await resolve({ items: [{ variantId: variantDraft, quantity: 1 }, { variantId: variantHidden, quantity: 1 },
      { variantId: variantShadow, quantity: 1 }, { variantId: variantInactive, quantity: 1 }, { variantId: unknownId, quantity: 1 }] });
    expect(response.status).toBe(200);
    const items = (response.body as { items: Array<Record<string, unknown>> }).items;
    expect(items).toHaveLength(5);
    for (const item of items) {
      expect(item).toEqual({ variantId: expect.any(String), status: 'UNAVAILABLE' });
      expect(publicItemKeys(item)).toEqual(['status', 'variantId']);
      expect([variantDraft, variantHidden, variantShadow, variantInactive, unknownId]).toContain(item.variantId);
    }
    expect(items[4]!.variantId).toBe(unknownId); // the unknown id is answered, not silently dropped
  });

  it('keeps public data for sold-out and exceeds-stock rows and answers in request order', async () => {
    const response = await resolve({ items: [{ variantId: variantSoldOut, quantity: 1 }, { variantId: variantSellable, quantity: 9 }] });
    expect(response.status).toBe(200);
    const items = (response.body as { items: Array<Record<string, unknown>> }).items;
    expect(items.map((item) => item.variantId)).toEqual([variantSoldOut, variantSellable]);
    expect(items[0]).toMatchObject({ status: 'OUT_OF_STOCK', available: 0, price: 150000 });
    expect(items[1]).toMatchObject({ status: 'EXCEEDS_STOCK', available: 4, price: 200000 });
    for (const item of items) {
      expect(publicItemKeys(item)).toEqual(['available', 'color', 'image', 'price', 'product', 'size', 'sku', 'status', 'variantId']);
    }
  });

  it('merges duplicate variant rows and keeps the first-occurrence order', async () => {
    const response = await resolve({ items: [{ variantId: variantSoldOut, quantity: 1 }, { variantId: variantSellable, quantity: 2 },
      { variantId: variantSoldOut, quantity: 2 }] });
    expect(response.status).toBe(200);
    const items = (response.body as { items: Array<Record<string, unknown>> }).items;
    expect(items.map((item) => item.variantId)).toEqual([variantSoldOut, variantSellable]);
    expect(items[0]).toMatchObject({ status: 'OUT_OF_STOCK' });
    expect(items[1]).toMatchObject({ status: 'AVAILABLE', available: 4 });
  });

  it('accepts an empty cart', async () => {
    const response = await resolve({ items: [] });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [] });
  });

  it('rejects invalid payloads before any query', async () => {
    const manyDistinct = [variantSellable, variantSoldOut, variantDraft, variantHidden, variantShadow, variantInactive,
      ...Array.from({ length: 45 }, () => uuid())]; // 51 distinct ids
    const tooLong = Array.from({ length: 101 }, (_, index) => ({ variantId: uuid(), quantity: (index % 99) + 1 }));
    const cases: unknown[] = [
      {}, // missing items
      { items: 'hai' }, // not an array
      { items: tooLong }, // payload bound before queries
      { items: manyDistinct.map((variantId) => ({ variantId, quantity: 1 })) }, // merged line limit
      { items: [{ variantId: variantSellable, quantity: 60 }, { variantId: variantSellable, quantity: 60 }] }, // merged over 99
      { items: [{ variantId: variantSellable, quantity: 0 }] },
      { items: [{ variantId: variantSellable, quantity: 100 }] },
      { items: [{ variantId: variantSellable, quantity: 1.5 }] },
      { items: [{ variantId: variantSellable, quantity: 'hai' }] },
      { items: [{ variantId: 'khong-phai-uuid', quantity: 1 }] },
      { items: [{ quantity: 1 }] },
    ];
    for (const body of cases) {
      const response = await resolve(body);
      expect(response.status).toBe(400);
      expect((response.body as { code?: string }).code).toBe('VALIDATION_ERROR');
    }
  });

  it('requires the CSRF mechanism for guests like every other write-shaped request', async () => {
    const withoutToken = await resolve({ items: [{ variantId: variantSellable, quantity: 1 }] }, { withoutCsrf: true });
    expect(withoutToken.status).toBe(403);
    const wrongOrigin = await resolve({ items: [{ variantId: variantSellable, quantity: 1 }] }, { origin: 'http://evil.example' });
    expect(wrongOrigin.status).toBe(403);
  });

  it('never mutates stock and never creates quotes, orders or idempotency records', async () => {
    const before = await db.inventory.findMany({ where: { variantId: { in: [variantSellable, variantSoldOut] } } });
    const response = await resolve({ items: [{ variantId: variantSellable, quantity: 2 }, { variantId: variantSoldOut, quantity: 3 }] });
    expect(response.status).toBe(200);
    const after = await db.inventory.findMany({ where: { variantId: { in: [variantSellable, variantSoldOut] } } });
    expect(after).toEqual(before);
    expect(await db.checkoutQuote.count()).toBe(0);
    expect(await db.order.count()).toBe(0);
    expect(await db.idempotencyRecord.count()).toBe(0);
  });
});

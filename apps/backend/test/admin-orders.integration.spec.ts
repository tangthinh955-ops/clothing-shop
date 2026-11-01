import { createIsolatedTestDatabase } from '../../../tools/test-database.mjs';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { hash } from 'argon2';
import supertest, { type Agent } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../dist/application.js';
import { readEnvironment } from '../dist/config/environment.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';

// M4.5.1 admin order list: GET /admin/orders is ADMIN-only, reads real orders newest first, filters
// by status and code/phone/name, and answers only the fields a list needs.

const origin = 'http://localhost:5173';
const password = 'admin-orders-only-password-123!';
const ITEM_KEYS = ['code', 'createdAt', 'id', 'itemCount', 'method', 'phone', 'recipientName', 'source', 'status', 'totalVnd'];

let app: Awaited<ReturnType<typeof createApplication>>;
let db: PrismaService;
let isolated: Awaited<ReturnType<typeof createIsolatedTestDatabase>> | undefined;
let server: Server;
let admin: Agent;
let customer: Agent;
let guest: Agent;
let variantId = '';
let sku = '';

interface ListBody {
  items: Array<Record<string, unknown>>;
  total: number;
  page: number;
  pageSize: number;
}

const list = (agent: Agent, query: Record<string, string> = {}) => agent.get('/api/v1/admin/orders').query(query);
const codes = (response: supertest.Response) => (response.body as ListBody).items.map((item) => item['code']);

async function seedOrder(input: { code: string; status: 'PENDING' | 'CONFIRMED' | 'CANCELLED'; name: string; phone: string;
  createdAt: string; quantity?: number }) {
  const quantity = input.quantity ?? 1;
  await db.order.create({ data: {
    code: input.code, status: input.status, source: 'WEB', userId: null, recipientName: input.name, phone: input.phone,
    email: null, province: 'Hà Nội', district: '', ward: 'Phường Điện Biên', addressLine: '5 Đội Cấn', note: null,
    method: 'COD', currency: 'VND', subtotalVnd: 200000 * quantity, shippingFeeVnd: 30000, totalVnd: 200000 * quantity + 30000,
    settingsVersion: 0, version: 0, createdAt: new Date(input.createdAt),
    items: { create: [{ variantId, productName: 'Áo danh sách đơn', sku, size: 'M', color: 'Đen', unitPriceVnd: 200000, quantity,
      lineTotalVnd: 200000 * quantity }] },
    history: { create: [{ fromStatus: null, toStatus: 'PENDING', actorType: 'GUEST', actorId: null, version: 0 }] },
  } });
}

beforeAll(async () => {
  isolated = await createIsolatedTestDatabase(process.env.DATABASE_URL!, 'adminorders');
  process.env.DATABASE_URL = isolated.databaseUrl;
  app = await createApplication(readEnvironment({ ...process.env, APP_ORIGIN: origin }));
  await app.listen(0, '127.0.0.1');
  db = app.get(PrismaService); server = app.getHttpServer() as Server;
  const passwordHash = await hash(password);
  const prefix = randomUUID();
  await db.user.create({ data: { email: `${prefix}-admin@example.test`, name: 'Admin đơn thử', role: 'ADMIN', passwordHash, emailVerifiedAt: new Date() } });
  await db.user.create({ data: { email: `${prefix}-customer@example.test`, name: 'Khách đơn thử', role: 'CUSTOMER', passwordHash, emailVerifiedAt: new Date() } });
  admin = supertest.agent(server);
  customer = supertest.agent(server);
  guest = supertest.agent(server);
  const login = async (agent: Agent, email: string) => {
    const token = (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
    await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', token).send({ email, password }).expect(200);
  };
  await login(admin, `${prefix}-admin@example.test`);
  await login(customer, `${prefix}-customer@example.test`);
  await db.shopSettings.create({ data: { id: 'default', shippingFeeVnd: 30000, bankDeadlineMinutes: 120 } });
  const category = await db.category.create({ data: { name: 'Danh mục đơn thử', slug: `admin-orders-${prefix}`, active: true } });
  const product = await db.product.create({ data: { name: 'Áo danh sách đơn', slug: `admin-orders-${prefix}`, description: '',
    categoryId: category.id, status: 'PUBLISHED', priceFrom: 200000, variants: { create: [
      { sku: `ADM-${prefix}`.toUpperCase().slice(0, 64), size: 'M', color: 'Đen', price: 200000, active: true,
        inventory: { create: { onHand: 10, reserved: 0 } } }] } }, include: { variants: true } });
  variantId = product.variants[0]!.id;
  sku = product.variants[0]!.sku;
  await seedOrder({ code: 'AAAA2222AAAA', status: 'PENDING', name: 'Nguyễn Văn An', phone: '0901000001', createdAt: '2026-10-01T01:00:00.000Z' });
  await seedOrder({ code: 'BBBB3333BBBB', status: 'CONFIRMED', name: 'Trần Thị Bình', phone: '0901000002', createdAt: '2026-10-02T01:00:00.000Z', quantity: 3 });
  await seedOrder({ code: 'CCCC4444CCCC', status: 'CANCELLED', name: 'Lê Văn Cường', phone: '0901000003', createdAt: '2026-10-03T01:00:00.000Z' });
});

afterAll(async () => {
  try { if (app) await app.close(); } finally { await isolated?.cleanup(); }
});

describe('GET /admin/orders (M4.5.1)', () => {
  it('refuses anonymous and non-admin callers', async () => {
    await list(guest).expect(401);
    await list(customer).expect(403);
  });

  it('lists seeded orders newest first with the total and page of the query', async () => {
    const response = await list(admin, { q: '0901000' }).expect(200);
    expect(codes(response)).toEqual(['CCCC4444CCCC', 'BBBB3333BBBB', 'AAAA2222AAAA']);
    expect(response.body).toMatchObject({ total: 3, page: 1, pageSize: 20 });
  });

  it('shows a real guest order placed through checkout, with only the fields the list needs', async () => {
    const csrf = (await guest.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
    const items = [{ variantId, quantity: 2 }];
    const quote = await guest.post('/api/v1/checkout/quote').set('X-CSRF-Token', csrf).set('Origin', origin)
      .send({ items, method: 'COD' }).expect(201);
    const created = await guest.post('/api/v1/orders').set('X-CSRF-Token', csrf).set('Origin', origin)
      .set('Idempotency-Key', `admin-orders-${randomUUID()}`)
      .send({ quoteId: quote.body.quoteId, items, method: 'COD', note: 'Ghi chú riêng của khách',
        contact: { name: 'Khách Đặt Thật', phone: '0912345678', email: 'real-order@example.test' },
        address: { province: 'TP. Hồ Chí Minh', district: '', ward: 'Phường Bến Nghé', addressLine: '12 Nguyễn Huệ' } }).expect(201);

    const code = (created.body as { order: { code: string } }).order.code;
    const response = await list(admin, { q: code }).expect(200);
    const [item] = (response.body as ListBody).items;
    expect(Object.keys(item!).sort()).toEqual(ITEM_KEYS);
    expect(item).toMatchObject({ code, status: 'PENDING', source: 'WEB', method: 'COD', totalVnd: 430000,
      recipientName: 'Khách Đặt Thật', phone: '0912345678', itemCount: 2 });
    // Address, email, note and the lookup-token hash stay out of a list view.
    const raw = JSON.stringify(response.body);
    for (const secret of ['12 Nguyễn Huệ', 'Bến Nghé', 'real-order@example.test', 'Ghi chú riêng', 'lookupTokenHash']) {
      expect(raw).not.toContain(secret);
    }
    expect(response.headers['cache-control']).toContain('no-store');
  });

  it('counts pieces across the order, not lines', async () => {
    const response = await list(admin, { q: 'BBBB3333BBBB' }).expect(200);
    expect((response.body as ListBody).items[0]).toMatchObject({ itemCount: 3, totalVnd: 630000 });
  });

  it('filters by delivery status', async () => {
    const response = await list(admin, { status: 'CANCELLED' }).expect(200);
    expect(codes(response)).toEqual(['CCCC4444CCCC']);
    expect((response.body as ListBody).total).toBe(1);
  });

  it.each([
    ['part of a code in any case', 'bbbb3333'],
    ['a recipient name in any case', 'trần thị'],
    ['a phone number', '0901000002'],
    ['the same phone written with +84', '+84 901 000 002'],
  ])('finds an order by %s', async (_label, q) => {
    const response = await list(admin, { q }).expect(200);
    expect(codes(response)).toEqual(['BBBB3333BBBB']);
  });

  it('combines search and status, and returns an empty page rather than failing', async () => {
    const none = await list(admin, { q: 'BBBB3333', status: 'PENDING' }).expect(200);
    expect(none.body).toMatchObject({ items: [], total: 0 });
  });

  it('pages through results without losing the total', async () => {
    const first = await list(admin, { q: '0901000', pageSize: '2' }).expect(200);
    expect(codes(first)).toEqual(['CCCC4444CCCC', 'BBBB3333BBBB']);
    const second = await list(admin, { q: '0901000', pageSize: '2', page: '2' }).expect(200);
    expect(codes(second)).toEqual(['AAAA2222AAAA']);
    expect(second.body).toMatchObject({ total: 3, page: 2, pageSize: 2 });
  });

  it.each([
    ['an unknown status', { status: 'PAID' }],
    ['page zero', { page: '0' }],
    ['a search term over 80 characters', { q: 'x'.repeat(81) }],
  ])('rejects %s', async (_label, query) => {
    await list(admin, query).expect(400);
  });
});

import { createIsolatedTestDatabase } from '../../../tools/test-database.mjs';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { hash } from 'argon2';
import supertest, { type Agent } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../dist/application.js';
import { readEnvironment } from '../dist/config/environment.js';
import { lookupTokenHash } from '../dist/modules/orders/order-command.js';
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
let detailId = '';
let secondId = '';
let thirdId = '';

const DETAIL_CODE = 'DDDD5555DDDD';
const DETAIL_TOKEN = 'D'.repeat(32);
const noteKey = () => `admin-note-${randomUUID()}`;

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
  const adminUser = await db.user.create({ data: { email: `${prefix}-admin@example.test`, name: 'Admin đơn thử', role: 'ADMIN', passwordHash, emailVerifiedAt: new Date() } });
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
  // M4.5.2 fixtures live outside the 0901000… phones searched above.
  const seedDetail = (code: string, tokenHash: string | null) => db.order.create({ data: {
    code, status: 'CONFIRMED', source: 'WEB', userId: null, recipientName: 'Phạm Chi Tiết', phone: '0902000001',
    email: 'detail@example.test', province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Phường Bến Nghé', addressLine: '12 Nguyễn Huệ',
    note: 'Gọi trước khi giao', method: 'COD', currency: 'VND', subtotalVnd: 400000, shippingFeeVnd: 30000, totalVnd: 430000,
    settingsVersion: 0, version: 1, lookupTokenHash: tokenHash, createdAt: new Date('2026-09-01T01:00:00.000Z'),
    items: { create: [{ variantId, productName: 'Tên lúc đặt', sku: 'SKU-LUC-DAT', size: 'M', color: 'Đen', unitPriceVnd: 200000,
      quantity: 2, lineTotalVnd: 400000 }] },
    history: { create: [
      { fromStatus: null, toStatus: 'PENDING', actorType: 'GUEST', actorId: null, version: 0, createdAt: new Date('2026-09-01T01:00:00.000Z') },
      { fromStatus: 'PENDING', toStatus: 'CONFIRMED', actorType: 'ADMIN', actorId: adminUser.id, reason: 'Đã gọi khách', version: 1,
        createdAt: new Date('2026-09-01T02:00:00.000Z') }] },
  } });
  detailId = (await seedDetail(DETAIL_CODE, lookupTokenHash(DETAIL_TOKEN))).id;
  secondId = (await seedDetail('EEEE6666EEEE', null)).id;
  thirdId = (await seedDetail('FFFF7777FFFF', null)).id;
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

describe('GET /admin/orders/:id (M4.5.2)', () => {
  it('refuses anonymous and non-admin callers, and answers 404/400 for unknown or malformed ids', async () => {
    await guest.get(`/api/v1/admin/orders/${detailId}`).expect(401);
    await customer.get(`/api/v1/admin/orders/${detailId}`).expect(403);
    await admin.get(`/api/v1/admin/orders/${randomUUID()}`).expect(404);
    await admin.get('/api/v1/admin/orders/not-a-uuid').expect(400);
  });

  it('answers the full snapshot, its history and no token hash', async () => {
    const response = await admin.get(`/api/v1/admin/orders/${detailId}`).expect(200);
    expect(response.body).toMatchObject({
      id: detailId, code: DETAIL_CODE, status: 'CONFIRMED', source: 'WEB', method: 'COD', currency: 'VND', version: 1,
      recipient: { name: 'Phạm Chi Tiết', phone: '0902000001', email: 'detail@example.test' },
      address: { province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Phường Bến Nghé', addressLine: '12 Nguyễn Huệ' },
      customerNote: 'Gọi trước khi giao', subtotalVnd: 400000, shippingFeeVnd: 30000, totalVnd: 430000,
      trackingNumber: null, deliveredAt: null, cancelledAt: null, cancelReason: null,
      items: [{ variantId, productName: 'Tên lúc đặt', sku: 'SKU-LUC-DAT', size: 'M', color: 'Đen', unitPriceVnd: 200000,
        quantity: 2, lineTotalVnd: 400000 }],
      history: [
        { fromStatus: null, toStatus: 'PENDING', actorName: 'Khách đặt hàng', reason: null, version: 0 },
        { fromStatus: 'PENDING', toStatus: 'CONFIRMED', actorName: 'Admin đơn thử', reason: 'Đã gọi khách', version: 1 },
      ],
    });
    const raw = JSON.stringify(response.body);
    expect(raw).not.toContain('lookupTokenHash');
    expect(raw).not.toContain(lookupTokenHash(DETAIL_TOKEN));
  });

  it('keeps showing what was ordered after the live product changes', async () => {
    await db.variant.update({ where: { id: variantId }, data: { price: 999000 } });
    const response = await admin.get(`/api/v1/admin/orders/${detailId}`).expect(200);
    expect((response.body as { items: Array<{ unitPriceVnd: number; productName: string }> }).items[0])
      .toMatchObject({ unitPriceVnd: 200000, productName: 'Tên lúc đặt' });
    await db.variant.update({ where: { id: variantId }, data: { price: 200000 } });
  });
});

describe('POST /admin/orders/:id/notes (M4.5.2)', () => {
  async function postNote(agent: Agent, orderId: string, body: unknown, key: string | undefined = noteKey()) {
    const csrf = (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
    const request = agent.post(`/api/v1/admin/orders/${orderId}/notes`).set('Origin', origin).set('X-CSRF-Token', csrf);
    return (key === undefined ? request : request.set('Idempotency-Key', key)).send(body as object);
  }
  const noteCount = (orderId: string) => db.orderNote.count({ where: { orderId } });

  it('refuses anonymous and non-admin callers, and a request without CSRF', async () => {
    expect((await postNote(guest, detailId, { body: 'Không được ghi' })).status).toBe(401);
    expect((await postNote(customer, detailId, { body: 'Không được ghi' })).status).toBe(403);
    await admin.post(`/api/v1/admin/orders/${detailId}/notes`).set('Origin', origin).set('Idempotency-Key', noteKey())
      .send({ body: 'Không có CSRF' }).expect(403);
    expect(await noteCount(detailId)).toBe(0);
  });

  it.each([
    ['an empty note', { body: '   ' }],
    ['a note over 1000 characters', { body: 'x'.repeat(1001) }],
    ['a missing note', {}],
  ])('rejects %s', async (_label, body) => {
    expect((await postNote(admin, detailId, body)).status).toBe(400);
    expect(await noteCount(detailId)).toBe(0);
  });

  it('needs a valid Idempotency-Key and an existing order', async () => {
    const missing = await admin.get('/api/v1/auth/csrf').expect(200);
    await admin.post(`/api/v1/admin/orders/${detailId}/notes`).set('Origin', origin)
      .set('X-CSRF-Token', missing.body.csrfToken as string).send({ body: 'Thiếu key' }).expect(400);
    expect((await postNote(admin, detailId, { body: 'Key ngắn' }, 'short')).status).toBe(400);
    expect((await postNote(admin, randomUUID(), { body: 'Không có đơn' })).status).toBe(404);
  });

  it('stores a trimmed note by the signed-in admin and shows it on the order, without touching the order', async () => {
    const before = await db.order.findUniqueOrThrow({ where: { id: detailId } });
    const created = await postNote(admin, detailId, { body: '  Khách hẹn giao sau 18h  ' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ body: 'Khách hẹn giao sau 18h', authorName: 'Admin đơn thử' });
    const detail = await admin.get(`/api/v1/admin/orders/${detailId}`).expect(200);
    expect((detail.body as { notes: Array<Record<string, unknown>> }).notes.at(-1))
      .toMatchObject({ id: created.body.id, body: 'Khách hẹn giao sau 18h', authorName: 'Admin đơn thử' });
    const after = await db.order.findUniqueOrThrow({ where: { id: detailId } });
    expect({ version: after.version, status: after.status, totalVnd: Number(after.totalVnd), updatedAt: after.updatedAt })
      .toEqual({ version: before.version, status: before.status, totalVnd: Number(before.totalVnd), updatedAt: before.updatedAt });
  });

  it('replays the same key to the same note and refuses that key with different content', async () => {
    const key = noteKey();
    const first = await postNote(admin, secondId, { body: 'Ghi chú một lần' }, key);
    expect(first.status).toBe(201);
    const replay = await postNote(admin, secondId, { body: 'Ghi chú một lần' }, key);
    expect(replay.status).toBe(201);
    expect(replay.body.id).toBe(first.body.id);
    expect(await noteCount(secondId)).toBe(1);
    expect((await postNote(admin, secondId, { body: 'Nội dung khác' }, key)).status).toBe(409);
    expect((await postNote(admin, detailId, { body: 'Ghi chú một lần' }, key)).status).toBe(409);
    expect(await noteCount(secondId)).toBe(1);
  });

  it('creates one note when the same key races', async () => {
    const key = noteKey();
    const results = await Promise.all([postNote(admin, thirdId, { body: 'Đua' }, key), postNote(admin, thirdId, { body: 'Đua' }, key)]);
    expect(results.map((result) => result.status)).toEqual([201, 201]);
    expect(results[0]!.body.id).toBe(results[1]!.body.id);
    expect(await noteCount(thirdId)).toBe(1);
  });

  it('never reaches the guest view of the order', async () => {
    const secret = `Nội bộ ${randomUUID()}`;
    expect((await postNote(admin, detailId, { body: secret })).status).toBe(201);
    const view = await guest.get(`/api/v1/orders/${DETAIL_CODE}`).set('X-Order-Token', DETAIL_TOKEN).expect(200);
    expect(JSON.stringify(view.body)).not.toContain(secret);
  });
});

describe('POST /admin/orders/:id/confirm (M4.5.3)', () => {
  const stock = () => db.inventory.findUniqueOrThrow({ where: { variantId }, select: { onHand: true, reserved: true, version: true } });
  const historyOf = (orderId: string) => db.orderStatusHistory.findMany({ where: { orderId }, orderBy: { version: 'asc' } });
  const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  let sequence = 0;

  /** A fresh order per test, so one scenario's confirmation never changes another's starting state. */
  async function pendingOrder(overrides: { method?: 'COD' | 'BANK_TRANSFER'; status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED'; token?: string } = {}) {
    sequence += 1;
    const code = `GGGGGGGGGGG${CODE_LETTERS[sequence]!}`;
    const order = await db.order.create({ data: {
      code, status: overrides.status ?? 'PENDING', source: 'WEB', userId: null, recipientName: 'Khách Xác Nhận', phone: '0903000001', email: null,
      province: 'Hà Nội', district: '', ward: 'Phường A', addressLine: '1 Phố B', note: null, method: overrides.method ?? 'COD', currency: 'VND',
      subtotalVnd: 200000, shippingFeeVnd: 30000, totalVnd: 230000, settingsVersion: 0, version: 0,
      lookupTokenHash: overrides.token ? lookupTokenHash(overrides.token) : null,
      bankDeadlineAt: overrides.method === 'BANK_TRANSFER' ? new Date(Date.now() + 3600000) : null,
      items: { create: [{ variantId, productName: 'Áo danh sách đơn', sku, size: 'M', color: 'Đen', unitPriceVnd: 200000, quantity: 1, lineTotalVnd: 200000 }] },
      history: { create: [{ fromStatus: null, toStatus: overrides.status ?? 'PENDING', actorType: 'GUEST', actorId: null, version: 0 }] },
    } });
    return { id: order.id, code };
  }

  async function confirm(agent: Agent, orderId: string, body: unknown, key: string | undefined = noteKey(), withCsrf = true) {
    const csrf = withCsrf ? (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string : undefined;
    const request = agent.post(`/api/v1/admin/orders/${orderId}/confirm`).set('Origin', origin);
    if (csrf) request.set('X-CSRF-Token', csrf);
    if (key !== undefined) request.set('Idempotency-Key', key);
    return request.send(body as object);
  }

  it('refuses anonymous and non-admin callers, a missing CSRF token and an unknown order', async () => {
    const { id } = await pendingOrder();
    expect((await confirm(guest, id, { expectedVersion: 0 })).status).toBe(401);
    expect((await confirm(customer, id, { expectedVersion: 0 })).status).toBe(403);
    expect((await confirm(admin, id, { expectedVersion: 0 }, noteKey(), false)).status).toBe(403);
    expect((await confirm(admin, randomUUID(), { expectedVersion: 0 })).status).toBe(404);
    expect((await db.order.findUniqueOrThrow({ where: { id } })).status).toBe('PENDING');
  });

  it('needs a valid key and an expected version', async () => {
    const { id } = await pendingOrder();
    expect((await confirm(admin, id, { expectedVersion: 0 }, 'short')).status).toBe(400);
    const csrf = (await admin.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
    await admin.post(`/api/v1/admin/orders/${id}/confirm`).set('Origin', origin).set('X-CSRF-Token', csrf)
      .send({ expectedVersion: 0 }).expect(400);
    expect((await confirm(admin, id, {})).status).toBe(400);
    expect((await confirm(admin, id, { expectedVersion: -1 })).status).toBe(400);
    expect((await db.order.findUniqueOrThrow({ where: { id } })).status).toBe('PENDING');
  });

  it('moves a COD order to CONFIRMED with a history entry, leaving stock untouched', async () => {
    const { id, code } = await pendingOrder();
    const before = await stock();
    const response = await confirm(admin, id, { expectedVersion: 0 });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id, code, status: 'CONFIRMED', version: 1 });
    const history = await historyOf(id);
    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({ fromStatus: 'PENDING', toStatus: 'CONFIRMED', actorType: 'ADMIN', version: 1 });
    expect(await stock()).toEqual(before);
    const detail = await admin.get(`/api/v1/admin/orders/${id}`).expect(200);
    expect((detail.body as { history: Array<{ actorName: string }> }).history[1]).toMatchObject({ actorName: 'Admin đơn thử' });
  });

  it('refuses a stale version without changing the order', async () => {
    const { id } = await pendingOrder();
    expect((await confirm(admin, id, { expectedVersion: 7 })).status).toBe(409);
    expect(await db.order.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'PENDING', version: 0 });
    expect(await historyOf(id)).toHaveLength(1);
  });

  it.each(['CONFIRMED', 'CANCELLED'] as const)('refuses an order that is already %s', async (status) => {
    const { id } = await pendingOrder({ status });
    expect((await confirm(admin, id, { expectedVersion: 0 })).status).toBe(409);
    expect(await db.order.findUniqueOrThrow({ where: { id } })).toMatchObject({ status, version: 0 });
  });

  it('refuses a bank transfer order, which needs full payment first', async () => {
    const { id } = await pendingOrder({ method: 'BANK_TRANSFER' });
    expect((await confirm(admin, id, { expectedVersion: 0 })).status).toBe(409);
    expect(await db.order.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'PENDING', version: 0 });
  });

  it('replays the same key to the same result and refuses that key with another version', async () => {
    const { id, code } = await pendingOrder();
    const key = noteKey();
    expect((await confirm(admin, id, { expectedVersion: 0 }, key)).status).toBe(200);
    const replay = await confirm(admin, id, { expectedVersion: 0 }, key);
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual({ id, code, status: 'CONFIRMED', version: 1 });
    expect(await historyOf(id)).toHaveLength(2);
    expect((await confirm(admin, id, { expectedVersion: 1 }, key)).status).toBe(409);
  });

  it('lets exactly one of two racing admins win when their keys differ', async () => {
    const { id } = await pendingOrder();
    const results = await Promise.all([confirm(admin, id, { expectedVersion: 0 }), confirm(admin, id, { expectedVersion: 0 })]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(await historyOf(id)).toHaveLength(2);
    expect(await db.order.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'CONFIRMED', version: 1 });
  });

  it('applies once when the same key races', async () => {
    const { id } = await pendingOrder();
    const key = noteKey();
    const results = await Promise.all([confirm(admin, id, { expectedVersion: 0 }, key), confirm(admin, id, { expectedVersion: 0 }, key)]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(await historyOf(id)).toHaveLength(2);
  });

  it('shows the customer the new status without naming the admin', async () => {
    const token = 'E'.repeat(32);
    const { id, code } = await pendingOrder({ token });
    expect((await confirm(admin, id, { expectedVersion: 0 })).status).toBe(200);
    const view = await guest.get(`/api/v1/orders/${code}`).set('X-Order-Token', token).expect(200);
    expect((view.body as { order: { status: string } }).order.status).toBe('CONFIRMED');
    expect(JSON.stringify(view.body)).not.toContain('Admin đơn thử');
  });
});

type SeedStatus = 'PENDING' | 'CONFIRMED' | 'PACKING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'DELIVERY_FAILED' | 'RETURNED_TO_SHOP';
const SEED_CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
let seedSequence = 0;
let firstVariant = '';
let secondVariant = '';

const stockOf = (id: string) => db.inventory.findUniqueOrThrow({ where: { variantId: id }, select: { onHand: true, reserved: true } });
const orderOf = (id: string) => db.order.findUniqueOrThrow({ where: { id } });
const historyOf = (orderId: string) => db.orderStatusHistory.findMany({ where: { orderId }, orderBy: { version: 'asc' } });

beforeAll(async () => {
  const prefix = randomUUID();
  const category = await db.category.create({ data: { name: 'Danh mục hủy đơn', slug: `admin-cancel-${prefix}`, active: true } });
  const product = await db.product.create({ data: { name: 'Áo hủy đơn', slug: `admin-cancel-${prefix}`, description: '',
    categoryId: category.id, status: 'PUBLISHED', priceFrom: 200000, variants: { create: [
      { sku: `CAN-A-${prefix}`.toUpperCase().slice(0, 64), size: 'M', color: 'Đen', price: 200000, active: true, inventory: { create: { onHand: 500, reserved: 0 } } },
      { sku: `CAN-B-${prefix}`.toUpperCase().slice(0, 64), size: 'L', color: 'Đen', price: 200000, active: true, inventory: { create: { onHand: 500, reserved: 0 } } },
    ] } }, include: { variants: true } });
  firstVariant = product.variants[0]!.id;
  secondVariant = product.variants[1]!.id;
});

/** An order that really holds its stock unless it already gave it up, as checkout and shipping would leave it. */
async function seedHoldingOrder(status: SeedStatus = 'PENDING', overrides: { method?: 'COD' | 'BANK_TRANSFER'; token?: string;
  lines?: Array<{ variantId: string; quantity: number }>; holding?: boolean } = {}) {
  seedSequence += 1;
  const code = `HHHHHHHHHH${SEED_CODE_LETTERS[Math.floor(seedSequence / 23)]!}${SEED_CODE_LETTERS[seedSequence % 23]!}`;
  const lines = overrides.lines ?? [{ variantId: firstVariant, quantity: 2 }];
  const order = await db.order.create({ data: {
    code, status, source: 'WEB', userId: null, recipientName: 'Khách Hủy Đơn', phone: '0904000001', email: null,
    province: 'Hà Nội', district: '', ward: 'Phường A', addressLine: '1 Phố B', note: null, method: overrides.method ?? 'COD', currency: 'VND',
    subtotalVnd: 400000, shippingFeeVnd: 30000, totalVnd: 430000, settingsVersion: 0, version: 0,
    lookupTokenHash: overrides.token ? lookupTokenHash(overrides.token) : null,
    items: { create: lines.map((line, index) => ({ variantId: line.variantId, productName: 'Áo hủy đơn', sku: `SKU-${index}`, size: 'M', color: 'Đen',
      unitPriceVnd: 200000, quantity: line.quantity, lineTotalVnd: 200000 * line.quantity })) },
    history: { create: [{ fromStatus: null, toStatus: status, actorType: 'GUEST', actorId: null, version: 0 }] },
  } });
  if (overrides.holding ?? true) {
    for (const line of lines) await db.inventory.update({ where: { variantId: line.variantId }, data: { reserved: { increment: line.quantity } } });
  }
  return { id: order.id, code };
}

async function postTransition(action: string, agent: Agent, orderId: string, body: unknown, key: string | undefined = noteKey(), withCsrf = true) {
  const csrf = withCsrf ? (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string : undefined;
  const request = agent.post(`/api/v1/admin/orders/${orderId}/${action}`).set('Origin', origin);
  if (csrf) request.set('X-CSRF-Token', csrf);
  if (key !== undefined) request.set('Idempotency-Key', key);
  return request.send(body as object);
}

describe('POST /admin/orders/:id/pack (M4.5.4)', () => {
  const pack = (agent: Agent, orderId: string, body: unknown, key?: string, withCsrf?: boolean) => postTransition('pack', agent, orderId, body, key, withCsrf);

  it('refuses anonymous and non-admin callers, a missing CSRF token and an unknown order', async () => {
    const { id } = await seedHoldingOrder('CONFIRMED');
    expect((await pack(guest, id, { expectedVersion: 0 })).status).toBe(401);
    expect((await pack(customer, id, { expectedVersion: 0 })).status).toBe(403);
    expect((await pack(admin, id, { expectedVersion: 0 }, noteKey(), false)).status).toBe(403);
    expect((await pack(admin, randomUUID(), { expectedVersion: 0 })).status).toBe(404);
    expect((await orderOf(id)).status).toBe('CONFIRMED');
  });

  it('needs a valid key and an expected version', async () => {
    const { id } = await seedHoldingOrder('CONFIRMED');
    expect((await pack(admin, id, { expectedVersion: 0 }, 'short')).status).toBe(400);
    const csrf = (await admin.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
    await admin.post(`/api/v1/admin/orders/${id}/pack`).set('Origin', origin).set('X-CSRF-Token', csrf)
      .send({ expectedVersion: 0 }).expect(400);
    expect((await pack(admin, id, {})).status).toBe(400);
    expect((await orderOf(id)).status).toBe('CONFIRMED');
  });

  it('moves a confirmed order to PACKING with a history entry, leaving stock untouched', async () => {
    const { id, code } = await seedHoldingOrder('CONFIRMED');
    const before = await stockOf(firstVariant);
    const response = await pack(admin, id, { expectedVersion: 0 });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id, code, status: 'PACKING', version: 1 });
    const history = await historyOf(id);
    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({ fromStatus: 'CONFIRMED', toStatus: 'PACKING', actorType: 'ADMIN', reason: null, version: 1 });
    expect(await stockOf(firstVariant)).toEqual(before);
    const detail = await admin.get(`/api/v1/admin/orders/${id}`).expect(200);
    expect((detail.body as { history: Array<{ actorName: string }> }).history[1]).toMatchObject({ actorName: 'Admin đơn thử' });
  });

  it.each(['PENDING', 'PACKING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'DELIVERY_FAILED', 'RETURNED_TO_SHOP'] as const)('refuses a %s order and changes nothing', async (status) => {
    const { id } = await seedHoldingOrder(status, { holding: false });
    const before = await stockOf(firstVariant);
    expect((await pack(admin, id, { expectedVersion: 0 })).status).toBe(409);
    expect(await orderOf(id)).toMatchObject({ status, version: 0 });
    expect(await historyOf(id)).toHaveLength(1);
    expect(await stockOf(firstVariant)).toEqual(before);
  });

  it('refuses a stale version without changing the order', async () => {
    const { id } = await seedHoldingOrder('CONFIRMED');
    expect((await pack(admin, id, { expectedVersion: 7 })).status).toBe(409);
    expect(await orderOf(id)).toMatchObject({ status: 'CONFIRMED', version: 0 });
    expect(await historyOf(id)).toHaveLength(1);
  });

  it('replays the same key to the same result and refuses that key with another version', async () => {
    const { id, code } = await seedHoldingOrder('CONFIRMED');
    const key = noteKey();
    expect((await pack(admin, id, { expectedVersion: 0 }, key)).status).toBe(200);
    const replay = await pack(admin, id, { expectedVersion: 0 }, key);
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual({ id, code, status: 'PACKING', version: 1 });
    expect((await pack(admin, id, { expectedVersion: 1 }, key)).status).toBe(409);
    expect(await historyOf(id)).toHaveLength(2);
  });

  it('lets exactly one of two racing admins win when their keys differ', async () => {
    const { id } = await seedHoldingOrder('CONFIRMED');
    const results = await Promise.all([pack(admin, id, { expectedVersion: 0 }), pack(admin, id, { expectedVersion: 0 })]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(await historyOf(id)).toHaveLength(2);
    expect(await orderOf(id)).toMatchObject({ status: 'PACKING', version: 1 });
  });

  it('applies once when the same key races', async () => {
    const { id } = await seedHoldingOrder('CONFIRMED');
    const key = noteKey();
    const results = await Promise.all([pack(admin, id, { expectedVersion: 0 }, key), pack(admin, id, { expectedVersion: 0 }, key)]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(await historyOf(id)).toHaveLength(2);
  });

  it('leaves a consistent order when packing races a cancel', async () => {
    const { id } = await seedHoldingOrder('CONFIRMED');
    const before = await stockOf(firstVariant);
    const results = await Promise.all([pack(admin, id, { expectedVersion: 0 }),
      postTransition('cancel', admin, id, { expectedVersion: 0, reason: 'Khách đổi ý' })]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const packed = results[0]!.status === 200;
    expect(await orderOf(id)).toMatchObject({ status: packed ? 'PACKING' : 'CANCELLED', version: 1 });
    expect(await stockOf(firstVariant)).toEqual({ onHand: before.onHand, reserved: before.reserved - (packed ? 0 : 2) });
  });

  it('shows the customer the new status without naming the admin', async () => {
    const token = 'G'.repeat(32);
    const { id, code } = await seedHoldingOrder('CONFIRMED', { token });
    expect((await pack(admin, id, { expectedVersion: 0 })).status).toBe(200);
    const view = await guest.get(`/api/v1/orders/${code}`).set('X-Order-Token', token).expect(200);
    expect((view.body as { order: { status: string } }).order.status).toBe('PACKING');
    expect(JSON.stringify(view.body)).not.toContain('Admin đơn thử');
  });
});

describe('POST /admin/orders/:id/cancel (M4.5.7)', () => {
  const REASON = 'Khách đặt nhầm size';
  const stock = stockOf;
  const seedCancelable = seedHoldingOrder;
  const releases = (code: string) => db.inventoryMovement.findMany({ where: { source: 'ORDER_RELEASE', reason: `Hủy đơn ${code}` } });
  const cancel = (agent: Agent, orderId: string, body: unknown, key?: string, withCsrf?: boolean) => postTransition('cancel', agent, orderId, body, key, withCsrf);

  it('refuses anonymous and non-admin callers, a missing CSRF token and an unknown order', async () => {
    const { id } = await seedCancelable();
    const before = await stock(firstVariant);
    const body = { expectedVersion: 0, reason: REASON };
    expect((await cancel(guest, id, body)).status).toBe(401);
    expect((await cancel(customer, id, body)).status).toBe(403);
    expect((await cancel(admin, id, body, noteKey(), false)).status).toBe(403);
    expect((await cancel(admin, randomUUID(), body)).status).toBe(404);
    expect((await orderOf(id)).status).toBe('PENDING');
    expect(await stock(firstVariant)).toEqual(before);
  });

  it.each([
    ['a missing reason', { expectedVersion: 0 }],
    ['a reason shorter than 3 characters after trimming', { expectedVersion: 0, reason: '  ab  ' }],
    ['a reason over 500 characters', { expectedVersion: 0, reason: 'x'.repeat(501) }],
    ['a missing version', { reason: REASON }],
  ])('rejects %s without touching the order or the stock', async (_label, body) => {
    const { id } = await seedCancelable();
    const before = await stock(firstVariant);
    expect((await cancel(admin, id, body)).status).toBe(400);
    expect((await orderOf(id)).status).toBe('PENDING');
    expect(await stock(firstVariant)).toEqual(before);
  });

  it('needs a valid Idempotency-Key', async () => {
    const { id } = await seedCancelable();
    expect((await cancel(admin, id, { expectedVersion: 0, reason: REASON }, 'short')).status).toBe(400);
    const csrf = (await admin.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
    await admin.post(`/api/v1/admin/orders/${id}/cancel`).set('Origin', origin).set('X-CSRF-Token', csrf)
      .send({ expectedVersion: 0, reason: REASON }).expect(400);
    expect((await orderOf(id)).status).toBe('PENDING');
  });

  it.each(['PENDING', 'CONFIRMED', 'PACKING'] as const)('cancels a %s order, gives back only what it held and records why', async (status) => {
    const { id, code } = await seedCancelable(status);
    const before = await stock(firstVariant);
    const response = await cancel(admin, id, { expectedVersion: 0, reason: `  ${REASON}  ` });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id, code, status: 'CANCELLED', version: 1 });
    expect(await stock(firstVariant)).toEqual({ onHand: before.onHand, reserved: before.reserved - 2 });
    const saved = await orderOf(id);
    expect(saved).toMatchObject({ status: 'CANCELLED', version: 1, cancelReason: REASON });
    expect(saved.cancelledAt).toBeInstanceOf(Date);
    const history = await historyOf(id);
    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({ fromStatus: status, toStatus: 'CANCELLED', actorType: 'ADMIN', reason: REASON, version: 1 });
    const detail = await admin.get(`/api/v1/admin/orders/${id}`).expect(200);
    expect(detail.body).toMatchObject({ status: 'CANCELLED', cancelReason: REASON });
    expect((detail.body as { history: Array<{ actorName: string }> }).history[1]).toMatchObject({ actorName: 'Admin đơn thử' });
  });

  it('releases every line of the order, and the movement does not copy the free-text reason', async () => {
    const { id, code } = await seedCancelable('PENDING', { lines: [{ variantId: firstVariant, quantity: 2 }, { variantId: secondVariant, quantity: 3 }] });
    const [first, second] = [await stock(firstVariant), await stock(secondVariant)];
    expect((await cancel(admin, id, { expectedVersion: 0, reason: REASON })).status).toBe(200);
    expect(await stock(firstVariant)).toEqual({ onHand: first.onHand, reserved: first.reserved - 2 });
    expect(await stock(secondVariant)).toEqual({ onHand: second.onHand, reserved: second.reserved - 3 });
    const movements = await releases(code);
    expect(movements).toHaveLength(2);
    for (const movement of movements) expect(movement).toMatchObject({ actorType: 'ADMIN', delta: 0 });
  });

  it.each(['SHIPPED', 'DELIVERED', 'CANCELLED', 'DELIVERY_FAILED', 'RETURNED_TO_SHOP'] as const)('refuses a %s order and changes nothing', async (status) => {
    const { id, code } = await seedCancelable(status, { holding: false });
    const before = await stock(firstVariant);
    expect((await cancel(admin, id, { expectedVersion: 0, reason: REASON })).status).toBe(409);
    expect(await orderOf(id)).toMatchObject({ status, version: 0, cancelReason: null, cancelledAt: null });
    expect(await stock(firstVariant)).toEqual(before);
    expect(await releases(code)).toHaveLength(0);
  });

  it('refuses a stale version without changing the order or the stock', async () => {
    const { id } = await seedCancelable();
    const before = await stock(firstVariant);
    expect((await cancel(admin, id, { expectedVersion: 7, reason: REASON })).status).toBe(409);
    expect(await orderOf(id)).toMatchObject({ status: 'PENDING', version: 0 });
    expect(await historyOf(id)).toHaveLength(1);
    expect(await stock(firstVariant)).toEqual(before);
  });

  it('cancels a bank transfer order that has not been paid', async () => {
    const { id } = await seedCancelable('PENDING', { method: 'BANK_TRANSFER' });
    const before = await stock(firstVariant);
    expect((await cancel(admin, id, { expectedVersion: 0, reason: REASON })).status).toBe(200);
    expect(await stock(firstVariant)).toEqual({ onHand: before.onHand, reserved: before.reserved - 2 });
  });

  it('replays the same key once, and refuses that key with another reason', async () => {
    const { id, code } = await seedCancelable();
    const before = await stock(firstVariant);
    const key = noteKey();
    expect((await cancel(admin, id, { expectedVersion: 0, reason: REASON }, key)).status).toBe(200);
    const replay = await cancel(admin, id, { expectedVersion: 0, reason: REASON }, key);
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual({ id, code, status: 'CANCELLED', version: 1 });
    expect((await cancel(admin, id, { expectedVersion: 0, reason: 'Lý do khác hẳn' }, key)).status).toBe(409);
    expect(await stock(firstVariant)).toEqual({ onHand: before.onHand, reserved: before.reserved - 2 });
    expect(await historyOf(id)).toHaveLength(2);
    expect((await orderOf(id)).cancelReason).toBe(REASON);
  });

  it('lets exactly one of two racing admins cancel, and releases once', async () => {
    const { id, code } = await seedCancelable();
    const before = await stock(firstVariant);
    const results = await Promise.all([cancel(admin, id, { expectedVersion: 0, reason: REASON }), cancel(admin, id, { expectedVersion: 0, reason: REASON })]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(await stock(firstVariant)).toEqual({ onHand: before.onHand, reserved: before.reserved - 2 });
    expect(await releases(code)).toHaveLength(1);
  });

  it('releases once when the same key races', async () => {
    const { id, code } = await seedCancelable();
    const before = await stock(firstVariant);
    const key = noteKey();
    const body = { expectedVersion: 0, reason: REASON };
    const results = await Promise.all([cancel(admin, id, body, key), cancel(admin, id, body, key)]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(await stock(firstVariant)).toEqual({ onHand: before.onHand, reserved: before.reserved - 2 });
    expect(await releases(code)).toHaveLength(1);
  });

  it('leaves a consistent order when a cancel races a confirm', async () => {
    const { id, code } = await seedCancelable();
    const before = await stock(firstVariant);
    const csrf = (await admin.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
    const confirming = admin.post(`/api/v1/admin/orders/${id}/confirm`).set('Origin', origin).set('X-CSRF-Token', csrf)
      .set('Idempotency-Key', noteKey()).send({ expectedVersion: 0 });
    const results = await Promise.all([cancel(admin, id, { expectedVersion: 0, reason: REASON }), confirming]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const saved = await orderOf(id);
    const cancelled = results[0]!.status === 200;
    expect(saved).toMatchObject({ status: cancelled ? 'CANCELLED' : 'CONFIRMED', version: 1 });
    expect(await stock(firstVariant)).toEqual({ onHand: before.onHand, reserved: before.reserved - (cancelled ? 2 : 0) });
    expect(await releases(code)).toHaveLength(cancelled ? 1 : 0);
  });

  it('rolls everything back when the stock cannot be released', async () => {
    const lonely = await db.variant.create({ data: { productId: (await db.variant.findUniqueOrThrow({ where: { id: firstVariant } })).productId,
      sku: `CAN-C-${randomUUID()}`.toUpperCase().slice(0, 64), size: 'XL', color: 'Đen', price: 200000, active: true,
      inventory: { create: { onHand: 5, reserved: 0 } } } });
    const { id } = await seedCancelable('PENDING', { lines: [{ variantId: lonely.id, quantity: 2 }], holding: false });
    expect((await cancel(admin, id, { expectedVersion: 0, reason: REASON })).status).toBe(409);
    expect(await orderOf(id)).toMatchObject({ status: 'PENDING', version: 0, cancelReason: null, cancelledAt: null });
    expect(await historyOf(id)).toHaveLength(1);
    expect(await stock(lonely.id)).toEqual({ onHand: 5, reserved: 0 });
  });

  it('shows the customer the cancellation and its reason without naming the admin', async () => {
    const token = 'F'.repeat(32);
    const { id, code } = await seedCancelable('PENDING', { token });
    expect((await cancel(admin, id, { expectedVersion: 0, reason: REASON })).status).toBe(200);
    const view = await guest.get(`/api/v1/orders/${code}`).set('X-Order-Token', token).expect(200);
    expect((view.body as { order: { status: string } }).order.status).toBe('CANCELLED');
    const raw = JSON.stringify(view.body);
    expect(raw).toContain(REASON);
    expect(raw).not.toContain('Admin đơn thử');
  });
});

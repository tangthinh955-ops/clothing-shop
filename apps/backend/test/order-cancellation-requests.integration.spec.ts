import { createIsolatedTestDatabase } from '../../../tools/test-database.mjs';
import { randomInt, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { hash } from 'argon2';
import supertest, { type Agent } from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApplication } from '../dist/application.js';
import { readEnvironment } from '../dist/config/environment.js';
import { MailService } from '../dist/modules/mail/mail.service.js';
import { generateLookupToken, lookupTokenHash } from '../dist/modules/orders/order-command.js';
import { OrderNotificationsService } from '../dist/modules/orders/order-notifications.service.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';

// M4.4.4 cancellation request: while an order is being packed the customer can only ask. Asking changes
// nothing about the order or its stock; the shop answers by cancelling or handing over, which closes it.

const origin = 'http://localhost:5173';
const password = 'cancel-request-only-password-123!';
const REASON = 'Tôi đổi ý rồi, số 0987654321';
const TRACKING = 'GHN-123.ABC_9';
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';

let app: Awaited<ReturnType<typeof createApplication>>;
let db: PrismaService;
let mail: MailService;
let isolated: Awaited<ReturnType<typeof createIsolatedTestDatabase>> | undefined;
let server: Server;
let guest: Agent;
let admin: Agent;
let adminEmail = '';
let categoryId = '';
let sequence = 0;

const ip = () => `10.${randomInt(1, 250)}.${randomInt(1, 250)}.${randomInt(1, 250)}`;
const commandKey = () => `request-${randomUUID()}`;
const csrfTokens = new Map<Agent, string>();

async function csrfOf(agent: Agent) {
  const known = csrfTokens.get(agent);
  if (known) return known;
  const token = (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
  csrfTokens.set(agent, token);
  return token;
}

type SeedStatus = 'PENDING' | 'CONFIRMED' | 'PACKING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'DELIVERY_FAILED' | 'RETURNED_TO_SHOP';

/** An order on its own variant, holding 2 of 5 pieces, so each test can state the exact stock it must leave. */
async function seedOrder(status: SeedStatus = 'PACKING') {
  sequence += 1;
  const code = `QQQQQQQQQQ${CODE_LETTERS[Math.floor(sequence / 23)]!}${CODE_LETTERS[sequence % 23]!}`;
  const token = generateLookupToken();
  const product = await db.product.create({ data: { name: 'Áo xin hủy', slug: `request-${randomUUID()}`, description: '', categoryId,
    status: 'PUBLISHED', priceFrom: 200000, variants: { create: [
      { sku: `RQS-${randomUUID()}`.toUpperCase().slice(0, 64), size: 'M', color: 'đen', price: 200000, active: true,
        inventory: { create: { onHand: 5, reserved: 2 } } }] } }, include: { variants: true } });
  const variantId = product.variants[0]!.id;
  const phone = `09${randomInt(10000000, 99999999)}`;
  const order = await db.order.create({ data: {
    code, status, source: 'WEB', userId: null, recipientName: 'Khách Xin Hủy', phone, email: null, province: 'Hà Nội', district: '',
    ward: 'Phường A', addressLine: '1 Phố B', note: null, method: 'COD', currency: 'VND', subtotalVnd: 400000, shippingFeeVnd: 30000,
    totalVnd: 430000, settingsVersion: 0, version: 0, lookupTokenHash: lookupTokenHash(token),
    items: { create: [{ variantId, productName: 'Áo xin hủy', sku: 'SKU-R', size: 'M', color: 'đen', unitPriceVnd: 200000, quantity: 2, lineTotalVnd: 400000 }] },
    history: { create: [{ fromStatus: null, toStatus: status, actorType: 'GUEST', actorId: null, version: 0 }] },
  } });
  return { id: order.id, code, token, variantId, phone };
}

interface SendOptions { key?: string; xff?: string; withCsrf?: boolean; withKey?: boolean }

async function send(code: string, token: string | undefined, body: unknown, options: SendOptions = {}) {
  const csrf = options.withCsrf === false ? undefined : await csrfOf(guest);
  const request = guest.post(`/api/v1/orders/${encodeURIComponent(code)}/cancellation-requests`).set('Origin', origin).set('X-Forwarded-For', options.xff ?? ip());
  if (csrf) request.set('X-CSRF-Token', csrf);
  if (token !== undefined) request.set('X-Order-Token', token);
  if (options.withKey !== false) request.set('Idempotency-Key', options.key ?? commandKey());
  return request.send(body as object);
}

async function adminPost(orderId: string, action: string, body: object) {
  const csrf = await csrfOf(admin);
  return admin.post(`/api/v1/admin/orders/${orderId}/${action}`).set('Origin', origin).set('X-CSRF-Token', csrf).set('Idempotency-Key', commandKey()).send(body);
}

const stockOf = (variantId: string) => db.inventory.findUniqueOrThrow({ where: { variantId }, select: { onHand: true, reserved: true } });
const requestsOf = (orderId: string) => db.cancellationRequest.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } });
const viewOf = async (code: string, token: string) =>
  (await guest.get(`/api/v1/orders/${code}`).set('X-Order-Token', token).set('X-Forwarded-For', ip()).expect(200)).body as
    { order: Record<string, unknown>; timeline: unknown[] };
const noticesOf = (orderId: string) => db.notificationDelivery.findMany({ where: { orderId, event: 'order.cancel-requested.shop' } });

async function settledNotices(orderId: string) {
  await vi.waitFor(async () => {
    const rows = await noticesOf(orderId);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.status === 'SENT' || row.status === 'FAILED')).toBe(true);
  }, { timeout: 5000 });
  return noticesOf(orderId);
}

beforeAll(async () => {
  isolated = await createIsolatedTestDatabase(process.env.DATABASE_URL!, 'cancelrequest');
  process.env.DATABASE_URL = isolated.databaseUrl;
  app = await createApplication(readEnvironment({ ...process.env, APP_ORIGIN: origin, TRUST_PROXY: '1' }));
  await app.listen(0, '127.0.0.1');
  db = app.get(PrismaService);
  mail = app.get(MailService);
  server = app.getHttpServer() as Server;
  guest = supertest.agent(server);
  admin = supertest.agent(server);
  categoryId = (await db.category.create({ data: { name: 'Danh mục xin hủy', slug: `request-${randomUUID()}`, active: true } })).id;
  adminEmail = `${randomUUID()}-admin@example.test`;
  await db.user.create({ data: { email: adminEmail, name: 'Admin xin hủy thử', role: 'ADMIN', passwordHash: await hash(password), emailVerifiedAt: new Date() } });
  const token = (await admin.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
  await admin.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', token).send({ email: adminEmail, password }).expect(200);
});

afterEach(() => vi.restoreAllMocks());

afterAll(async () => {
  try { if (app) await app.close(); } finally { await isolated?.cleanup(); }
});

describe('POST /orders/:code/cancellation-requests (M4.4.4)', () => {
  it('records the request and changes nothing about the order or its stock', async () => {
    const order = await seedOrder();
    const before = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    const response = await send(order.code, order.token, { reason: `  ${REASON}  ` });
    expect(response.status, JSON.stringify(response.body).slice(0, 200)).toBe(201);
    expect(response.body).toEqual({ status: 'PENDING', reason: REASON, createdAt: expect.any(String) });
    const [saved] = await requestsOf(order.id);
    expect(saved).toMatchObject({ status: 'PENDING', reason: REASON, decidedAt: null });
    const after = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect({ status: after.status, version: after.version, updatedAt: after.updatedAt, cancelReason: after.cancelReason })
      .toEqual({ status: 'PACKING', version: before.version, updatedAt: before.updatedAt, cancelReason: null });
    expect(await db.orderStatusHistory.count({ where: { orderId: order.id } })).toBe(1);
    expect(await stockOf(order.variantId)).toEqual({ onHand: 5, reserved: 2 });
    expect(await db.inventoryMovement.count({ where: { variantId: order.variantId } })).toBe(0);
  });

  it('shows the customer their waiting request, and nothing before it', async () => {
    const order = await seedOrder();
    expect((await viewOf(order.code, order.token)).order['cancellationRequest']).toBeNull();
    expect((await send(order.code, order.token, { reason: REASON })).status).toBe(201);
    const view = await viewOf(order.code, order.token);
    expect(view.order['cancellationRequest']).toEqual({ status: 'PENDING', reason: REASON, createdAt: expect.any(String) });
    expect(view.timeline).toHaveLength(1);
    expect(JSON.stringify(view)).not.toContain('Admin xin hủy thử');
  });

  it('shows the shop the request on the order and in the list', async () => {
    const order = await seedOrder();
    const quiet = await seedOrder();
    expect((await send(order.code, order.token, { reason: REASON })).status).toBe(201);
    const detail = await admin.get(`/api/v1/admin/orders/${order.id}`).expect(200);
    expect((detail.body as { cancellationRequests: unknown[] }).cancellationRequests)
      .toEqual([{ id: expect.any(String), status: 'PENDING', reason: REASON, createdAt: expect.any(String), decidedAt: null }]);
    const list = await admin.get('/api/v1/admin/orders').query({ q: order.code }).expect(200);
    expect((list.body as { items: Array<Record<string, unknown>> }).items[0]).toMatchObject({ code: order.code, hasPendingCancellationRequest: true });
    const other = await admin.get('/api/v1/admin/orders').query({ q: quiet.code }).expect(200);
    expect((other.body as { items: Array<Record<string, unknown>> }).items[0]).toMatchObject({ code: quiet.code, hasPendingCancellationRequest: false });
  });

  it.each(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'DELIVERY_FAILED', 'RETURNED_TO_SHOP'] as const)('refuses a %s order', async (status) => {
    const order = await seedOrder(status);
    expect((await send(order.code, order.token, { reason: REASON })).status).toBe(409);
    expect(await requestsOf(order.id)).toHaveLength(0);
  });

  it.each([
    ['a missing reason', {}],
    ['a reason shorter than 3 characters after trimming', { reason: '  ab  ' }],
    ['a reason over 500 characters', { reason: 'x'.repeat(501) }],
  ])('rejects %s', async (_label, body) => {
    const order = await seedOrder();
    expect((await send(order.code, order.token, body)).status).toBe(400);
    expect(await requestsOf(order.id)).toHaveLength(0);
  });

  it('refuses a request without CSRF or without a valid key', async () => {
    const order = await seedOrder();
    expect((await send(order.code, order.token, { reason: REASON }, { withCsrf: false })).status).toBe(403);
    expect((await send(order.code, order.token, { reason: REASON }, { withKey: false })).status).toBe(400);
    expect((await send(order.code, order.token, { reason: REASON }, { key: 'short' })).status).toBe(400);
    expect(await requestsOf(order.id)).toHaveLength(0);
  });

  it('answers every wrong access with the same 404', async () => {
    const order = await seedOrder();
    const other = await seedOrder();
    const body = { reason: REASON };
    const answers = [
      await send(order.code, 'A'.repeat(32), body),
      await send(order.code, other.token, body),
      await send('KHONGCODONNAY', order.token, body),
      await send(order.code, undefined, body),
      await send(order.code, 'ngan', body),
    ];
    for (const answer of answers) expect(answer.status).toBe(404);
    const shapes = answers.map((answer) => { const { code, message } = answer.body as { code: string; message: string }; return { code, message }; });
    expect(new Set(shapes.map((shape) => JSON.stringify(shape))).size).toBe(1);
    expect(await requestsOf(order.id)).toHaveLength(0);
    expect(await requestsOf(other.id)).toHaveLength(0);
  });

  it('stops honouring an old link once a lookup replaced its token', async () => {
    const order = await seedOrder();
    const csrf = await csrfOf(guest);
    const lookup = await guest.post('/api/v1/orders/lookup').set('Origin', origin).set('X-CSRF-Token', csrf).set('X-Forwarded-For', ip())
      .send({ code: order.code, phone: order.phone }).expect(200);
    expect((await send(order.code, order.token, { reason: REASON })).status).toBe(404);
    expect((await send(order.code, (lookup.body as { lookupToken: string }).lookupToken, { reason: REASON })).status).toBe(201);
  });

  it('does not open a way around the shop: direct cancel still refuses a packing order', async () => {
    const order = await seedOrder();
    expect((await send(order.code, order.token, { reason: REASON })).status).toBe(201);
    const csrf = await csrfOf(guest);
    const direct = await guest.post(`/api/v1/orders/${order.code}/cancel`).set('Origin', origin).set('X-CSRF-Token', csrf).set('X-Forwarded-For', ip())
      .set('X-Order-Token', order.token).set('Idempotency-Key', commandKey()).send({ expectedVersion: 0, reason: REASON });
    expect(direct.status).toBe(409);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PACKING');
  });

  it('replays the same key to the same request, and refuses that key with another reason', async () => {
    const order = await seedOrder();
    const key = commandKey();
    const first = await send(order.code, order.token, { reason: REASON }, { key });
    expect(first.status).toBe(201);
    const replay = await send(order.code, order.token, { reason: REASON }, { key });
    expect(replay.status).toBe(201);
    expect(replay.body).toEqual(first.body);
    expect((await send(order.code, order.token, { reason: 'Lý do khác hẳn' }, { key })).status).toBe(409);
    expect(await requestsOf(order.id)).toHaveLength(1);
  });

  it('refuses a second request under a new key while one is waiting', async () => {
    const order = await seedOrder();
    expect((await send(order.code, order.token, { reason: REASON })).status).toBe(201);
    expect((await send(order.code, order.token, { reason: 'Lần nữa' })).status).toBe(409);
    expect(await requestsOf(order.id)).toHaveLength(1);
  });

  it('creates one request when the same key races', async () => {
    const order = await seedOrder();
    const key = commandKey();
    const results = await Promise.all([send(order.code, order.token, { reason: REASON }, { key }), send(order.code, order.token, { reason: REASON }, { key })]);
    expect(results.map((result) => result.status)).toEqual([201, 201]);
    expect(await requestsOf(order.id)).toHaveLength(1);
  });

  it('creates one request when two keys race', async () => {
    const order = await seedOrder();
    const results = await Promise.all([send(order.code, order.token, { reason: REASON }), send(order.code, order.token, { reason: REASON })]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await requestsOf(order.id)).toHaveLength(1);
  });

  it('counts as agreed when the shop cancels, which releases the stock once', async () => {
    const order = await seedOrder();
    expect((await send(order.code, order.token, { reason: REASON })).status).toBe(201);
    expect((await adminPost(order.id, 'cancel', { expectedVersion: 0, reason: 'Đồng ý với khách' })).status).toBe(200);
    const [closed] = await requestsOf(order.id);
    expect(closed).toMatchObject({ status: 'APPROVED' });
    expect(closed!.decidedAt).toBeInstanceOf(Date);
    expect(await stockOf(order.variantId)).toEqual({ onHand: 5, reserved: 0 });
    expect((await viewOf(order.code, order.token)).order).toMatchObject({ status: 'CANCELLED', cancellationRequest: null });
  });

  it('counts as refused when the shop hands over anyway', async () => {
    const order = await seedOrder();
    expect((await send(order.code, order.token, { reason: REASON })).status).toBe(201);
    expect((await adminPost(order.id, 'ship', { expectedVersion: 0, trackingNumber: TRACKING })).status).toBe(200);
    const [closed] = await requestsOf(order.id);
    expect(closed).toMatchObject({ status: 'REJECTED' });
    expect(closed!.decidedAt).toBeInstanceOf(Date);
    expect((await viewOf(order.code, order.token)).order).toMatchObject({ status: 'SHIPPED', cancellationRequest: null });
  });

  it.each([
    ['handing over', 'ship', { expectedVersion: 0, trackingNumber: TRACKING }, 'SHIPPED'],
    ['cancelling', 'cancel', { expectedVersion: 0, reason: 'Shop hủy' }, 'CANCELLED'],
  ])('never leaves a waiting request behind when it races the shop %s', async (_label, action, body, status) => {
    const order = await seedOrder();
    const [request, step] = await Promise.all([send(order.code, order.token, { reason: REASON }), adminPost(order.id, action, body)]);
    expect(step.status).toBe(200);
    expect([201, 409]).toContain(request.status);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(status);
    expect(await db.cancellationRequest.count({ where: { orderId: order.id, status: 'PENDING' } })).toBe(0);
    expect(await requestsOf(order.id)).toHaveLength(request.status === 201 ? 1 : 0);
  });

  it('rolls the request back when the mail row cannot be written with it', async () => {
    const order = await seedOrder();
    vi.spyOn(app.get(OrderNotificationsService), 'enqueueCancelRequested').mockRejectedValueOnce(new Error('write failed'));
    expect((await send(order.code, order.token, { reason: REASON })).status).toBe(500);
    expect(await requestsOf(order.id)).toHaveLength(0);
  });

  it('limits attempts per client address', async () => {
    const order = await seedOrder();
    const xff = ip();
    for (let attempt = 0; attempt < 5; attempt += 1) expect((await send(order.code, 'A'.repeat(32), { reason: REASON }, { xff })).status).toBe(404);
    expect((await send(order.code, 'A'.repeat(32), { reason: REASON }, { xff })).status).toBe(429);
  });
});

describe('telling the shop about a request (M4.4.4)', () => {
  it('mails each active admin without the reason, and does not mail again on a replay', async () => {
    const notice = vi.spyOn(mail, 'sendOrderNotice').mockResolvedValue(true);
    const order = await seedOrder();
    const key = commandKey();
    expect((await send(order.code, order.token, { reason: REASON }, { key })).status).toBe(201);
    const rows = await settledNotices(order.id);
    expect(rows.map((row) => row.recipient)).toEqual([adminEmail]);
    expect(rows[0]).toMatchObject({ status: 'SENT', attempts: 1 });
    const [to, subject, text] = notice.mock.calls[0]!;
    expect(to).toBe(adminEmail);
    expect(subject).toBe(`Khách xin hủy đơn ${order.code} | ADECY`);
    expect(text).toContain(`${origin}/admin/orders/${order.id}`);
    expect(`${subject}\n${text}`).not.toContain(REASON);
    expect(`${subject}\n${text}`).not.toContain('0987654321');
    expect((await send(order.code, order.token, { reason: REASON }, { key })).status).toBe(201);
    await new Promise((resolve) => { setTimeout(resolve, 200); });
    expect(notice).toHaveBeenCalledTimes(1);
  });

  it('keeps the request when the mail fails, and the retry pass sends it', async () => {
    const notice = vi.spyOn(mail, 'sendOrderNotice').mockResolvedValue(false);
    const order = await seedOrder();
    expect((await send(order.code, order.token, { reason: REASON })).status).toBe(201);
    const [failed] = await settledNotices(order.id);
    expect(failed).toMatchObject({ status: 'FAILED', attempts: 1 });
    expect(await requestsOf(order.id)).toHaveLength(1);
    notice.mockReset();
    notice.mockResolvedValue(true);
    await app.get(OrderNotificationsService).processDue(new Date(Date.now() + 2 * 60000));
    expect(notice.mock.calls.some(([, subject]) => subject.includes(`Khách xin hủy đơn ${order.code}`))).toBe(true);
    expect((await noticesOf(order.id))[0]).toMatchObject({ status: 'SENT', attempts: 2 });
  });
});

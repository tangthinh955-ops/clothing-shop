import { createIsolatedTestDatabase } from '../../../tools/test-database.mjs';
import { randomInt, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { hash } from 'argon2';
import supertest, { type Agent } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../dist/application.js';
import { readEnvironment } from '../dist/config/environment.js';
import { generateLookupToken, lookupTokenHash } from '../dist/modules/orders/order-command.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';

// M4.4.3 customer cancellation: the private link cancels its own order before packing, gives the held
// stock back once, and answers every wrong access with one uniform 404.

const origin = 'http://localhost:5173';
const password = 'order-cancel-only-password-123!';
const REASON = 'Tôi đặt nhầm size';
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';

let app: Awaited<ReturnType<typeof createApplication>>;
let db: PrismaService;
let isolated: Awaited<ReturnType<typeof createIsolatedTestDatabase>> | undefined;
let server: Server;
let guest: Agent;
let admin: Agent;
let categoryId = '';
let sequence = 0;

const ip = () => `10.${randomInt(1, 250)}.${randomInt(1, 250)}.${randomInt(1, 250)}`;
const commandKey = () => `cancel-${randomUUID()}`;
const csrfTokens = new Map<Agent, string>();

async function csrfOf(agent: Agent) {
  const known = csrfTokens.get(agent);
  if (known) return known;
  const token = (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
  csrfTokens.set(agent, token);
  return token;
}

type SeedStatus = 'PENDING' | 'CONFIRMED' | 'PACKING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'DELIVERY_FAILED' | 'RETURNED_TO_SHOP';

/** A web order on its own variant, holding 2 of 5 pieces, so each test can state the exact stock it must leave. */
async function seedOrder(status: SeedStatus = 'PENDING', overrides: { holding?: boolean } = {}) {
  sequence += 1;
  const code = `KKKKKKKKKK${CODE_LETTERS[Math.floor(sequence / 23)]!}${CODE_LETTERS[sequence % 23]!}`;
  const token = generateLookupToken();
  const holding = overrides.holding ?? true;
  const product = await db.product.create({ data: { name: 'Áo khách hủy', slug: `cancel-${randomUUID()}`, description: '', categoryId,
    status: 'PUBLISHED', priceFrom: 200000, variants: { create: [
      { sku: `CNL-${randomUUID()}`.toUpperCase().slice(0, 64), size: 'M', color: 'đen', price: 200000, active: true,
        inventory: { create: { onHand: 5, reserved: holding ? 2 : 0 } } }] } }, include: { variants: true } });
  const variantId = product.variants[0]!.id;
  const phone = `09${randomInt(10000000, 99999999)}`;
  const order = await db.order.create({ data: {
    code, status, source: 'WEB', userId: null, recipientName: 'Khách Hủy', phone, email: null, province: 'Hà Nội', district: '',
    ward: 'Phường A', addressLine: '1 Phố B', note: null, method: 'COD', currency: 'VND', subtotalVnd: 400000, shippingFeeVnd: 30000,
    totalVnd: 430000, settingsVersion: 0, version: 0, lookupTokenHash: lookupTokenHash(token),
    items: { create: [{ variantId, productName: 'Áo khách hủy', sku: 'SKU-A', size: 'M', color: 'đen', unitPriceVnd: 200000, quantity: 2, lineTotalVnd: 400000 }] },
    history: { create: [{ fromStatus: null, toStatus: status, actorType: 'GUEST', actorId: null, version: 0 }] },
  } });
  return { id: order.id, code, token, variantId, phone };
}

interface CancelOptions { key?: string; xff?: string; withCsrf?: boolean; withKey?: boolean }

async function cancel(code: string, token: string | undefined, body: unknown, options: CancelOptions = {}) {
  const csrf = options.withCsrf === false ? undefined : await csrfOf(guest);
  const request = guest.post(`/api/v1/orders/${encodeURIComponent(code)}/cancel`).set('Origin', origin).set('X-Forwarded-For', options.xff ?? ip());
  if (csrf) request.set('X-CSRF-Token', csrf);
  if (token !== undefined) request.set('X-Order-Token', token);
  if (options.withKey !== false) request.set('Idempotency-Key', options.key ?? commandKey());
  return request.send(body as object);
}

const stockOf = (variantId: string) => db.inventory.findUniqueOrThrow({ where: { variantId }, select: { onHand: true, reserved: true } });
const orderOf = (id: string) => db.order.findUniqueOrThrow({ where: { id } });
const historyOf = (orderId: string) => db.orderStatusHistory.findMany({ where: { orderId }, orderBy: { version: 'asc' } });
const releases = (code: string) => db.inventoryMovement.findMany({ where: { source: 'ORDER_RELEASE', reason: `Khách hủy đơn ${code}` } });

beforeAll(async () => {
  isolated = await createIsolatedTestDatabase(process.env.DATABASE_URL!, 'ordercancel');
  process.env.DATABASE_URL = isolated.databaseUrl;
  app = await createApplication(readEnvironment({ ...process.env, APP_ORIGIN: origin, TRUST_PROXY: '1' }));
  await app.listen(0, '127.0.0.1');
  db = app.get(PrismaService);
  server = app.getHttpServer() as Server;
  guest = supertest.agent(server);
  admin = supertest.agent(server);
  categoryId = (await db.category.create({ data: { name: 'Danh mục khách hủy', slug: `cancel-${randomUUID()}`, active: true } })).id;
  const email = `${randomUUID()}-admin@example.test`;
  await db.user.create({ data: { email, name: 'Admin hủy thử', role: 'ADMIN', passwordHash: await hash(password), emailVerifiedAt: new Date() } });
  const token = (await admin.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
  await admin.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', token).send({ email, password }).expect(200);
});

afterAll(async () => {
  try { if (app) await app.close(); } finally { await isolated?.cleanup(); }
});

describe('POST /orders/:code/cancel (M4.4.3)', () => {
  it.each(['PENDING', 'CONFIRMED'] as const)('cancels a %s order, gives back only what it held and records why', async (status) => {
    const order = await seedOrder(status);
    const response = await cancel(order.code, order.token, { expectedVersion: 0, reason: `  ${REASON}  ` });
    expect(response.status, JSON.stringify(response.body).slice(0, 200)).toBe(200);
    expect(response.body).toEqual({ code: order.code, status: 'CANCELLED', version: 1 });
    expect(await stockOf(order.variantId)).toEqual({ onHand: 5, reserved: 0 });
    const saved = await orderOf(order.id);
    expect(saved).toMatchObject({ status: 'CANCELLED', version: 1, cancelReason: REASON });
    expect(saved.cancelledAt).toBeInstanceOf(Date);
    const history = await historyOf(order.id);
    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({ fromStatus: status, toStatus: 'CANCELLED', actorType: 'GUEST', actorId: null, reason: REASON, version: 1 });
  });

  it('records the release as the guest, without copying the free-text reason', async () => {
    const order = await seedOrder();
    expect((await cancel(order.code, order.token, { expectedVersion: 0, reason: REASON })).status).toBe(200);
    const movements = await releases(order.code);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ actorType: 'GUEST', actorId: null, delta: 0, reason: `Khách hủy đơn ${order.code}` });
  });

  it('shows the cancellation to the customer and to the shop', async () => {
    const order = await seedOrder();
    expect((await cancel(order.code, order.token, { expectedVersion: 0, reason: REASON })).status).toBe(200);
    const view = await guest.get(`/api/v1/orders/${order.code}`).set('X-Order-Token', order.token).set('X-Forwarded-For', ip()).expect(200);
    const body = view.body as { order: { status: string }; timeline: Array<Record<string, unknown>> };
    expect(body.order.status).toBe('CANCELLED');
    expect(body.timeline.at(-1)).toMatchObject({ toStatus: 'CANCELLED', actorLabel: 'Khách đặt hàng', reason: REASON, version: 1 });
    const detail = await admin.get(`/api/v1/admin/orders/${order.id}`).expect(200);
    expect(detail.body).toMatchObject({ status: 'CANCELLED', cancelReason: REASON });
    expect((detail.body as { history: Array<Record<string, unknown>> }).history.at(-1)).toMatchObject({ actorName: 'Khách đặt hàng', reason: REASON });
  });

  it('answers every wrong access with the same 404 and changes nothing', async () => {
    const order = await seedOrder();
    const other = await seedOrder();
    const body = { expectedVersion: 0, reason: REASON };
    const answers = [
      await cancel(order.code, 'A'.repeat(32), body),
      await cancel(order.code, other.token, body),
      await cancel('KHONGCODONNAY', order.token, body),
      await cancel(order.code, undefined, body),
      await cancel(order.code, 'ngan', body),
    ];
    for (const answer of answers) expect(answer.status).toBe(404);
    const shapes = answers.map((answer) => { const { code, message } = answer.body as { code: string; message: string }; return { code, message }; });
    expect(new Set(shapes.map((shape) => JSON.stringify(shape))).size).toBe(1);
    expect(await orderOf(order.id)).toMatchObject({ status: 'PENDING', version: 0, cancelReason: null });
    expect(await orderOf(other.id)).toMatchObject({ status: 'PENDING', version: 0 });
    expect(await stockOf(order.variantId)).toEqual({ onHand: 5, reserved: 2 });
  });

  it('stops honouring an old link once a lookup replaced its token', async () => {
    const order = await seedOrder();
    const csrf = await csrfOf(guest);
    const lookup = await guest.post('/api/v1/orders/lookup').set('Origin', origin).set('X-CSRF-Token', csrf).set('X-Forwarded-For', ip())
      .send({ code: order.code, phone: order.phone }).expect(200);
    expect((await cancel(order.code, order.token, { expectedVersion: 0, reason: REASON })).status).toBe(404);
    expect((await orderOf(order.id)).status).toBe('PENDING');
    expect((await cancel(order.code, (lookup.body as { lookupToken: string }).lookupToken, { expectedVersion: 0, reason: REASON })).status).toBe(200);
  });

  it('refuses a request without CSRF or without a valid key', async () => {
    const order = await seedOrder();
    expect((await cancel(order.code, order.token, { expectedVersion: 0, reason: REASON }, { withCsrf: false })).status).toBe(403);
    expect((await cancel(order.code, order.token, { expectedVersion: 0, reason: REASON }, { withKey: false })).status).toBe(400);
    expect((await cancel(order.code, order.token, { expectedVersion: 0, reason: REASON }, { key: 'short' })).status).toBe(400);
    expect((await orderOf(order.id)).status).toBe('PENDING');
  });

  it.each([
    ['a missing reason', { expectedVersion: 0 }],
    ['a reason shorter than 3 characters after trimming', { expectedVersion: 0, reason: '  ab  ' }],
    ['a reason over 500 characters', { expectedVersion: 0, reason: 'x'.repeat(501) }],
    ['a missing version', { reason: REASON }],
  ])('rejects %s without touching the order or the stock', async (_label, body) => {
    const order = await seedOrder();
    expect((await cancel(order.code, order.token, body)).status).toBe(400);
    expect((await orderOf(order.id)).status).toBe('PENDING');
    expect(await stockOf(order.variantId)).toEqual({ onHand: 5, reserved: 2 });
  });

  it.each(['PACKING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'DELIVERY_FAILED', 'RETURNED_TO_SHOP'] as const)('refuses a %s order and changes nothing', async (status) => {
    const order = await seedOrder(status);
    expect((await cancel(order.code, order.token, { expectedVersion: 0, reason: REASON })).status).toBe(409);
    expect(await orderOf(order.id)).toMatchObject({ status, version: 0, cancelReason: null });
    expect(await stockOf(order.variantId)).toEqual({ onHand: 5, reserved: 2 });
    expect(await releases(order.code)).toHaveLength(0);
  });

  it('refuses a stale version without changing the order or the stock', async () => {
    const order = await seedOrder();
    expect((await cancel(order.code, order.token, { expectedVersion: 7, reason: REASON })).status).toBe(409);
    expect(await orderOf(order.id)).toMatchObject({ status: 'PENDING', version: 0 });
    expect(await stockOf(order.variantId)).toEqual({ onHand: 5, reserved: 2 });
  });

  it('replays the same key once, and refuses that key with another reason', async () => {
    const order = await seedOrder();
    const key = commandKey();
    expect((await cancel(order.code, order.token, { expectedVersion: 0, reason: REASON }, { key })).status).toBe(200);
    const replay = await cancel(order.code, order.token, { expectedVersion: 0, reason: REASON }, { key });
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual({ code: order.code, status: 'CANCELLED', version: 1 });
    expect((await cancel(order.code, order.token, { expectedVersion: 0, reason: 'Lý do khác hẳn' }, { key })).status).toBe(409);
    expect(await stockOf(order.variantId)).toEqual({ onHand: 5, reserved: 0 });
    expect(await historyOf(order.id)).toHaveLength(2);
    expect((await orderOf(order.id)).cancelReason).toBe(REASON);
  });

  it('releases once when the same key races', async () => {
    const order = await seedOrder();
    const key = commandKey();
    const body = { expectedVersion: 0, reason: REASON };
    const results = await Promise.all([cancel(order.code, order.token, body, { key }), cancel(order.code, order.token, body, { key })]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(await stockOf(order.variantId)).toEqual({ onHand: 5, reserved: 0 });
    expect(await releases(order.code)).toHaveLength(1);
  });

  it('lets exactly one of two racing requests win when their keys differ', async () => {
    const order = await seedOrder();
    const body = { expectedVersion: 0, reason: REASON };
    const results = await Promise.all([cancel(order.code, order.token, body), cancel(order.code, order.token, body)]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(await stockOf(order.variantId)).toEqual({ onHand: 5, reserved: 0 });
    expect(await releases(order.code)).toHaveLength(1);
  });

  it('leaves a consistent order when the customer races an admin packing it', async () => {
    const order = await seedOrder('CONFIRMED');
    const csrf = await csrfOf(admin);
    const packing = admin.post(`/api/v1/admin/orders/${order.id}/pack`).set('Origin', origin).set('X-CSRF-Token', csrf)
      .set('Idempotency-Key', commandKey()).send({ expectedVersion: 0 });
    const results = await Promise.all([cancel(order.code, order.token, { expectedVersion: 0, reason: REASON }), packing]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const cancelled = results[0]!.status === 200;
    expect(await orderOf(order.id)).toMatchObject({ status: cancelled ? 'CANCELLED' : 'PACKING', version: 1 });
    expect(await stockOf(order.variantId)).toEqual({ onHand: 5, reserved: cancelled ? 0 : 2 });
  });

  it('releases once when the customer races an admin cancelling it', async () => {
    const order = await seedOrder();
    const csrf = await csrfOf(admin);
    const adminCancel = admin.post(`/api/v1/admin/orders/${order.id}/cancel`).set('Origin', origin).set('X-CSRF-Token', csrf)
      .set('Idempotency-Key', commandKey()).send({ expectedVersion: 0, reason: 'Shop hết hàng' });
    const results = await Promise.all([cancel(order.code, order.token, { expectedVersion: 0, reason: REASON }), adminCancel]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(await stockOf(order.variantId)).toEqual({ onHand: 5, reserved: 0 });
    expect(await db.inventoryMovement.count({ where: { source: 'ORDER_RELEASE', variantId: order.variantId } })).toBe(1);
  });

  it('rolls everything back when the stock cannot be released', async () => {
    const order = await seedOrder('PENDING', { holding: false });
    expect((await cancel(order.code, order.token, { expectedVersion: 0, reason: REASON })).status).toBe(409);
    expect(await orderOf(order.id)).toMatchObject({ status: 'PENDING', version: 0, cancelReason: null, cancelledAt: null });
    expect(await historyOf(order.id)).toHaveLength(1);
    expect(await stockOf(order.variantId)).toEqual({ onHand: 5, reserved: 0 });
  });

  it('limits attempts per client address', async () => {
    const order = await seedOrder();
    const xff = ip();
    const body = { expectedVersion: 0, reason: REASON };
    for (let attempt = 0; attempt < 5; attempt += 1) expect((await cancel(order.code, 'A'.repeat(32), body, { xff })).status).toBe(404);
    expect((await cancel(order.code, 'A'.repeat(32), body, { xff })).status).toBe(429);
    expect((await orderOf(order.id)).status).toBe('PENDING');
  });
});

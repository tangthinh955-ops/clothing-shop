import { createIsolatedTestDatabase } from '../../../tools/test-database.mjs';
import { randomInt, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { hash } from 'argon2';
import supertest, { type Agent } from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApplication } from '../dist/application.js';
import { readEnvironment } from '../dist/config/environment.js';
import { generateLookupToken, lookupTokenHash } from '../dist/modules/orders/order-command.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';

// M4.5.8: the shop can refuse a waiting cancellation request without touching the order's goods or
// money — the order stays PACKING, the customer reads the reason and may ask again, and each request
// owns its own shop notice. The decision rides the same lock/version/idempotency rules as a step.

const origin = 'http://localhost:5173';
const password = 'cancellation-decision-password-123!';
const REASON = 'Đơn đã đóng gói theo yêu cầu giữ nguyên mẫu';
const REJECT_REASON = 'Mẫu này khách đặt riêng, không thể hủy giữa chừng';
const TRACKING = 'GHN-123.ABC_9';
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';

let app: Awaited<ReturnType<typeof createApplication>>;
let db: PrismaService;
let isolated: Awaited<ReturnType<typeof createIsolatedTestDatabase>> | undefined;
let server: Server;
let guest: Agent;
let admin: Agent;
let customer: Agent;
let adminEmail = '';
let categoryId = '';
let sequence = 0;

const ip = () => `10.${randomInt(1, 250)}.${randomInt(1, 250)}.${randomInt(1, 250)}`;
const commandKey = () => `decision-${randomUUID()}`;
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
  const code = `RRRRRRRRRR${CODE_LETTERS[Math.floor(sequence / 23)]!}${CODE_LETTERS[sequence % 23]!}`;
  const token = generateLookupToken();
  const product = await db.product.create({ data: { name: 'Áo quyết định hủy', slug: `decision-${randomUUID()}`, description: '', categoryId,
    status: 'PUBLISHED', priceFrom: 200000, variants: { create: [
      { sku: `DCS-${randomUUID()}`.toUpperCase().slice(0, 64), size: 'M', color: 'đen', price: 200000, active: true,
        inventory: { create: { onHand: 5, reserved: 2 } } }] } }, include: { variants: true } });
  const variantId = product.variants[0]!.id;
  const phone = `09${randomInt(10000000, 99999999)}`;
  const order = await db.order.create({ data: {
    code, status, source: 'WEB', userId: null, recipientName: 'Khách Quyết Định', phone, email: null, province: 'Hà Nội', district: '',
    ward: 'Phường B', addressLine: '2 Phố C', note: null, method: 'COD', currency: 'VND', subtotalVnd: 400000, shippingFeeVnd: 30000,
    totalVnd: 430000, settingsVersion: 0, version: 0, lookupTokenHash: lookupTokenHash(token),
    items: { create: [{ variantId, productName: 'Áo quyết định hủy', sku: 'SKU-D', size: 'M', color: 'đen', unitPriceVnd: 200000, quantity: 2, lineTotalVnd: 400000 }] },
    history: { create: [{ fromStatus: null, toStatus: status, actorType: 'GUEST', actorId: null, version: 0 }] },
  } });
  return { id: order.id, code, token, variantId, phone };
}

/** A waiting request from the customer, through the real endpoint, so ids and notices line up with production. */
async function submitRequest(order: Awaited<ReturnType<typeof seedOrder>>, reason = REASON, key = commandKey()) {
  const csrf = await csrfOf(guest);
  const response = await guest.post(`/api/v1/orders/${order.code}/cancellation-requests`).set('Origin', origin)
    .set('X-CSRF-Token', csrf).set('X-Order-Token', order.token).set('X-Forwarded-For', ip())
    .set('Idempotency-Key', key).send({ reason });
  expect(response.status, JSON.stringify(response.body).slice(0, 200)).toBe(201);
  return (await db.cancellationRequest.findFirstOrThrow({ where: { orderId: order.id, status: 'PENDING' } })).id;
}

interface DecideOptions { key?: string; withCsrf?: boolean; withKey?: boolean }

async function decide(orderId: string, body: unknown, options: DecideOptions = {}) {
  const request = admin.post(`/api/v1/admin/orders/${orderId}/cancellation-decisions`).set('Origin', origin);
  if (options.withCsrf !== false) request.set('X-CSRF-Token', await csrfOf(admin));
  if (options.withKey !== false) request.set('Idempotency-Key', options.key ?? commandKey());
  return request.send(body as object);
}

const stockOf = (variantId: string) => db.inventory.findUniqueOrThrow({ where: { variantId }, select: { onHand: true, reserved: true } });
const requestsOf = (orderId: string) => db.cancellationRequest.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } });
const viewOf = async (code: string, token: string) =>
  (await guest.get(`/api/v1/orders/${code}`).set('X-Order-Token', token).set('X-Forwarded-For', ip()).expect(200)).body as
    { order: Record<string, unknown>; timeline: unknown[] };
const noticesOf = (orderId: string) => db.notificationDelivery.findMany({ where: { orderId, event: 'order.cancel-requested.shop' } });

beforeAll(async () => {
  isolated = await createIsolatedTestDatabase(process.env.DATABASE_URL!, 'canceldecision');
  process.env.DATABASE_URL = isolated.databaseUrl;
  app = await createApplication(readEnvironment({ ...process.env, APP_ORIGIN: origin, TRUST_PROXY: '1' }));
  await app.listen(0, '127.0.0.1');
  db = app.get(PrismaService);
  server = app.getHttpServer() as Server;
  guest = supertest.agent(server);
  admin = supertest.agent(server);
  customer = supertest.agent(server);
  categoryId = (await db.category.create({ data: { name: 'Danh mục quyết định hủy', slug: `decision-${randomUUID()}`, active: true } })).id;
  const customerEmail = `${randomUUID()}-customer@example.test`;
  adminEmail = `${randomUUID()}-admin@example.test`;
  const passwordHash = await hash(password);
  await db.user.create({ data: { email: adminEmail, name: 'Admin quyết định thử', role: 'ADMIN', passwordHash, emailVerifiedAt: new Date() } });
  await db.user.create({ data: { email: customerEmail, name: 'Khách có tài khoản', role: 'CUSTOMER', passwordHash, emailVerifiedAt: new Date() } });
  for (const [agent, email] of [[admin, adminEmail], [customer, customerEmail]] as const) {
    const token = (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
    await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', token).send({ email, password }).expect(200);
  }
});

afterEach(() => vi.restoreAllMocks());

afterAll(async () => {
  try { if (app) await app.close(); } finally { await isolated?.cleanup(); }
});

describe('POST /admin/orders/:id/cancellation-decisions (M4.5.8)', () => {
  it('refuses the decision keeping the order PACKING, recorded on the request alone', async () => {
    const order = await seedOrder();
    const requestId = await submitRequest(order);
    const before = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    const historyBefore = await db.orderStatusHistory.count({ where: { orderId: order.id } });
    const response = await decide(order.id, { requestId, expectedVersion: before.version, decision: 'REJECTED', reason: `  ${REJECT_REASON}  ` });
    expect(response.status, JSON.stringify(response.body).slice(0, 200)).toBe(200);
    expect(response.body).toEqual({ requestId, decision: 'REJECTED', decidedAt: expect.any(String),
      order: { id: order.id, code: order.code, status: 'PACKING', version: before.version + 1 } });
    const [saved] = await requestsOf(order.id);
    expect(saved).toMatchObject({ status: 'REJECTED', reason: REASON, decisionReason: REJECT_REASON, decidedById: expect.any(String) });
    expect(saved!.decidedAt).toBeInstanceOf(Date);
    expect(saved!.decidedById).not.toBeNull();
    const after = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect({ status: after.status, version: after.version, cancelReason: after.cancelReason, totalVnd: after.totalVnd })
      .toEqual({ status: 'PACKING', version: before.version + 1, cancelReason: null, totalVnd: before.totalVnd });
    // The status never moved, so no fake PACKING → PACKING history row may appear.
    expect(await db.orderStatusHistory.count({ where: { orderId: order.id } })).toBe(historyBefore);
    expect(await stockOf(order.variantId)).toEqual({ onHand: 5, reserved: 2 });
    expect(await db.inventoryMovement.count({ where: { variantId: order.variantId } })).toBe(0);
    // A refusal mails nobody; the request's own notice already went out when it was submitted.
    expect(await noticesOf(order.id)).toHaveLength(1);
  });

  it('answers 401 without a session and 403 to a non-admin account', async () => {
    const order = await seedOrder();
    const requestId = await submitRequest(order);
    const body = { requestId, expectedVersion: 0, decision: 'REJECTED', reason: REJECT_REASON };
    // A stranger still needs its own anonymous CSRF pair; after that the session is what is missing.
    const stranger = supertest.agent(server);
    const strangerCsrf = (await stranger.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
    expect((await stranger.post(`/api/v1/admin/orders/${order.id}/cancellation-decisions`).set('Origin', origin)
      .set('X-CSRF-Token', strangerCsrf).send(body)).status).toBe(401);
    expect((await customer.post(`/api/v1/admin/orders/${order.id}/cancellation-decisions`).set('Origin', origin)
      .set('X-CSRF-Token', await csrfOf(customer)).send(body)).status).toBe(403);
    expect(await requestsOf(order.id)).toMatchObject([{ status: 'PENDING' }]);
  });

  it('refuses a request without CSRF or without a valid key', async () => {
    const order = await seedOrder();
    const requestId = await submitRequest(order);
    const body = { requestId, expectedVersion: 0, decision: 'REJECTED', reason: REJECT_REASON };
    expect((await decide(order.id, body, { withCsrf: false })).status).toBe(403);
    expect((await decide(order.id, body, { withKey: false })).status).toBe(400);
    expect((await decide(order.id, body, { key: 'short' })).status).toBe(400);
    expect(await requestsOf(order.id)).toMatchObject([{ status: 'PENDING' }]);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).version).toBe(0);
  });

  it.each([
    ['a missing reason', { requestId: randomUUID(), expectedVersion: 0, decision: 'REJECTED' }],
    ['a reason shorter than 3 characters after trimming', { requestId: randomUUID(), expectedVersion: 0, decision: 'REJECTED', reason: '  ab  ' }],
    ['a reason over 500 characters', { requestId: randomUUID(), expectedVersion: 0, decision: 'REJECTED', reason: 'x'.repeat(501) }],
    ['a request id that is not a UUID', { requestId: 'khong-phai-uuid', expectedVersion: 0, decision: 'REJECTED', reason: REJECT_REASON }],
    ['a decision other than REJECTED', { requestId: randomUUID(), expectedVersion: 0, decision: 'APPROVED', reason: REJECT_REASON }],
    ['a missing expectedVersion', { requestId: randomUUID(), decision: 'REJECTED', reason: REJECT_REASON }],
    ['a negative expectedVersion', { requestId: randomUUID(), expectedVersion: -1, decision: 'REJECTED', reason: REJECT_REASON }],
  ])('rejects %s with 400 and writes nothing', async (_label, body) => {
    const order = await seedOrder();
    expect((await decide(order.id, body)).status).toBe(400);
    expect(await requestsOf(order.id)).toHaveLength(0);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).version).toBe(0);
  });

  it('refuses a stale version so a decision and a competing step have one winner', async () => {
    const order = await seedOrder();
    const requestId = await submitRequest(order);
    expect((await decide(order.id, { requestId, expectedVersion: 99, decision: 'REJECTED', reason: REJECT_REASON })).status).toBe(409);
    expect(await requestsOf(order.id)).toMatchObject([{ status: 'PENDING' }]);
  });

  it.each(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'DELIVERY_FAILED', 'RETURNED_TO_SHOP'] as const)('refuses a %s order', async (status) => {
    const order = await seedOrder();
    const requestId = await submitRequest(order);
    // Move the order on after asking, the way a handover or an older link would have.
    await db.order.update({ where: { id: order.id }, data: { status } });
    expect((await decide(order.id, { requestId, expectedVersion: 0, decision: 'REJECTED', reason: REJECT_REASON })).status).toBe(409);
    expect(await requestsOf(order.id)).toMatchObject([{ status: 'PENDING' }]);
  });

  it('refuses a request that is not waiting: already decided or belonging to another order', async () => {
    const order = await seedOrder();
    const other = await seedOrder();
    const requestId = await submitRequest(order);
    const unknown = randomUUID();
    expect((await decide(order.id, { requestId: unknown, expectedVersion: 0, decision: 'REJECTED', reason: REJECT_REASON })).status).toBe(409);
    expect((await decide(order.id, { requestId, expectedVersion: 0, decision: 'REJECTED', reason: REJECT_REASON })).status).toBe(200);
    // Once decided the same id may not be consumed again, whatever the version it carries.
    expect((await decide(order.id, { requestId, expectedVersion: 1, decision: 'REJECTED', reason: 'Lần nữa' })).status).toBe(409);
    // A request of another order must not be answered through this order's endpoint.
    const otherRequest = await submitRequest(other);
    expect((await decide(order.id, { requestId: otherRequest, expectedVersion: 1, decision: 'REJECTED', reason: REJECT_REASON })).status).toBe(409);
    const requests = await requestsOf(order.id);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ status: 'REJECTED', decisionReason: REJECT_REASON });
  });

  it('never leaves a waiting request behind when the refusal races the shop handing over or cancelling', async () => {
    for (const [action, body, status] of [
      ['ship', { expectedVersion: 0, trackingNumber: TRACKING }, 'SHIPPED'],
      ['cancel', { expectedVersion: 0, reason: 'Shop hủy' }, 'CANCELLED'],
    ] as const) {
      const order = await seedOrder();
      const requestId = await submitRequest(order);
      const [decision, step] = await Promise.all([
        decide(order.id, { requestId, expectedVersion: 0, decision: 'REJECTED', reason: REJECT_REASON }),
        (async () => {
          const csrf = await csrfOf(admin);
          return admin.post(`/api/v1/admin/orders/${order.id}/${action}`).set('Origin', origin)
            .set('X-CSRF-Token', csrf).set('Idempotency-Key', commandKey()).send(body);
        })(),
      ]);
      // Either side may win the lock; exactly one command succeeds on the same expected version. The
      // winner is whichever acquires the row lock first — the assertions below derive from the observed
      // winner instead of forcing one, so the test stays honest without sleeps or scheduler guessing.
      // (Deterministic coverage of each closing outcome lives elsewhere: an admin cancel after asking
      // approves the request, a handover refuses it, and the sequential refusal tests refuse it.)
      expect([decision.status, step.status].sort()).toEqual([200, 409]);
      const [closed] = await requestsOf(order.id);
      expect(closed!.status).toBe(decision.status === 200 || action === 'ship' ? 'REJECTED' : 'APPROVED');
      const after = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(after.status).toBe(decision.status === 200 ? 'PACKING' : status);
      expect(after.version).toBe(1);
      expect(await db.cancellationRequest.count({ where: { orderId: order.id, status: 'PENDING' } })).toBe(0);
      expect(await requestsOf(order.id)).toHaveLength(1);
      // Only the winning command's effect touches the stock, exactly once: a refusal changes nothing.
      const movementCount = await db.inventoryMovement.count({ where: { variantId: order.variantId } });
      if (decision.status === 200) {
        expect(await stockOf(order.variantId)).toEqual({ onHand: 5, reserved: 2 });
        expect(movementCount).toBe(0);
      } else if (action === 'ship') {
        expect(await stockOf(order.variantId)).toEqual({ onHand: 3, reserved: 0 });
        expect(movementCount).toBe(1);
      } else {
        expect(await stockOf(order.variantId)).toEqual({ onHand: 5, reserved: 0 });
        expect(movementCount).toBe(1);
      }
    }
  });

  it('lets only one of two refusals racing on the same version through', async () => {
    const order = await seedOrder();
    const requestId = await submitRequest(order);
    const [first, second] = await Promise.all([
      decide(order.id, { requestId, expectedVersion: 0, decision: 'REJECTED', reason: REJECT_REASON }),
      decide(order.id, { requestId, expectedVersion: 0, decision: 'REJECTED', reason: 'Lý do khác' }),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(await requestsOf(order.id)).toHaveLength(1);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).version).toBe(1);
  });

  it('replays the same key to the same result and refuses that key with another body', async () => {
    const order = await seedOrder();
    const requestId = await submitRequest(order);
    const key = commandKey();
    const first = await decide(order.id, { requestId, expectedVersion: 0, decision: 'REJECTED', reason: REJECT_REASON }, { key });
    expect(first.status).toBe(200);
    const replay = await decide(order.id, { requestId, expectedVersion: 0, decision: 'REJECTED', reason: REJECT_REASON }, { key });
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(first.body);
    for (const body of [
      { requestId, expectedVersion: 0, decision: 'REJECTED', reason: 'Lý do khác hẳn' },
      { requestId: randomUUID(), expectedVersion: 0, decision: 'REJECTED', reason: REJECT_REASON },
      { requestId, expectedVersion: 1, decision: 'REJECTED', reason: REJECT_REASON },
    ]) {
      expect((await decide(order.id, body, { key })).status).toBe(409);
    }
    expect(await requestsOf(order.id)).toHaveLength(1);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).version).toBe(1);
  });

  it('creates one decision when the same key races a lost response', async () => {
    const order = await seedOrder();
    const requestId = await submitRequest(order);
    const key = commandKey();
    const body = { requestId, expectedVersion: 0, decision: 'REJECTED', reason: REJECT_REASON };
    const results = await Promise.all([decide(order.id, body, { key }), decide(order.id, body, { key })]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(await requestsOf(order.id)).toHaveLength(1);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).version).toBe(1);
  });
});

describe('the customer and the shop read the refusal (M4.5.8)', () => {
  it('shows the customer the refusal while packing, then their next request replaces it, and the shop gets one notice per request', async () => {
    const order = await seedOrder();
    const firstKey = commandKey();
    const requestId = await submitRequest(order, REASON, firstKey);
    expect((await decide(order.id, { requestId, expectedVersion: 0, decision: 'REJECTED', reason: REJECT_REASON })).status).toBe(200);

    const refused = await viewOf(order.code, order.token);
    expect(refused.order['cancellationDecision']).toEqual({ status: 'REJECTED', reason: REJECT_REASON, decidedAt: expect.any(String) });
    expect(refused.order['cancellationRequest']).toBeNull();
    // Staff identity stays behind the admin login.
    expect(JSON.stringify(refused)).not.toContain('Admin quyết định thử');
    expect(JSON.stringify(refused)).not.toContain('decidedById');

    // Replaying the first submit key returns the saved request (as it reads now) and opens nothing new.
    const replay = await guest.post(`/api/v1/orders/${order.code}/cancellation-requests`).set('Origin', origin)
      .set('X-CSRF-Token', await csrfOf(guest)).set('X-Order-Token', order.token).set('X-Forwarded-For', ip())
      .set('Idempotency-Key', firstKey).send({ reason: REASON });
    expect(replay.status).toBe(201);
    expect(replay.body).toMatchObject({ reason: REASON });
    expect(['PENDING', 'REJECTED']).toContain((replay.body as { status: string }).status);
    // The same key with another reason cannot become a new request either.
    const hijack = await guest.post(`/api/v1/orders/${order.code}/cancellation-requests`).set('Origin', origin)
      .set('X-CSRF-Token', await csrfOf(guest)).set('X-Order-Token', order.token).set('X-Forwarded-For', ip())
      .set('Idempotency-Key', firstKey).send({ reason: 'Lý do lần hai' });
    expect(hijack.status).toBe(409);
    expect(await requestsOf(order.id)).toHaveLength(1);
    expect(await noticesOf(order.id)).toHaveLength(1);

    // The customer may ask again under a fresh key; the refusal is no longer presented as the current state.
    const secondId = await submitRequest(order, 'Xin hủy lần hai vì đổi địa chỉ');
    expect(secondId).not.toBe(requestId);
    const waiting = await viewOf(order.code, order.token);
    expect(waiting.order['cancellationDecision']).toBeNull();
    expect(waiting.order['cancellationRequest']).toMatchObject({ status: 'PENDING', reason: 'Xin hủy lần hai vì đổi địa chỉ' });

    // Both asks end up with their own delivered notice: separate occurrence keys, no shared row.
    let rows = await noticesOf(order.id);
    await vi.waitFor(async () => {
      rows = await noticesOf(order.id);
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.status === 'SENT' || row.status === 'FAILED')).toBe(true);
    }, { timeout: 5000 });
    expect(new Set(rows.map((row) => row.occurrenceKey))).toEqual(new Set([requestId, secondId]));
    for (const row of rows) expect(row.status).toBe('SENT');

    const detail = await admin.get(`/api/v1/admin/orders/${order.id}`).expect(200);
    const seen = (detail.body as { cancellationRequests: Array<Record<string, unknown>> }).cancellationRequests;
    expect(seen).toHaveLength(2);
    expect(seen[0]).toMatchObject({ status: 'REJECTED', reason: REASON, decisionReason: REJECT_REASON,
      decidedById: expect.any(String), decidedByName: 'Admin quyết định thử' });
    expect(seen[1]).toMatchObject({ status: 'PENDING', reason: 'Xin hủy lần hai vì đổi địa chỉ', decisionReason: null, decidedById: null, decidedByName: null });
    // The audit of the first request survives the second one untouched.
    const [first, second] = await requestsOf(order.id);
    expect(first).toMatchObject({ id: requestId, status: 'REJECTED', decisionReason: REJECT_REASON });
    expect(second).toMatchObject({ id: secondId, status: 'PENDING', decisionReason: null, decidedAt: null });
  });

  it('leaves an old ship-refusal row without decision metadata out of the customer view', async () => {
    const order = await seedOrder();
    const requestId = await submitRequest(order);
    await db.cancellationRequest.update({ where: { id: requestId }, data: { status: 'REJECTED', decidedAt: new Date() } });
    const refused = await viewOf(order.code, order.token);
    expect(refused.order['cancellationDecision']).toBeNull();
    const detail = await admin.get(`/api/v1/admin/orders/${order.id}`).expect(200);
    const [seen] = (detail.body as { cancellationRequests: Array<Record<string, unknown>> }).cancellationRequests;
    expect(seen).toMatchObject({ status: 'REJECTED', decisionReason: null, decidedById: null, decidedByName: null });
  });
});

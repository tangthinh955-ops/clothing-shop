import { createIsolatedTestDatabase } from '../../../tools/test-database.mjs';
import { randomInt, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import supertest, { type Agent } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../dist/application.js';
import { readEnvironment } from '../dist/config/environment.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';

// Guest COD checkout: quote re-verification, atomic order/items/history/reserve/command record,
// per-phone pending quota, per-IP rate limit and lost-response replays — all on real PostgreSQL.

const origin = 'http://localhost:5173';
let app: Awaited<ReturnType<typeof createApplication>>;
let db: PrismaService;
let isolated: Awaited<ReturnType<typeof createIsolatedTestDatabase>> | undefined;
let server: Server;
let guest: Agent;

let categoryId = '';

// A fresh phone per test keeps the pending-quota counts independent of test order.
const testPhone = () => `09${randomInt(10000000, 99999999)}`;
const keyFor = (label: string) => `order-${label}-${randomUUID()}`;
// Distinct client IPs per test keep the real 5/min/IP limiter from bleeding between scenarios;
// the limiter itself is verified with a fixed IP in its own test.
const ip = () => `10.${randomInt(1, 250)}.${randomInt(1, 250)}.${randomInt(1, 250)}`;

async function requestQuote(items: Array<{ variantId: string; quantity: number }>): Promise<{ id: string; body: Record<string, unknown> }> {
  let csrfToken = '';
  {
    const csrf = await guest.get('/api/v1/auth/csrf').expect(200);
    csrfToken = (csrf.body as { csrfToken: string }).csrfToken;
  }
  const response = await guest.post('/api/v1/checkout/quote').set('X-CSRF-Token', csrfToken)
    .set('Origin', origin).send({ items, method: 'COD' }).expect(201);
  return { id: response.body.quoteId as string, body: response.body as Record<string, unknown> };
}

/** Each scenario builds its own product/variant so accumulated reservations never leak between tests. */
async function makeVariant(price: number, onHand: number, name: string): Promise<string> {
  const product = await db.product.create({ data: { name, slug: `order-${randomUUID()}`, description: '', categoryId,
    status: 'PUBLISHED', priceFrom: price, variants: { create: [
      { sku: `ORD-${randomUUID()}`.toUpperCase().slice(0, 64), size: 'M', color: 'đen', price, active: true,
        inventory: { create: { onHand, reserved: 0 } } }] } }, include: { variants: true } });
  return product.variants[0]!.id;
}

/** Guest create command: one CSRF token, one client IP, one Idempotency-Key. */
async function create(input: { key: string; ipXff: string; body: object }): Promise<supertest.Response> {
  const csrf = await guest.get('/api/v1/auth/csrf').expect(200);
  const token = (csrf.body as { csrfToken: string }).csrfToken;
  return await guest.post('/api/v1/orders')
    .set('X-CSRF-Token', token).set('Origin', origin)
    .set('X-Forwarded-For', input.ipXff).set('Idempotency-Key', input.key)
    .send(input.body);
}

const codBody = (quote: { id: string; body: Record<string, unknown> }, items: Array<{ variantId: string; quantity: number }>,
  phone = testPhone()) => ({
  quoteId: quote.id,
  items,
  contact: { name: 'Nguyễn Thử', phone, email: 'guest@example.test' },
  address: { province: 'TP. Hồ Chí Minh', district: '', ward: 'Phường Bến Nghé', addressLine: '12 Nguyễn Huệ' },
  note: 'Giao giờ hành chính',
  method: 'COD',
});

beforeAll(async () => {
  isolated = await createIsolatedTestDatabase(process.env.DATABASE_URL!, 'order');
  process.env.DATABASE_URL = isolated.databaseUrl;
  // TRUST_PROXY=1 lets each test present its own client IP through X-Forwarded-For, mirroring the
  // production proxy path and isolating the per-IP rate limit between scenarios.
  app = await createApplication(readEnvironment({ ...process.env, APP_ORIGIN: origin, TRUST_PROXY: '1' }));
  await app.listen(0, '127.0.0.1');
  db = app.get(PrismaService); server = app.getHttpServer() as Server;
  guest = supertest.agent(server);
  await db.shopSettings.create({ data: { id: 'default', shippingFeeVnd: 30000, bankDeadlineMinutes: 120 } });
  const category = await db.category.create({ data: { name: 'Danh mục đặt đơn thử', slug: `order-${randomUUID()}`, active: true } });
  categoryId = category.id;
});

afterAll(async () => {
  try { if (app) await app.close(); } finally { await isolated?.cleanup(); }
});

describe('POST /orders (M4.3.1 guest COD checkout)', () => {
  it('creates a PENDING order atomically: snapshot, history, reserve and command record commit together', async () => {
    const variantA = await makeVariant(200000, 5, 'Áo đặt đơn A');
    const variantB = await makeVariant(300000, 3, 'Quần đặt đơn B');
    const quote = await requestQuote([{ variantId: variantA, quantity: 2 }, { variantId: variantB, quantity: 1 }]);
    const orderPhone = testPhone();
    const response = await create({ key: keyFor('happy'), ipXff: ip(), body: codBody(quote,
      [{ variantId: variantA, quantity: 2 }, { variantId: variantB, quantity: 1 }], orderPhone) });
    expect(response.status, JSON.stringify(response.body).slice(0, 300)).toBe(201);
    const body = response.body as { order: Record<string, unknown>; lookupToken?: string };
    expect(body.order).toMatchObject({ status: 'PENDING', method: 'COD', currency: 'VND',
      subtotal: 700000, shippingFee: 30000, total: 730000 });
    expect(String(body.order['code'])).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);
    expect(body.lookupToken).toMatch(/^[A-Za-z0-9_-]{32}$/);

    const row = await db.order.findUniqueOrThrow({ where: { code: String(body.order['code']) }, include: { items: true, history: true } });
    expect(row).toMatchObject({ status: 'PENDING', source: 'WEB', userId: null, phone: orderPhone, method: 'COD', version: 0 });
    expect(Number(row.subtotalVnd)).toBe(700000);
    expect(Number(row.totalVnd)).toBe(730000);
    expect(row.items).toHaveLength(2);
    expect(row.history).toHaveLength(1);
    expect(row.history[0]).toMatchObject({ fromStatus: null, toStatus: 'PENDING', actorType: 'GUEST', actorId: null, version: 0 });
    expect(row.lookupTokenHash).not.toBe(body.lookupToken); // only the SHA-256 is stored

    const record = await db.idempotencyRecord.findFirstOrThrow({ where: { resourceId: row.id, scope: 'orders.create' } });
    const recordText = JSON.stringify(record);
    expect(recordText).not.toContain(String(body.lookupToken));
    expect(recordText).not.toContain('Nguyễn Thử');
    expect(recordText).not.toContain('Nguyễn Thử');
    expect(recordText).not.toContain('guest@example.test');

    expect(await db.inventory.findUniqueOrThrow({ where: { variantId: variantA } })).toMatchObject({ onHand: 5, reserved: 2 });
    expect(await db.inventory.findUniqueOrThrow({ where: { variantId: variantB } })).toMatchObject({ onHand: 3, reserved: 1 });
    const movements = await db.inventoryMovement.findMany({ where: { effectKey: { startsWith: `order:${row.id}:reserve` } } });
    expect(movements).toHaveLength(2);
    expect(await db.order.count({ where: { phone: orderPhone } })).toBe(1);
  });

  it('answers a replay with the same order even after the quote expired, without new effects or token', async () => {
    const variantA = await makeVariant(200000, 5, 'Áo replay');
    const key = keyFor('replay');
    const orderPhone = testPhone(); // the replay must hash the exact same command, phone included
    const quote = await requestQuote([{ variantId: variantA, quantity: 1 }]);
    const first = await create({ key, ipXff: ip(), body: codBody(quote, [{ variantId: variantA, quantity: 1 }], orderPhone) });
    expect(first.status, JSON.stringify(first.body).slice(0, 300)).toBe(201);
    const firstCode = ((first.body as { order: { code: string } }).order).code;
    const reservedBefore = (await db.inventory.findUniqueOrThrow({ where: { variantId: variantA } })).reserved;
    // The quote expires after the order committed; the retry of the same command must still replay.
    await db.checkoutQuote.update({ where: { id: quote.id }, data: { expiresAt: new Date(Date.now() - 60000) } });
    const replay = await create({ key, ipXff: ip(), body: codBody(quote, [{ variantId: variantA, quantity: 1 }], orderPhone) });
    expect(replay.status, JSON.stringify(replay.body).slice(0, 300)).toBe(201);
    expect((replay.body as { order: { code: string } }).order.code).toBe(firstCode);
    expect((replay.body as { lookupToken?: string }).lookupToken).toBeUndefined();
    expect((await db.inventory.findUniqueOrThrow({ where: { variantId: variantA } })).reserved).toBe(reservedBefore);
    expect(await db.order.count({ where: { code: firstCode, status: 'PENDING' } })).toBe(1); // replay is not a new order
  });

  it('rejects the same key with different content and a mismatching, expired or repriced quote', async () => {
    const variantA = await makeVariant(200000, 9, 'Áo chặn đơn');
    const conflictKey = keyFor('conflict');
    const quote = await requestQuote([{ variantId: variantA, quantity: 1 }]);
    const first = await create({ key: conflictKey, ipXff: ip(), body: codBody(quote, [{ variantId: variantA, quantity: 1 }], testPhone()) });
    expect(first.status).toBe(201);
    const different = await create({ key: conflictKey, ipXff: ip(),
      body: codBody(quote, [{ variantId: variantA, quantity: 2 }], testPhone()) });
    expect(different.status).toBe(409);
    expect((different.body as { code?: string }).code).toBe('CONFLICT');

    const mismatchQuote = await requestQuote([{ variantId: variantA, quantity: 2 }]);
    const mismatch = await create({ key: keyFor('mismatch'), ipXff: ip(),
      body: codBody(mismatchQuote, [{ variantId: variantA, quantity: 1 }], testPhone()) });
    expect(mismatch.status).toBe(409);
    expect((mismatch.body as { code?: string }).code).toBe('QUOTE_CHANGED');

    const expiredQuote = await requestQuote([{ variantId: variantA, quantity: 1 }]);
    await db.checkoutQuote.update({ where: { id: expiredQuote.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await create({ key: keyFor('expired'), ipXff: ip(),
      body: codBody(expiredQuote, [{ variantId: variantA, quantity: 1 }], testPhone()) });
    expect(expired.status).toBe(409);
    expect((expired.body as { code?: string }).code).toBe('QUOTE_CHANGED');

    const priceQuote = await requestQuote([{ variantId: variantA, quantity: 1 }]);
    await db.variant.update({ where: { id: variantA }, data: { price: 250000 } });
    const priceChanged = await create({ key: keyFor('price'), ipXff: ip(), body: codBody(priceQuote, [{ variantId: variantA, quantity: 1 }], testPhone()) });
    expect(priceChanged.status).toBe(409);
    expect((priceChanged.body as { code?: string }).code).toBe('QUOTE_CHANGED');
    const feeQuote = await requestQuote([{ variantId: variantA, quantity: 1 }]);
    await db.shopSettings.update({ where: { id: 'default' }, data: { shippingFeeVnd: 40000, version: { increment: 1 } } });
    const feeChanged = await create({ key: keyFor('fee'), ipXff: ip(), body: codBody(feeQuote, [{ variantId: variantA, quantity: 1 }], testPhone()) });
    expect(feeChanged.status).toBe(409);
    expect((feeChanged.body as { code?: string }).code).toBe('QUOTE_CHANGED');
    await db.shopSettings.update({ where: { id: 'default' }, data: { shippingFeeVnd: 30000 } });
  });

  it('lets only one of two concurrent same-key requests create the order', async () => {
    const variantC = await makeVariant(100000, 4, 'Mũ concurrent');
    const key = keyFor('concurrent');
    const quote = await requestQuote([{ variantId: variantC, quantity: 1 }]);
    const body = codBody(quote, [{ variantId: variantC, quantity: 1 }], testPhone());
    const [first, second] = await Promise.allSettled([
      create({ key, ipXff: ip(), body }),
      create({ key, ipXff: ip(), body }),
    ]);
    const statuses = [first, second].map((outcome) => outcome.status === 'fulfilled' ? outcome.value.status : 'error');
    expect(statuses.filter((status) => status === 201)).toHaveLength(2); // one commit, one clean replay
    const codes = [first, second].map((outcome) => ((outcome as PromiseFulfilledResult<supertest.Response>).value.body as { order?: { code?: string } }).order?.code);
    expect(codes[0]).toBe(codes[1]); // the replay returns the winner's order
    expect(await db.order.count({ where: { code: codes[0]!, status: 'PENDING' } })).toBe(1);
    expect(await db.idempotencyRecord.count({ where: { key } })).toBe(1);
    const movements = await db.inventoryMovement.findMany({ where: { effectKey: { startsWith: 'order:' } } });
    expect(movements.filter((movement) => movement.variantId === variantC)).toHaveLength(1); // no double reserve
  });

  it('lets exactly one of two guests take the last unit and rolls the loser back fully', async () => {
    const variantA = await makeVariant(200000, 2, 'Áo tranh chiếc cuối');
    const winnerQuote = await requestQuote([{ variantId: variantA, quantity: 2 }]);
    const loserQuote = await requestQuote([{ variantId: variantA, quantity: 2 }]);
    const [first, second] = await Promise.allSettled([
      create({ key: keyFor('race-w'), ipXff: ip(), body: codBody(winnerQuote, [{ variantId: variantA, quantity: 2 }], testPhone()) }),
      create({ key: keyFor('race-l'), ipXff: ip(), body: codBody(loserQuote, [{ variantId: variantA, quantity: 2 }], testPhone()) }),
    ]);
    const outcomes = [first, second].map((outcome) => outcome.status === 'fulfilled' ? outcome.value.status : 409);
    expect(outcomes.filter((status) => status === 201)).toHaveLength(1);
    expect(outcomes.filter((status) => status === 409)).toHaveLength(1);
    expect((await db.inventory.findUniqueOrThrow({ where: { variantId: variantA } })).reserved).toBe(2);
    // Either guest may take the inventory row lock first — the winner is whoever answered 201,
    // not whichever promise settled first.
    const winner = [first, second].find((outcome) =>
      outcome.status === 'fulfilled' && outcome.value.status === 201) as PromiseFulfilledResult<supertest.Response>;
    const winnerCode = (winner.value.body as { order?: { code?: string } }).order?.code;
    expect(await db.order.count({ where: { code: winnerCode!, status: 'PENDING' } })).toBe(1);
  });

  it('rolls back everything when one line lacks stock at creation time', async () => {
    const variantA = await makeVariant(200000, 5, 'Áo rollback');
    const variantB = await makeVariant(300000, 1, 'Quần rollback');
    const quote = await requestQuote([{ variantId: variantA, quantity: 2 }, { variantId: variantB, quantity: 1 }]);
    await db.inventory.update({ where: { variantId: variantB }, data: { onHand: 0, reserved: 0 } });
    const ordersBefore = await db.order.count();
    const reservedBefore = (await db.inventory.findUniqueOrThrow({ where: { variantId: variantA } })).reserved;
    const response = await create({ key: keyFor('rollback'), ipXff: ip(),
      body: codBody(quote, [{ variantId: variantA, quantity: 2 }, { variantId: variantB, quantity: 1 }], testPhone()) });
    expect(response.status).toBe(409);
    expect((response.body as { code?: string }).code).toBe('OUT_OF_STOCK');
    expect(await db.order.count()).toBe(ordersBefore);
    expect((await db.inventory.findUniqueOrThrow({ where: { variantId: variantA } })).reserved).toBe(reservedBefore);
  });

  it('blocks client-injected money, status, user or actor fields with the whitelist', async () => {
    const variantA = await makeVariant(200000, 5, 'Áo whitelist');
    const quote = await requestQuote([{ variantId: variantA, quantity: 1 }]);
    const withMoney = await create({ key: keyFor('money'), ipXff: ip(),
      body: { ...codBody(quote, [{ variantId: variantA, quantity: 1 }]), subtotal: 1, total: 1 } });
    expect(withMoney.status).toBe(400);
    const withStatus = await create({ key: keyFor('status'), ipXff: ip(),
      body: { ...codBody(quote, [{ variantId: variantA, quantity: 1 }]), status: 'CONFIRMED', userId: randomUUID() } });
    expect(withStatus.status).toBe(400);
    expect((withStatus.body as { code?: string }).code).toBe('VALIDATION_ERROR');
  });

  it('caps pending orders per normalized phone at three, safely under concurrency', async () => {
    const variantC = await makeVariant(100000, 10, 'Mũ quota');
    const quotaPhone = '0900000003';
    const quote = await requestQuote([{ variantId: variantC, quantity: 1 }]);
    const body = codBody(quote, [{ variantId: variantC, quantity: 1 }], quotaPhone);
    for (let index = 0; index < 3; index += 1) {
      const response = await create({ key: keyFor(`quota-${index}`), ipXff: ip(), body });
      expect(response.status).toBe(201);
    }
    const fourth = await create({ key: keyFor('quota-over'), ipXff: ip(), body });
    expect(fourth.status).toBe(429);
    expect((fourth.body as { code?: string }).code).toBe('RATE_LIMITED');
    // Four concurrent requests for a fresh phone: exactly three may win the quota race.
    const concurrentPhone = '0900000004';
    const concurrentBody = codBody(quote, [{ variantId: variantC, quantity: 1 }], concurrentPhone);
    const outcomes = await Promise.allSettled([0, 1, 2, 3].map((index) =>
      create({ key: keyFor(`quota-c-${index}`), ipXff: ip(), body: concurrentBody })));
    const statuses = outcomes.map((outcome) => outcome.status === 'fulfilled' ? outcome.value.status : 429);
    expect(statuses.filter((status) => status === 201)).toHaveLength(3);
    expect(statuses.filter((status) => status === 429)).toHaveLength(1);
    expect(await db.order.count({ where: { phone: concurrentPhone, status: 'PENDING' } })).toBe(3);
  });

  it('refuses with QUOTE_CHANGED when the quote expires while waiting on the phone lock', async () => {
    const lockPhone = '0900000005';
    const variantC = await makeVariant(100000, 5, 'Mũ hết hạn chờ khóa');
    const quote = await requestQuote([{ variantId: variantC, quantity: 1 }]);
    // The quote expires in ~3 seconds of real PostgreSQL time.
    await db.checkoutQuote.update({ where: { id: quote.id },
      data: { expiresAt: new Date(Date.now() + 3000) } });
    const holder = new PrismaService(readEnvironment(process.env));
    try {
      const createPromise = create({ key: keyFor('expiry-lock'), ipXff: ip(),
        body: codBody(quote, [{ variantId: variantC, quantity: 1 }], lockPhone) });
      // Hold the same phone's advisory lock past the quote expiry; the create must wait behind it.
      // Hold past the quote expiry; the timeout override keeps Prisma from aborting the holder.
      await holder.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockPhone})::bigint) IS NOT NULL AS locked`;
        await new Promise((resolve) => setTimeout(resolve, 6000));
      }, { timeout: 15000 });
      const response = await createPromise;
      expect(response.status).toBe(409);
      expect((response.body as { code?: string }).code).toBe('QUOTE_CHANGED');
      expect(await db.order.count({ where: { phone: lockPhone } })).toBe(0);
    } finally { await holder.$disconnect(); }
  });

  it('rejects a create missing the contact or address objects with 400, never 500', async () => {
    const variantA = await makeVariant(200000, 5, 'Áo thiếu DTO');
    const withoutContact = await create({ key: keyFor('no-contact'), ipXff: ip(),
      body: { quoteId: '00000000-0000-4000-8000-000000000000', items: [{ variantId: variantA, quantity: 1 }],
        address: { province: 'TP. Hồ Chí Minh', ward: 'Phường Bến Nghé', addressLine: '12 Nguyễn Huệ' }, method: 'COD' } });
    expect(withoutContact.status).toBe(400);
    expect((withoutContact.body as { code?: string }).code).toBe('VALIDATION_ERROR');
    const nullAddress = await create({ key: keyFor('null-address'), ipXff: ip(),
      body: { quoteId: '00000000-0000-4000-8000-000000000000', items: [{ variantId: variantA, quantity: 1 }],
        contact: { name: 'Nguyễn Thử', phone: '0901234567' }, address: null, method: 'COD' } });
    expect(nullAddress.status).toBe(400);
    expect((nullAddress.body as { code?: string }).code).toBe('VALIDATION_ERROR');
    const wrongType = await create({ key: keyFor('bad-contact'), ipXff: ip(),
      body: { quoteId: '00000000-0000-4000-8000-000000000000', items: [{ variantId: variantA, quantity: 1 }],
        contact: 'nguyễn', address: { province: 'TP. Hồ Chí Minh', ward: 'Phường Bến Nghé', addressLine: '12 Nguyễn Huệ' }, method: 'COD' } });
    expect(wrongType.status).toBe(400);
  });

  it('rate limits order creation per client IP with the approved bucket', async () => {
    const variantA = await makeVariant(200000, 9, 'Áo rate limit');
    const fixedIp = `10.77.77.${randomInt(1, 250)}`;
    const quote = await requestQuote([{ variantId: variantA, quantity: 1 }]);
    const body = codBody(quote, [{ variantId: variantA, quantity: 1 }]);
    let last: supertest.Response | undefined;
    for (let index = 0; index < 6; index += 1) {
      last = await create({ key: keyFor(`rate-${index}`), ipXff: fixedIp, body });
    }
    expect(last!.status).toBe(429);
    expect((last!.body as { code?: string }).code).toBe('RATE_LIMITED');
  });

  it('requires the CSRF mechanism for guests like every other write-shaped request', async () => {
    const response = await guest.post('/api/v1/orders').set('Origin', origin)
      .set('Idempotency-Key', keyFor('csrf')).send(codBody(
        { id: '00000000-0000-4000-8000-000000000000', body: {} }, [{ variantId: randomUUID(), quantity: 1 }]));
    expect(response.status).toBe(403);
  });
});

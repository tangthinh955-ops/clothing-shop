import { createIsolatedTestDatabase } from '../../../tools/test-database.mjs';
import { randomInt, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import supertest, { type Agent } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../dist/application.js';
import { readEnvironment } from '../dist/config/environment.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';
import { lookupTokenHash } from '../dist/modules/orders/order-command.js';

// M4.4.2 guest order lookup: POST /orders/lookup verifies code+phone, rotates the stored SHA-256
// and answers the same allowlisted view as M4.4.1 with the new token — every failure is uniform.

const origin = 'http://localhost:5173';
const UNIFORM_404 = 'Không tìm thấy đơn hàng. Kiểm tra lại mã đơn hoặc đường dẫn đã nhận từ shop.';
// Order codes use the same unambiguous alphabet as generateOrderCode; CODE_C shares CODE_A's phone
// on purpose: a lookup answer must never mention the other order of the same phone.
const CODE_A = 'ABCDUVWXYZ2';
const CODE_B = 'MNPQRSTUV34';
const CODE_C = 'QWERTYUPJKM';
const PHONE_A = '0901230001';
const PHONE_B = '0905990002';
const TOKEN_A = 'A'.repeat(32);
const TOKEN_B = 'B'.repeat(32);
const TOKEN_C = 'C'.repeat(32);
const NOTE_500 = 'Ghi chú dài hợp lệ: '.padEnd(499, 'x') + '.'; // exact orders.note VARCHAR(500) limit
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/; // 192-bit base64url, mirrors generateLookupToken

let app: Awaited<ReturnType<typeof createApplication>>;
let db: PrismaService;
let isolated: Awaited<ReturnType<typeof createIsolatedTestDatabase>> | undefined;
let server: Server;
let guest: Agent;

let categoryId = '';
let variantA = '';
let variantB = '';

// Distinct client IPs per request keep the real 5/min/IP lookup limiter from bleeding between
// scenarios; the limiter itself is verified with a fixed IP in its own test.
const ip = () => `10.${randomInt(1, 250)}.${randomInt(1, 250)}.${randomInt(1, 250)}`;

async function csrfFor(agent: Agent): Promise<string> {
  const csrf = await agent.get('/api/v1/auth/csrf').expect(200);
  return (csrf.body as { csrfToken: string }).csrfToken;
}

async function lookup(body: unknown, ipXff: string = ip()): Promise<supertest.Test> {
  const csrfToken = await csrfFor(guest);
  return guest.post('/api/v1/orders/lookup')
    .set('X-CSRF-Token', csrfToken).set('Origin', origin).set('X-Forwarded-For', ipXff)
    .send(body);
}

/** Two truly simultaneous lookups: both CSRF fetches first, then both POSTs race. */
function lookupInParallel(bodies: [unknown, unknown]): Promise<[supertest.Response, supertest.Response]> {
  return Promise.all(bodies.map(async (body) => {
    const csrfToken = await csrfFor(guest);
    return guest.post('/api/v1/orders/lookup')
      .set('X-CSRF-Token', csrfToken).set('Origin', origin).set('X-Forwarded-For', ip())
      .send(body);
  })) as Promise<[supertest.Response, supertest.Response]>;
}

function access(code: string, ipXff: string, token?: string): supertest.Test {
  const request = guest.get(`/api/v1/orders/${code}`).set('X-Forwarded-For', ipXff);
  return token === undefined ? request : request.set('X-Order-Token', token);
}

const storedHash = async (code: string): Promise<string | null> =>
  (await db.order.findUniqueOrThrow({ where: { code }, select: { lookupTokenHash: true } })).lookupTokenHash;

beforeAll(async () => {
  isolated = await createIsolatedTestDatabase(process.env.DATABASE_URL!, 'orderlookup');
  process.env.DATABASE_URL = isolated.databaseUrl;
  // TRUST_PROXY=1 lets each request present its own client IP through X-Forwarded-For, mirroring
  // the production proxy path and isolating the per-IP rate limit between scenarios.
  app = await createApplication(readEnvironment({ ...process.env, APP_ORIGIN: origin, TRUST_PROXY: '1' }));
  await app.listen(0, '127.0.0.1');
  db = app.get(PrismaService); server = app.getHttpServer() as Server;
  guest = supertest.agent(server);
  await db.shopSettings.create({ data: { id: 'default', shippingFeeVnd: 30000, bankDeadlineMinutes: 120 } });
  const category = await db.category.create({ data: { name: 'Danh mục tra cứu thử', slug: `lookup-${randomUUID()}`, active: true } });
  categoryId = category.id;
  const productA = await db.product.create({ data: { name: 'Áo tra cứu', slug: `lookup-a-${randomUUID()}`, description: '', categoryId,
    status: 'PUBLISHED', priceFrom: 400000, variants: { create: [
      { sku: `LKA-${randomUUID()}`.toUpperCase().slice(0, 64), size: 'M', color: 'Đen', price: 400000, active: true,
        inventory: { create: { onHand: 5, reserved: 1 } } } ] } },
    include: { variants: true } });
  variantA = productA.variants[0]!.id;
  const productB = await db.product.create({ data: { name: 'Quần tra cứu', slug: `lookup-b-${randomUUID()}`, description: '', categoryId,
    status: 'PUBLISHED', priceFrom: 250000, variants: { create: [
      { sku: `LKB-${randomUUID()}`.toUpperCase().slice(0, 64), size: 'L', color: 'Xanh', price: 250000, active: true,
        inventory: { create: { onHand: 3, reserved: 0 } } } ] } },
    include: { variants: true } });
  variantB = productB.variants[0]!.id;
  const createdAt = new Date('2026-10-31T03:30:00.000Z');
  // Order A carries the exact 500-character note: the lookup view must keep it verbatim.
  await db.order.create({ data: {
    code: CODE_A, status: 'CONFIRMED', source: 'WEB', userId: null, recipientName: 'Nguyễn Thử Đơn A',
    phone: PHONE_A, email: 'lookup-a@example.test', province: 'TP. Hồ Chí Minh', district: '',
    ward: 'Phường Bến Nghé', addressLine: '12 Nguyễn Huệ', note: NOTE_500, method: 'COD', currency: 'VND',
    subtotalVnd: 400000, shippingFeeVnd: 30000, totalVnd: 430000, settingsVersion: 0,
    lookupTokenHash: lookupTokenHash(TOKEN_A), version: 1, createdAt,
    items: { create: [{ variantId: variantA, productName: 'Áo tra cứu', sku: productA.variants[0]!.sku, size: 'M', color: 'Đen',
      unitPriceVnd: 400000, quantity: 1, lineTotalVnd: 400000 }] },
    history: { create: [
      { fromStatus: null, toStatus: 'PENDING', actorType: 'GUEST', actorId: null, version: 0, createdAt },
      { fromStatus: 'PENDING', toStatus: 'CONFIRMED', actorType: 'ADMIN', actorId: null, version: 1,
        createdAt: new Date(createdAt.getTime() + 60000), reason: 'Xác nhận qua điện thoại' } ] },
  } });
  await db.order.create({ data: {
    code: CODE_B, status: 'PENDING', source: 'WEB', userId: null, recipientName: 'Trần Thử Đơn B',
    phone: PHONE_B, email: null, province: 'Hà Nội', district: '', ward: 'Phường Điện Biên',
    addressLine: '5 Đội Cấn', note: null, method: 'COD', currency: 'VND',
    subtotalVnd: 250000, shippingFeeVnd: 30000, totalVnd: 280000, settingsVersion: 0,
    lookupTokenHash: lookupTokenHash(TOKEN_B), version: 0,
    items: { create: [{ variantId: variantB, productName: 'Quần tra cứu', sku: productB.variants[0]!.sku, size: 'L', color: 'Xanh',
      unitPriceVnd: 250000, quantity: 1, lineTotalVnd: 250000 }] },
    history: { create: [{ fromStatus: null, toStatus: 'PENDING', actorType: 'GUEST', actorId: null, version: 0 }] },
  } });
  // Order C shares order A's phone: a lookup answer must never leak the sibling order.
  await db.order.create({ data: {
    code: CODE_C, status: 'PENDING', source: 'WEB', userId: null, recipientName: 'Lê Thử Đơn C',
    phone: PHONE_A, email: null, province: 'Đà Nẵng', district: '', ward: 'Phường Hải Châu',
    addressLine: '9 Bạch Đằng', note: null, method: 'COD', currency: 'VND',
    subtotalVnd: 250000, shippingFeeVnd: 30000, totalVnd: 280000, settingsVersion: 0,
    lookupTokenHash: lookupTokenHash(TOKEN_C), version: 0,
    items: { create: [{ variantId: variantB, productName: 'Quần tra cứu', sku: 'LKB-C', size: 'L', color: 'Xanh',
      unitPriceVnd: 250000, quantity: 1, lineTotalVnd: 250000 }] },
    history: { create: [{ fromStatus: null, toStatus: 'PENDING', actorType: 'GUEST', actorId: null, version: 0 }] },
  } });
});

afterAll(async () => {
  try { if (app) await app.close(); } finally { await isolated?.cleanup(); }
});

describe('POST /orders/lookup (M4.4.2 guest order lookup)', () => {
  it('answers the phone-matched order with a fresh token, the allowlisted view and a rotated hash', async () => {
    const response = await lookup({ code: CODE_A, phone: PHONE_A });
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('no-store');
    const body = response.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['lookupToken', 'order', 'timeline']);
    const token = body.lookupToken;
    expect(typeof token).toBe('string');
    expect(TOKEN_PATTERN.test(token as string)).toBe(true);
    expect(token).not.toBe(TOKEN_A); // a genuinely new 192-bit token, not a re-release
    const order = body.order as Record<string, unknown>;
    expect(Object.keys(order).sort()).toEqual(['code', 'createdAt', 'currency', 'items', 'method', 'recipient',
      'shippingFee', 'status', 'subtotal', 'total']);
    expect(order).toMatchObject({ code: CODE_A, status: 'CONFIRMED', method: 'COD', currency: 'VND',
      subtotal: 400000, shippingFee: 30000, total: 430000 });
    expect((order.recipient as Record<string, unknown>).note).toBe(NOTE_500);
    expect(Array.isArray(body.timeline)).toBe(true);
    // The stored form is the SHA-256 of the new token only — never the plaintext token.
    expect(await storedHash(CODE_A)).toBe(lookupTokenHash(token as string));
    expect(await storedHash(CODE_A)).not.toContain(token as string);
    // The new token opens the order; the old link is dead from this moment.
    await access(CODE_A, ip(), token as string).expect(200);
    await access(CODE_A, ip(), TOKEN_A).expect(404);
  });

  it('accepts the +84 form of the same stored phone as one normalized number', async () => {
    const response = await lookup({ code: CODE_A, phone: '+84901230001' });
    expect(response.status).toBe(200);
    const token = (response.body as { lookupToken: string }).lookupToken;
    expect(TOKEN_PATTERN.test(token)).toBe(true);
    await access(CODE_A, ip(), token).expect(200);
  });

  it('answers wrong phone, unknown code and both-wrong with one identical safe 404 and keeps the hash', async () => {
    const hashBefore = await storedHash(CODE_B);
    const cases = [
      { code: CODE_B, phone: '0909999999' }, // real order, wrong phone
      { code: 'XXXXX2XXXXX9', phone: PHONE_B }, // unknown code, plausible phone
      { code: 'XXXXX2XXXXX9', phone: '0909999999' }, // both wrong
    ];
    const responses = await Promise.all(cases.map((body) => lookup(body)));
    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ code: 'NOT_FOUND', message: UNIFORM_404, fieldErrors: [] });
      expect(JSON.stringify(response.body)).not.toContain('Trần Thử');
      expect(JSON.stringify(response.body)).not.toContain(PHONE_B);
    }
    // A failed lookup is a read: no hash rotation, so the old link keeps working.
    expect(await storedHash(CODE_B)).toBe(hashBefore);
    await access(CODE_B, ip(), TOKEN_B).expect(200);
  });

  it('never lists or leaks the sibling order that shares the same phone', async () => {
    const forA = await lookup({ code: CODE_A, phone: PHONE_A });
    expect(forA.status).toBe(200);
    const textA = JSON.stringify(forA.body);
    expect(textA).toContain(CODE_A);
    expect(textA).not.toContain(CODE_C);
    expect(textA).not.toContain('Lê Thử Đơn C');
    const forC = await lookup({ code: CODE_C, phone: PHONE_A });
    expect(forC.status).toBe(200);
    const textC = JSON.stringify(forC.body);
    expect(textC).toContain(CODE_C);
    expect(textC).not.toContain(CODE_A);
    expect(textC).not.toContain('Nguyễn Thử Đơn A');
  });

  it('rejects missing or malformed input with 400 validation before touching the database', async () => {
    const cases = [
      {}, // both missing
      { code: CODE_A }, // phone missing
      { phone: PHONE_A }, // code missing
      { code: '', phone: PHONE_A }, // empty code
      { code: 'X'.repeat(25), phone: PHONE_A }, // longer than orders.code VARCHAR(24)
      { code: `AB\nCD2EF3GH45`, phone: PHONE_A }, // control character inside the code
      { code: CODE_A, phone: '12345' }, // not a Vietnamese mobile number
      { code: CODE_A, phone: '09012300010' }, // 11 digits, wrong shape
      { code: 42, phone: PHONE_A }, // wrong type
      { code: CODE_A, phone: null }, // wrong type
      { code: CODE_A, phone: PHONE_A, extra: 'x' }, // whitelist + forbidNonWhitelisted
    ];
    for (const response of await Promise.all(cases.map((body) => lookup(body)))) {
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR', message: 'Thông tin chưa hợp lệ.' });
      expect((response.body as { fieldErrors: unknown[] }).fieldErrors.length).toBeGreaterThan(0);
      expect(JSON.stringify(response.body)).not.toContain('Nguyễn Thử');
    }
  });

  it('requires the session CSRF pair like every other state-changing call', async () => {
    const noHeader = await guest.post('/api/v1/orders/lookup')
      .set('Origin', origin).set('X-Forwarded-For', ip()).send({ code: CODE_A, phone: PHONE_A });
    expect(noHeader.status).toBe(403);
    expect((noHeader.body as { code?: string }).code).toBe('CSRF_INVALID');
    const foreignOrigin = await guest.post('/api/v1/orders/lookup')
      .set('X-CSRF-Token', await csrfFor(guest)).set('Origin', 'https://evil.example')
      .set('X-Forwarded-For', ip()).send({ code: CODE_A, phone: PHONE_A });
    expect(foreignOrigin.status).toBe(403);
    expect((foreignOrigin.body as { code?: string }).code).toBe('CSRF_INVALID');
  });

  it('limits the endpoint to 5 lookups per minute per IP with a clear 429', async () => {
    const fixedIp = ip();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await lookup({ code: CODE_B, phone: PHONE_B }, fixedIp)).status).toBe(200);
    }
    const blocked = await lookup({ code: CODE_B, phone: PHONE_B }, fixedIp);
    expect(blocked.status).toBe(429);
    expect((blocked.body as { code?: string }).code).toBe('RATE_LIMITED');
  });

  it('mutates nothing but lookupTokenHash: stock, money, status, history and idempotency stay untouched', async () => {
    const snapshot = async () => ({
      order: await db.order.findUniqueOrThrow({ where: { code: CODE_A } }),
      history: await db.orderStatusHistory.findMany({ where: { order: { code: CODE_A } }, orderBy: { version: 'asc' } }),
      inventory: await db.inventory.findUniqueOrThrow({ where: { variantId: variantA } }),
      movements: await db.inventoryMovement.count(),
      idempotency: await db.idempotencyRecord.count(),
    });
    const before = await snapshot();
    expect((await lookup({ code: CODE_A, phone: PHONE_A })).status).toBe(200);
    const after = await snapshot();
    // Only the technical hash (and updatedAt) may move; every business field is identical.
    expect({ ...after, order: { ...after.order, lookupTokenHash: before.order.lookupTokenHash,
      updatedAt: before.order.updatedAt } }).toEqual(before);
  });

  it('keeps exactly one valid token when two lookups race on the same order', async () => {
    const [first, second] = await lookupInParallel([
      { code: CODE_C, phone: PHONE_A }, { code: CODE_C, phone: PHONE_A }]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const token1 = (first.body as { lookupToken: string }).lookupToken;
    const token2 = (second.body as { lookupToken: string }).lookupToken;
    expect(token1).not.toBe(token2);
    // Only the last hash replacement survives: exactly one of the two answers stays openable.
    const [view1, view2] = await Promise.all([
      access(CODE_C, ip(), token1), access(CODE_C, ip(), token2)]);
    const validCount = (view1.status === 200 ? 1 : 0) + (view2.status === 200 ? 1 : 0);
    expect(validCount).toBe(1);
    const finalHash = await storedHash(CODE_C);
    expect(finalHash).toBe(view1.status === 200 ? lookupTokenHash(token1) : lookupTokenHash(token2));
  });

  it('never stores the plaintext token anywhere in the database', async () => {
    // A successful lookup rotates to a fresh random token; the row may only carry its SHA-256.
    const response = await lookup({ code: CODE_B, phone: PHONE_B });
    expect(response.status).toBe(200);
    const fresh = (response.body as { lookupToken: string }).lookupToken;
    const row = await db.order.findUniqueOrThrow({ where: { code: CODE_B } });
    expect(JSON.stringify(row)).not.toContain(fresh);
    expect(row.lookupTokenHash).toBe(lookupTokenHash(fresh));
    expect(row.lookupTokenHash).not.toBe(fresh);
  });
});

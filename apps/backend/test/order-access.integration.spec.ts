import { createIsolatedTestDatabase } from '../../../tools/test-database.mjs';
import { randomInt, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import supertest, { type Agent } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../dist/application.js';
import { readEnvironment } from '../dist/config/environment.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';
import { lookupTokenHash } from '../dist/modules/orders/order-command.js';

// M4.4.1 guest order access: GET /orders/:code verifies the fragment token against the stored
// SHA-256, answers the allowlisted customer view on real PostgreSQL, and never mutates data.

const origin = 'http://localhost:5173';
const UNIFORM_404 = 'Không tìm thấy đơn hàng. Kiểm tra lại mã đơn hoặc đường dẫn đã nhận từ shop.';
// Order codes use the same unambiguous alphabet as generateOrderCode (no O/I/L/0/1).
const CODE_A = 'ABCDUVWXYZ2';
const CODE_B = 'MNPQRSTUV34';
const TOKEN_A = 'A'.repeat(32);
const TOKEN_B = 'B'.repeat(32);
const NOTE_500 = 'Ghi chú dài hợp lệ: '.padEnd(499, 'x') + '.'; // exact orders.note VARCHAR(500) limit

let app: Awaited<ReturnType<typeof createApplication>>;
let db: PrismaService;
let isolated: Awaited<ReturnType<typeof createIsolatedTestDatabase>> | undefined;
let server: Server;
let guest: Agent;

let categoryId = '';
let productAId = '';
let variantA = '';
let variantB = '';

// Distinct client IPs per request keep the real 30/min/IP limiter from bleeding between scenarios;
// the limiter itself is verified with a fixed IP in its own test.
const ip = () => `10.${randomInt(1, 250)}.${randomInt(1, 250)}.${randomInt(1, 250)}`;

function access(code: string, ipXff: string, token?: string): supertest.Test {
  const request = guest.get(`/api/v1/orders/${code}`).set('X-Forwarded-For', ipXff);
  return token === undefined ? request : request.set('X-Order-Token', token);
}

const createdAt = new Date('2026-10-31T03:30:00.000Z');

beforeAll(async () => {
  isolated = await createIsolatedTestDatabase(process.env.DATABASE_URL!, 'orderaccess');
  process.env.DATABASE_URL = isolated.databaseUrl;
  // TRUST_PROXY=1 lets each request present its own client IP through X-Forwarded-For, mirroring
  // the production proxy path and isolating the per-IP rate limit between scenarios.
  app = await createApplication(readEnvironment({ ...process.env, APP_ORIGIN: origin, TRUST_PROXY: '1' }));
  await app.listen(0, '127.0.0.1');
  db = app.get(PrismaService); server = app.getHttpServer() as Server;
  guest = supertest.agent(server);
  await db.shopSettings.create({ data: { id: 'default', shippingFeeVnd: 30000, bankDeadlineMinutes: 120 } });
  const category = await db.category.create({ data: { name: 'Danh mục xem đơn thử', slug: `access-${randomUUID()}`, active: true } });
  categoryId = category.id;
  const productA = await db.product.create({ data: { name: 'Áo xem chi tiết', slug: `access-a-${randomUUID()}`, description: '', categoryId,
    status: 'PUBLISHED', priceFrom: 400000, variants: { create: [
      { sku: `ACC-${randomUUID()}`.toUpperCase().slice(0, 64), size: 'M', color: 'Đen', price: 400000, active: true,
        inventory: { create: { onHand: 5, reserved: 1 } } } ] } },
    include: { variants: true } });
  productAId = productA.id;
  variantA = productA.variants[0]!.id;
  const productB = await db.product.create({ data: { name: 'Quần xem chi tiết', slug: `access-b-${randomUUID()}`, description: '', categoryId,
    status: 'PUBLISHED', priceFrom: 250000, variants: { create: [
      { sku: `ACB-${randomUUID()}`.toUpperCase().slice(0, 64), size: 'L', color: 'Xanh', price: 250000, active: true,
        inventory: { create: { onHand: 3, reserved: 0 } } } ] } },
    include: { variants: true } });
  variantB = productB.variants[0]!.id;
  // Order A is CONFIRMED with two history rows: the timeline comes from real history in stable order.
  await db.order.create({ data: {
    code: CODE_A, status: 'CONFIRMED', source: 'WEB', userId: null, recipientName: 'Nguyễn Thử Đơn A',
    phone: '0901230001', email: 'viewer-a@example.test', province: 'TP. Hồ Chí Minh', district: '',
    ward: 'Phường Bến Nghé', addressLine: '12 Nguyễn Huệ', note: 'Giao giờ hành chính', method: 'COD', currency: 'VND',
    subtotalVnd: 400000, shippingFeeVnd: 30000, totalVnd: 430000, settingsVersion: 0,
    lookupTokenHash: lookupTokenHash(TOKEN_A), version: 1, createdAt,
    items: { create: [{ variantId: variantA, productName: 'Áo xem chi tiết', sku: productA.variants[0]!.sku, size: 'M', color: 'Đen',
      unitPriceVnd: 400000, quantity: 1, lineTotalVnd: 400000 }] },
    history: { create: [
      { fromStatus: null, toStatus: 'PENDING', actorType: 'GUEST', actorId: null, version: 0, createdAt },
      { fromStatus: 'PENDING', toStatus: 'CONFIRMED', actorType: 'ADMIN', actorId: null, version: 1,
        createdAt: new Date(createdAt.getTime() + 60000), reason: 'Xác nhận qua điện thoại' } ] },
  } });
  await db.order.create({ data: {
    code: CODE_B, status: 'PENDING', source: 'WEB', userId: null, recipientName: 'Trần Thử Đơn B',
    phone: '0905990002', email: null, province: 'Hà Nội', district: '', ward: 'Phường Điện Biên',
    addressLine: '5 Đội Cấn', note: NOTE_500, method: 'COD', currency: 'VND',
    subtotalVnd: 250000, shippingFeeVnd: 30000, totalVnd: 280000, settingsVersion: 0,
    lookupTokenHash: lookupTokenHash(TOKEN_B), version: 0,
    items: { create: [{ variantId: variantB, productName: 'Quần xem chi tiết', sku: productB.variants[0]!.sku, size: 'L', color: 'Xanh',
      unitPriceVnd: 250000, quantity: 1, lineTotalVnd: 250000 }] },
    history: { create: [{ fromStatus: null, toStatus: 'PENDING', actorType: 'GUEST', actorId: null, version: 0 }] },
  } });
});

afterAll(async () => {
  try { if (app) await app.close(); } finally { await isolated?.cleanup(); }
});

describe('GET /orders/:code (M4.4.1 guest order access)', () => {
  it('answers the right token with the exact allowlisted snapshot, timeline and no-store', async () => {
    const response = await access(CODE_A, ip(), TOKEN_A).expect(200);
    expect(response.headers['cache-control']).toContain('no-store');
    const body = response.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['order', 'timeline']);
    const order = body.order as Record<string, unknown>;
    expect(Object.keys(order).sort()).toEqual(['code', 'createdAt', 'currency', 'items', 'method', 'recipient',
      'shippingFee', 'status', 'subtotal', 'total']);
    expect(order).toMatchObject({ code: CODE_A, status: 'CONFIRMED', method: 'COD', currency: 'VND',
      createdAt: createdAt.toISOString(), subtotal: 400000, shippingFee: 30000, total: 430000 });
    const recipient = order.recipient as Record<string, unknown>;
    expect(Object.keys(recipient).sort()).toEqual(['addressLine', 'district', 'email', 'name', 'note', 'phone', 'province', 'ward']);
    expect(recipient).toMatchObject({ name: 'Nguyễn Thử Đơn A', phone: '0901230001', email: 'viewer-a@example.test',
      province: 'TP. Hồ Chí Minh', district: '', ward: 'Phường Bến Nghé', addressLine: '12 Nguyễn Huệ',
      note: 'Giao giờ hành chính' });
    expect(Array.isArray(order.items)).toBe(true);
    expect(Object.keys((order.items as Array<Record<string, unknown>>)[0]!).sort())
      .toEqual(['color', 'lineTotalVnd', 'productName', 'quantity', 'size', 'sku', 'unitPriceVnd', 'variantId']);
    expect(order.items).toMatchObject([{ variantId: variantA, productName: 'Áo xem chi tiết', size: 'M', color: 'Đen',
      unitPriceVnd: 400000, quantity: 1, lineTotalVnd: 400000 }]);
    const timeline = body.timeline as Array<Record<string, unknown>>;
    expect(timeline).toHaveLength(2);
    expect(Object.keys(timeline[0]!).sort()).toEqual(['actorLabel', 'at', 'fromStatus', 'reason', 'toStatus', 'version']);
    expect(timeline).toMatchObject([
      { fromStatus: null, toStatus: 'PENDING', actorLabel: 'Khách đặt hàng', reason: null, version: 0 },
      { fromStatus: 'PENDING', toStatus: 'CONFIRMED', actorLabel: 'Cửa hàng', reason: 'Xác nhận qua điện thoại', version: 1 },
    ]);
    // The stored hash and internal identifiers never leave the server.
    const text = JSON.stringify(body);
    expect(text).not.toContain(TOKEN_A);
    expect(text).not.toContain(lookupTokenHash(TOKEN_A));
    expect(text).not.toContain('settingsVersion');
    expect(text).not.toContain('quoteId');
  });

  it('reads without writing any order, inventory, ledger or idempotency state', async () => {
    const snapshot = async () => ({
      order: await db.order.findUniqueOrThrow({ where: { code: CODE_A } }),
      history: await db.orderStatusHistory.findMany({ where: { order: { code: CODE_A } }, orderBy: { version: 'asc' } }),
      inventory: await db.inventory.findUniqueOrThrow({ where: { variantId: variantA } }),
      movements: await db.inventoryMovement.count(),
      idempotency: await db.idempotencyRecord.count(),
    });
    const before = await snapshot();
    await access(CODE_A, ip(), TOKEN_A).expect(200);
    await access(CODE_A, ip(), TOKEN_A).expect(200);
    const after = await snapshot();
    expect(after).toEqual(before);
  });

  it('answers the same 404 and no PII for missing header, malformed, foreign or unknown tokens', async () => {
    const cases: Array<Promise<supertest.Response>> = [
      access(CODE_A, ip()), // no header at all
      access(CODE_A, ip(), 'short'), // wrong token shape
      access(CODE_A, ip(), TOKEN_B), // a token that belongs to order B (foreign)
      access(CODE_B, ip(), TOKEN_A), // a token that belongs to order A against order B's code
      access('XXXXX2XXXXX9', ip(), TOKEN_A), // an unknown order code with a plausible token
    ];
    for (const response of await Promise.all(cases)) {
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ code: 'NOT_FOUND', message: UNIFORM_404, fieldErrors: [] });
      expect(JSON.stringify(response.body)).not.toContain('Nguyễn');
      expect(JSON.stringify(response.body)).not.toContain('0901230001');
    }
  });

  it('rejects impossible codes with the uniform 404 before any malformed text reaches PostgreSQL', async () => {
    const malformedCodes = [
      encodeURIComponent('\0'), // NUL byte — PostgreSQL refuses NUL inside text values
      'X'.repeat(25), // longer than orders.code VARCHAR(24)
      encodeURIComponent('AA\nB2CD3EF4GH'), // control character inside an otherwise plausible code
    ];
    for (const response of await Promise.all(malformedCodes.map((code) => access(code, ip(), TOKEN_A)))) {
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ code: 'NOT_FOUND', message: UNIFORM_404, fieldErrors: [] });
      expect(JSON.stringify(response.body)).not.toContain('Nguyễn');
      expect(JSON.stringify(response.body)).not.toContain('0901230001');
    }
  });

  it('carries a full 500-character note through the allowlist view unchanged', async () => {
    const response = await access(CODE_B, ip(), TOKEN_B).expect(200);
    const recipient = (response.body as { order: { recipient: Record<string, unknown> } }).order.recipient;
    expect(recipient.note).toBe(NOTE_500);
  });

  it('keeps the order snapshot when the product name, price and shipping fee change afterwards', async () => {
    await db.product.update({ where: { id: productAId }, data: { name: 'Áo đã đổi tên sau khi tạo đơn' } });
    await db.variant.update({ where: { id: variantA }, data: { price: 500 } });
    await db.shopSettings.update({ where: { id: 'default' }, data: { shippingFeeVnd: 99000, version: 1 } });
    const response = await access(CODE_A, ip(), TOKEN_A).expect(200);
    expect((response.body as { order: Record<string, unknown> }).order).toMatchObject({
      subtotal: 400000, shippingFee: 30000, total: 430000,
    });
    expect((response.body as { order: { items: Array<Record<string, unknown>> } }).order.items)
      .toMatchObject([{ productName: 'Áo xem chi tiết', unitPriceVnd: 400000 }]);
  });

  it('limits the endpoint to 30 requests per minute per IP with a clear 429', async () => {
    const fixedIp = ip();
    for (let attempt = 0; attempt < 30; attempt += 1) await access(CODE_B, fixedIp, TOKEN_B).expect(200);
    const blocked = await access(CODE_B, fixedIp, TOKEN_B);
    expect(blocked.status).toBe(429);
    expect((blocked.body as { code?: string }).code).toBe('RATE_LIMITED');
  });
});

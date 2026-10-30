import { createIsolatedTestDatabase } from '../../../tools/test-database.mjs';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { hash } from 'argon2';
import supertest, { type Agent } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../dist/application.js';
import { readEnvironment } from '../dist/config/environment.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';

// Settings mutations run in a fresh migrated database owned by this suite.
// The caller database and any pre-existing singleton remain untouched.

const origin = 'http://localhost:5173';
const adminEmail = `settings-${randomUUID()}@example.test`;
const customerEmail = `settings-${randomUUID()}@example.test`;
const password = 'settings-integration-password-123!';
let app: Awaited<ReturnType<typeof createApplication>>;
let db: PrismaService;
let isolated: Awaited<ReturnType<typeof createIsolatedTestDatabase>> | undefined;
let server: Server;
let admin: Agent;
let customer: Agent;
let adminUserId = '';
let saved: { shippingFeeVnd: number; bankDeadlineMinutes: number; bankName: string | null; bankBin: string | null;
  bankAccountNumber: string | null; bankAccountName: string | null; version: number };
let baselineUpdatedAt = '';

const tag = () => randomUUID().replaceAll('-', '').toUpperCase().slice(0, 24);
const key = `save-key-${tag()}`;

const bankComplete = (overrides: Record<string, unknown> = {}) =>
  ({ bankName: 'Ngân hàng thử', bankBin: '970422', bankAccountNumber: '0123456789', bankAccountName: 'CONG TY THU', ...overrides });

const patchBody = (overrides: Record<string, unknown> = {}) =>
  ({ shippingFeeVnd: 50000, bankDeadlineMinutes: 90, ...bankComplete(), expectedVersion: saved.version, ...overrides });

async function refreshBaseline() {
  const row = await db.shopSettings.findUniqueOrThrow({ where: { id: 'default' } });
  saved = { shippingFeeVnd: row.shippingFeeVnd, bankDeadlineMinutes: row.bankDeadlineMinutes, bankName: row.bankName,
    bankBin: row.bankBin, bankAccountNumber: row.bankAccountNumber, bankAccountName: row.bankAccountName, version: row.version };
  baselineUpdatedAt = row.updatedAt.toISOString();
}

/** Every command passes the CSRF mechanism: a fresh token is taken before each request. */
async function patch(agent: Agent, body: unknown, idempotencyKey: string | undefined, options: { withoutCsrf?: boolean } = {}): Promise<supertest.Response> {
  const request = agent.patch('/api/v1/admin/settings');
  if (!options.withoutCsrf) {
    const csrf = ((await agent.get('/api/v1/auth/csrf').expect(200)).body as { csrfToken: string }).csrfToken;
    request.set('X-CSRF-Token', csrf);
  }
  request.set('Origin', origin).send(body);
  if (idempotencyKey !== undefined) request.set('Idempotency-Key', idempotencyKey);
  return await request;
}

beforeAll(async () => {
  if (process.env['NODE_ENV'] !== 'test' || !new URL(process.env['DATABASE_URL'] ?? '').pathname.endsWith('_test')) throw new Error('Test DB required');
  isolated = await createIsolatedTestDatabase(process.env['DATABASE_URL'], 'settings');
  app = await createApplication(readEnvironment({ ...process.env, DATABASE_URL: isolated.databaseUrl, APP_ORIGIN: origin }));
  await app.listen(0, '127.0.0.1');
  db = app.get(PrismaService); server = app.getHttpServer() as Server;
  const passwordHash = await hash(password);
  adminUserId = (await db.user.create({ data: { email: adminEmail, name: 'Admin cài đặt thử', role: 'ADMIN', passwordHash, emailVerifiedAt: new Date() } })).id;
  await db.user.create({ data: { email: customerEmail, name: 'Khách cài đặt thử', role: 'CUSTOMER', passwordHash, emailVerifiedAt: new Date() } });
  admin = supertest.agent(server);
  customer = supertest.agent(server);
  const login = async (agent: Agent, email: string) => {
    const token = (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
    await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', token).send({ email, password }).expect(200);
  };
  await login(admin, adminEmail);
  await login(customer, customerEmail);
  await db.shopSettings.create({ data: { id: 'default', shippingFeeVnd: 45000, bankDeadlineMinutes: 150, ...bankComplete() } });
  await refreshBaseline();
});

afterAll(async () => {
  try { if (app) await app.close(); } finally { await isolated?.cleanup(); }
});

describe('M4.1.1 settings endpoints', () => {
  it('lets ADMIN read the saved settings without mutating the row', async () => {
    const response = await admin.get('/api/v1/admin/settings').expect(200);
    expect(response.body).toEqual(saved);
    const reread = await db.shopSettings.findUniqueOrThrow({ where: { id: 'default' } });
    expect(reread).toMatchObject({ ...saved, id: 'default' });
  });

  it('rejects anonymous access with 401 and CUSTOMER with 403', async () => {
    await supertest(server).get('/api/v1/admin/settings').expect(401);
    await customer.get('/api/v1/admin/settings').expect(403);
  });

  it('serves the public view without login and allowlists exactly two fields', async () => {
    const response = await supertest(server).get('/api/v1/shop-settings/public').expect(200);
    expect(response.body).toEqual({ shippingFeeVnd: saved.shippingFeeVnd, bankDeadlineMinutes: saved.bankDeadlineMinutes });
    expect(Object.keys(response.body).sort()).toEqual(['bankDeadlineMinutes', 'shippingFeeVnd']);
  });

  it('repeated reads keep the stored version and values unchanged', async () => {
    await admin.get('/api/v1/admin/settings').expect(200);
    await supertest(server).get('/api/v1/shop-settings/public').expect(200);
    const row = await db.shopSettings.findUniqueOrThrow({ where: { id: 'default' } });
    expect(row.version).toBe(saved.version);
    expect(row.updatedAt.toISOString()).toBe(baselineUpdatedAt);
  });
});

const invalidCases = [
  { why: 'phí âm', body: () => patchBody({ shippingFeeVnd: -1 }), field: 'shippingFeeVnd' },
  { why: 'phí vượt mức cho phép', body: () => patchBody({ shippingFeeVnd: 100000001 }), field: 'shippingFeeVnd' },
  { why: 'phí là chuỗi', body: () => patchBody({ shippingFeeVnd: '50000' }), field: 'shippingFeeVnd' },
  { why: 'hạn dưới 15 phút', body: () => patchBody({ bankDeadlineMinutes: 14 }), field: 'bankDeadlineMinutes' },
  { why: 'hạn trên 2880 phút', body: () => patchBody({ bankDeadlineMinutes: 2881 }), field: 'bankDeadlineMinutes' },
  { why: 'expectedVersion âm', body: () => patchBody({ expectedVersion: -1 }), field: 'expectedVersion' },
  { why: 'BIN sai độ dài', body: () => patchBody({ ...bankComplete({ bankBin: '97042' }) }), field: 'bankBin' },
  { why: 'BIN không phải chữ số', body: () => patchBody({ ...bankComplete({ bankBin: '97042A' }) }), field: 'bankBin' },
  { why: 'số tài khoản có ký tự lạ', body: () => patchBody({ ...bankComplete({ bankAccountNumber: '0123456789A' }) }), field: 'bankAccountNumber' },
  { why: 'số tài khoản quá dài', body: () => patchBody({ ...bankComplete({ bankAccountNumber: '1'.repeat(33) }) }), field: 'bankAccountNumber' },
  { why: 'tên ngân hàng quá dài', body: () => patchBody({ ...bankComplete({ bankName: 'N'.repeat(121) }) }), field: 'bankName' },
  { why: 'nhóm ngân hàng thiếu trường (thiếu tên chủ)', body: () => patchBody({ ...bankComplete({ bankAccountName: undefined }) }), field: 'bankAccountName' },
  { why: 'nhóm ngân hàng chỉ tên và BIN', body: () => ({ ...patchBody(), bankAccountNumber: '', bankAccountName: '' }), field: 'bankAccountNumber' },
  { why: 'trường lạ', body: () => patchBody({ hullu: true }), field: 'hullu' },
] as const;

describe('M4.1.2 settings saving', () => {
  it('blocks invalid bodies with field errors and keeps version and updatedAt untouched', async () => {
    for (const invalid of invalidCases) {
      const response = await patch(admin, invalid.body(), `bad-${tag()}`);
      const content = response.body as { code: string; message: string; fieldErrors: Array<{ field: string }> };
      expect(response.status, `${invalid.why} nhận thêm HTTP status`).toBe(400);
      expect(content.code, invalid.why).toBe('VALIDATION_ERROR');
      expect(content.fieldErrors.some((entry) => entry.field === invalid.field), `${invalid.why} → ${JSON.stringify(content.fieldErrors)}`).toBe(true);
    }
    const row = await db.shopSettings.findUniqueOrThrow({ where: { id: 'default' } });
    expect(row.version).toBe(saved.version);
    expect(row.updatedAt.toISOString()).toBe(baselineUpdatedAt);
  });

  it('rejects PATCH without an Idempotency-Key', async () => {
    const response = await patch(admin, patchBody(), undefined);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('stores a valid save with trimming, nulls and a leading-zero account number; bumps the version once', async () => {
    const key = `valid-${tag()}`;

    const version = saved.version;
    const body = { ...patchBody(), bankName: '  Ngân hàng thử  ', bankBin: '970422', bankAccountNumber: '0123456789', bankAccountName: '  CONG TY THU  ' };
    const response = await patch(admin, body, key);
    const view = response.body as typeof saved;
    expect(response.status).toBe(200);
    expect(view.version).toBe(version + 1);
    expect(view.bankName).toBe('Ngân hàng thử');
    expect(view.bankAccountNumber).toBe('0123456789'); // leading zeros survive
    expect(view.bankAccountName).toBe('CONG TY THU');
    saved = view;
    await refreshBaseline();
    const row = await db.shopSettings.findUniqueOrThrow({ where: { id: 'default' } });
    expect(row.version).toBe(version + 1);
  });

  it('replays the recorded command for the same key and content without a second version bump', async () => {
    const key = `replay-${tag()}`;

    const body = patchBody();
    const first = await patch(admin, body, key);
    expect(first.status).toBe(200);
    expect(first.body.version).toBe(saved.version + 1);
    await refreshBaseline();
    const replay = await patch(admin, body, key);
    expect(replay.status).toBe(200);
    expect(replay.body.version).toBe(saved.version);
    expect(replay.body).toEqual(first.body);
    const row = await db.shopSettings.findUniqueOrThrow({ where: { id: 'default' } });
    expect(row.version).toBe(saved.version);
    expect(await db.idempotencyRecord.count({ where: { scope: 'settings.update', identity: `admin:${adminUserId}`, key } })).toBe(1);
  });

  it('answers the same key with different content as 409 without touching the version', async () => {
    const key = `other-${tag()}`;

    const savedOnce = await patch(admin, patchBody(), key);
    expect(savedOnce.status).toBe(200);
    await refreshBaseline();
    const other = await patch(admin, { ...patchBody(), shippingFeeVnd: 51000 }, key);
    expect(other.status).toBe(409);
    expect(other.body).toMatchObject({ code: 'CONFLICT', message: 'Mã thao tác đã dùng với nội dung khác.' });
    const row = await db.shopSettings.findUniqueOrThrow({ where: { id: 'default' } });
    expect(row.version).toBe(saved.version);
  });

  it('lets only one of two concurrent authors with different keys save (no upsert overwrites)', async () => {
    const keyA = `race-a-${tag()}`;
    const keyB = `race-b-${tag()}`;

    const version = saved.version;
    const [outcomeA, outcomeB] = await Promise.all([
      patch(admin, { ...patchBody({ shippingFeeVnd: 52000 }), expectedVersion: version }, keyA),
      patch(admin, { ...patchBody({ shippingFeeVnd: 53000 }), expectedVersion: version }, keyB),
    ]);
    expect([outcomeA.status, outcomeB.status].sort((left, right) => left - right)).toEqual([200, 409]);
    const loser = outcomeA.status === 200 ? outcomeB : outcomeA;
    const winner = outcomeA.status === 200 ? outcomeA : outcomeB;
    expect(loser.body).toMatchObject({ code: 'CONFLICT' });
    expect([52000, 53000]).toContain(winner.body.shippingFeeVnd);
    expect(winner.body.version).toBe(version + 1);
    await refreshBaseline();
    const row = await db.shopSettings.findUniqueOrThrow({ where: { id: 'default' } });
    expect(row.version).toBe(version + 1);
    expect(await db.shopSettings.count({ where: { id: 'default' } })).toBe(1);
  });

  it('replays the same committed response to two concurrent first-saves sharing one key', async () => {
    await db.shopSettings.deleteMany({ where: { id: 'default' } });
    const key = `first-${tag()}`;

    const body = { ...patchBody(), expectedVersion: 0 };
    const [outcomeOne, outcomeTwo] = await Promise.all([patch(admin, body, key), patch(admin, body, key)]);
    expect(outcomeOne.status).toBe(200);
    expect(outcomeTwo.status).toBe(200);
    expect(outcomeTwo.body).toEqual(outcomeOne.body);
    const created = await db.shopSettings.findUniqueOrThrow({ where: { id: 'default' } });
    expect(created.version).toBe(1);
    expect(await db.idempotencyRecord.count({ where: { scope: 'settings.update', identity: `admin:${adminUserId}`, key } })).toBe(1);
    await refreshBaseline();
  });

  it('lets two concurrent first-saves with different keys produce one win and one clean conflict', async () => {
    await db.shopSettings.deleteMany({ where: { id: 'default' } });
    const keyA = `first-a-${tag()}`;
    const keyB = `first-b-${tag()}`;

    const [outcomeOne, outcomeTwo] = await Promise.all([
      patch(admin, { ...patchBody(), expectedVersion: 0 }, keyA),
      patch(admin, { ...patchBody(), expectedVersion: 0 }, keyB),
    ]);
    expect([outcomeOne.status, outcomeTwo.status].sort((left, right) => left - right)).toEqual([200, 409]);
    const built = await db.shopSettings.findUniqueOrThrow({ where: { id: 'default' } });
    expect(built.version).toBe(1);
    expect(Number(built.shippingFeeVnd)).toBe(50000); // exactly one of the two bodies was stored
    expect(await db.idempotencyRecord.count({ where: { scope: 'settings.update', identity: `admin:${adminUserId}`, key: { in: [keyA, keyB] } } })).toBe(1);
    expect(await db.shopSettings.count({ where: { id: 'default' } })).toBe(1);
    await refreshBaseline();
  });

  it('keeps earlier quote and order snapshots untouched after a PATCH', async () => {
    const quote = await db.checkoutQuote.create({ data: {
      items: [{ variantId: randomUUID(), quantity: 2, unitPriceVnd: 700000, lineTotalVnd: 1400000 }],
      method: 'COD', subtotalVnd: 1400000, shippingFeeVnd: 42000, totalVnd: 1442000, settingsVersion: saved.version,
      expiresAt: new Date(Date.now() + 1800000) } });
    const order = await db.order.create({ data: {
      code: `HD${tag()}`.slice(0, 24), recipientName: 'Khách thử', phone: '0908765432', province: 'Hà Nội', district: 'Cầu Giấy',
      ward: 'Dịch Vọng', addressLine: 'Số 12 đường thử nghiệm', method: 'COD',
      subtotalVnd: 1400000, shippingFeeVnd: 42000, totalVnd: 1442000, settingsVersion: saved.version } });
    try {
      const key = `snap-${tag()}`;

      const snapshotSave = await patch(admin, patchBody(), key);
      expect(snapshotSave.status).toBe(200);
      const quoteAfter = await db.checkoutQuote.findUniqueOrThrow({ where: { id: quote.id } });
      expect(Number(quoteAfter.shippingFeeVnd)).toBe(42000);
      expect(quoteAfter.settingsVersion).toBe(quote.settingsVersion);
      const orderAfter = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(Number(orderAfter.shippingFeeVnd)).toBe(42000);
      expect(orderAfter.settingsVersion).toBe(order.settingsVersion);
      expect(Number(orderAfter.totalVnd)).toBe(1442000);
    } finally {
      await db.order.deleteMany({ where: { id: order.id } });
      await db.checkoutQuote.deleteMany({ where: { id: quote.id } });
      await refreshBaseline();
    }
  });

  it('blocks command saving through auth and CSRF independently of the frontend', async () => {
    // Guests cannot even open a command: CSRF passes only with a session token, then SessionGuard rejects.
    const anonymous = supertest.agent(server);
    const csrf = ((await anonymous.get('/api/v1/auth/csrf').expect(200)).body as { csrfToken: string }).csrfToken;
    const guest = await anonymous.patch('/api/v1/admin/settings').set('Origin', origin)
      .set('X-CSRF-Token', csrf).set('Idempotency-Key', `guest-${tag()}`).send(patchBody());
    expect(guest.status).toBe(401);
    expect(guest.body).toMatchObject({ code: 'AUTH_REQUIRED' });
    // CSRF protection acts before the role check: a command without the header is 403 for ADMIN as well.
    const withoutCsrf = await patch(admin, patchBody(), `csrf-${tag()}`, { withoutCsrf: true });
    expect(withoutCsrf.status).toBe(403);
    expect(withoutCsrf.body).toMatchObject({ code: 'CSRF_INVALID' });
    const forbidden = await patch(customer, patchBody(), `cust-${tag()}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toMatchObject({ code: 'FORBIDDEN' });
  });
});

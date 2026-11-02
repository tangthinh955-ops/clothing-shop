import { createIsolatedTestDatabase } from '../../../tools/test-database.mjs';
import { Logger } from '@nestjs/common';
import { randomInt, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { hash } from 'argon2';
import supertest, { type Agent } from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApplication } from '../dist/application.js';
import { readEnvironment } from '../dist/config/environment.js';
import { MailService } from '../dist/modules/mail/mail.service.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';

// M4.10.1.1 shop notice: a new order records one delivery per active admin inside its transaction and
// sends after commit, so mail can never fail, slow down or duplicate the order itself.

const origin = 'http://localhost:5173';
const RECIPIENT = 'Nguyễn Khách Riêng';
const ADDRESS = '12 Nguyễn Huệ Riêng';
const CUSTOMER_EMAIL = 'khach-rieng@example.test';
const NOTE = 'Ghi chú riêng của khách';

let app: Awaited<ReturnType<typeof createApplication>>;
let db: PrismaService;
let mail: MailService;
let isolated: Awaited<ReturnType<typeof createIsolatedTestDatabase>> | undefined;
let server: Server;
let guest: Agent;
let categoryId = '';
let adminA = '';
let adminB = '';
let disabledAdmin = '';
let customerUser = '';

const testPhone = () => `09${randomInt(10000000, 99999999)}`;
const ip = () => `10.${randomInt(1, 250)}.${randomInt(1, 250)}.${randomInt(1, 250)}`;
const orderKey = () => `notice-${randomUUID()}`;

async function makeVariant(onHand: number) {
  const product = await db.product.create({ data: { name: 'Áo báo đơn', slug: `notice-${randomUUID()}`, description: '', categoryId,
    status: 'PUBLISHED', priceFrom: 200000, variants: { create: [
      { sku: `NTC-${randomUUID()}`.toUpperCase().slice(0, 64), size: 'M', color: 'đen', price: 200000, active: true,
        inventory: { create: { onHand, reserved: 0 } } }] } }, include: { variants: true } });
  return product.variants[0]!.id;
}

async function csrf() {
  return (await guest.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
}

/** A valid order command against a fresh quote; send it with place() as often as a test needs. */
async function prepareOrder(onHand = 5, quantity = 2) {
  const variantId = await makeVariant(onHand);
  const items = [{ variantId, quantity }];
  // The token comes first: the agent attaches its session cookie when the request is created.
  const token = await csrf();
  const quote = await guest.post('/api/v1/checkout/quote').set('X-CSRF-Token', token).set('Origin', origin)
    .send({ items, method: 'COD' }).expect(201);
  return { variantId, key: orderKey(), xff: ip(), body: { quoteId: quote.body.quoteId as string, items, method: 'COD', note: NOTE,
    contact: { name: RECIPIENT, phone: testPhone(), email: CUSTOMER_EMAIL },
    address: { province: 'TP. Hồ Chí Minh', district: '', ward: 'Phường Bến Nghé', addressLine: ADDRESS } } };
}

async function place(order: Awaited<ReturnType<typeof prepareOrder>>) {
  const token = await csrf();
  return guest.post('/api/v1/orders').set('X-CSRF-Token', token).set('Origin', origin)
    .set('X-Forwarded-For', order.xff).set('Idempotency-Key', order.key).send(order.body);
}

const orderIdOf = async (code: string) => (await db.order.findUniqueOrThrow({ where: { code }, select: { id: true } })).id;
const deliveriesOf = async (code: string) => db.notificationDelivery.findMany({ where: { orderId: await orderIdOf(code) }, orderBy: { recipient: 'asc' } });
const codeOf = (response: supertest.Response) => (response.body as { order: { code: string } }).order.code;

/** The background send has settled once no delivery of the order is waiting or in flight. */
async function settled(code: string) {
  await vi.waitFor(async () => {
    const rows = await deliveriesOf(code);
    expect(rows.every((row) => row.status === 'SENT' || row.status === 'FAILED')).toBe(true);
  }, { timeout: 5000 });
  return deliveriesOf(code);
}

beforeAll(async () => {
  isolated = await createIsolatedTestDatabase(process.env.DATABASE_URL!, 'notice');
  process.env.DATABASE_URL = isolated.databaseUrl;
  app = await createApplication(readEnvironment({ ...process.env, APP_ORIGIN: origin, TRUST_PROXY: '1' }));
  await app.listen(0, '127.0.0.1');
  db = app.get(PrismaService);
  mail = app.get(MailService);
  server = app.getHttpServer() as Server;
  guest = supertest.agent(server);
  await db.shopSettings.create({ data: { id: 'default', shippingFeeVnd: 30000, bankDeadlineMinutes: 120 } });
  categoryId = (await db.category.create({ data: { name: 'Danh mục báo đơn', slug: `notice-${randomUUID()}`, active: true } })).id;
  const prefix = randomUUID();
  const passwordHash = await hash('notice-only-password-123!');
  adminA = `${prefix}-a@example.test`;
  adminB = `${prefix}-b@example.test`;
  disabledAdmin = `${prefix}-disabled@example.test`;
  customerUser = `${prefix}-customer@example.test`;
  await db.user.createMany({ data: [
    { email: adminA, name: 'Admin A', role: 'ADMIN', passwordHash, emailVerifiedAt: new Date() },
    { email: adminB, name: 'Admin B', role: 'ADMIN', passwordHash, emailVerifiedAt: new Date() },
    { email: disabledAdmin, name: 'Admin khóa', role: 'ADMIN', passwordHash, emailVerifiedAt: new Date(), disabledAt: new Date() },
    { email: customerUser, name: 'Khách', role: 'CUSTOMER', passwordHash, emailVerifiedAt: new Date() },
  ] });
});

afterEach(() => vi.restoreAllMocks());

afterAll(async () => {
  try { if (app) await app.close(); } finally { await isolated?.cleanup(); }
});

describe('shop notice for a new order (M4.10.1.1)', () => {
  it('sends one notice to each active admin, and to nobody else', async () => {
    const send = vi.spyOn(mail, 'sendOrderNotice').mockResolvedValue(true);
    const response = await place(await prepareOrder());
    expect(response.status, JSON.stringify(response.body).slice(0, 300)).toBe(201);
    const rows = await settled(codeOf(response));
    expect(rows.map((row) => row.recipient).sort()).toEqual([adminA, adminB].sort());
    for (const row of rows) {
      expect(row).toMatchObject({ event: 'order.created.shop', status: 'SENT', attempts: 1 });
      expect(row.sentAt).toBeInstanceOf(Date);
    }
    expect(send.mock.calls.map(([to]) => to).sort()).toEqual([adminA, adminB].sort());
  });

  it('says what the shop needs and links to the order, with no customer data or token', async () => {
    const send = vi.spyOn(mail, 'sendOrderNotice').mockResolvedValue(true);
    const order = await prepareOrder();
    const response = await place(order);
    const code = codeOf(response);
    await settled(code);
    const [, subject, text] = send.mock.calls[0]!;
    expect(subject).toContain(code);
    expect(text).toContain(code);
    expect(text).toContain('Số sản phẩm: 2');
    expect(text).toMatch(/430\.000/);
    expect(text).toContain('COD');
    expect(text).toContain(`${origin}/admin/orders/${await orderIdOf(code)}`);
    const everything = `${subject}\n${text}`;
    for (const secret of [RECIPIENT, order.body.contact.phone, ADDRESS, CUSTOMER_EMAIL, NOTE, 'Bến Nghé',
      (response.body as { lookupToken: string }).lookupToken]) {
      expect(everything).not.toContain(secret);
    }
  });

  it.each([
    ['refuses the mail', () => Promise.resolve(false)],
    ['throws', () => Promise.reject(new Error('provider down'))],
  ])('keeps the order and records the failure when the provider %s', async (_label, outcome) => {
    vi.spyOn(mail, 'sendOrderNotice').mockImplementation(outcome);
    const order = await prepareOrder();
    const response = await place(order);
    expect(response.status).toBe(201);
    const rows = await settled(codeOf(response));
    for (const row of rows) expect(row).toMatchObject({ status: 'FAILED', attempts: 1, sentAt: null });
    expect(await db.order.findUniqueOrThrow({ where: { code: codeOf(response) } })).toMatchObject({ status: 'PENDING' });
    expect(await db.inventory.findUniqueOrThrow({ where: { variantId: order.variantId } })).toMatchObject({ onHand: 5, reserved: 2 });
  });

  it('does not make the customer wait for a mail that hangs', async () => {
    vi.spyOn(mail, 'sendOrderNotice').mockImplementation(() => new Promise<boolean>(() => undefined));
    const response = await place(await prepareOrder());
    expect(response.status).toBe(201);
    await vi.waitFor(async () => {
      expect((await deliveriesOf(codeOf(response))).some((row) => row.status === 'SENDING')).toBe(true);
    }, { timeout: 5000 });
  });

  it('does not send again when the same key is replayed', async () => {
    const send = vi.spyOn(mail, 'sendOrderNotice').mockResolvedValue(true);
    const order = await prepareOrder();
    const first = await place(order);
    expect(first.status).toBe(201);
    await settled(codeOf(first));
    const replay = await place(order);
    expect(replay.status).toBe(201);
    expect((replay.body as { replay?: boolean }).replay).toBe(true);
    expect(codeOf(replay)).toBe(codeOf(first));
    await new Promise((resolve) => { setTimeout(resolve, 200); });
    expect(send).toHaveBeenCalledTimes(2);
    expect(await deliveriesOf(codeOf(first))).toHaveLength(2);
  });

  it('sends once when the same key races', async () => {
    const send = vi.spyOn(mail, 'sendOrderNotice').mockResolvedValue(true);
    const order = await prepareOrder();
    const [left, right] = await Promise.all([place(order), place(order)]);
    expect([left.status, right.status]).toEqual([201, 201]);
    expect(codeOf(left)).toBe(codeOf(right));
    await settled(codeOf(left));
    await new Promise((resolve) => { setTimeout(resolve, 200); });
    expect(send).toHaveBeenCalledTimes(2);
    expect(await db.order.count({ where: { code: codeOf(left) } })).toBe(1);
  });

  it('sends nothing for an order that did not commit', async () => {
    const send = vi.spyOn(mail, 'sendOrderNotice').mockResolvedValue(true);
    const before = await db.notificationDelivery.count();
    const order = await prepareOrder(5, 2);
    await db.inventory.update({ where: { variantId: order.variantId }, data: { reserved: 5 } });
    expect((await place(order)).status).toBe(409);
    await new Promise((resolve) => { setTimeout(resolve, 200); });
    expect(send).not.toHaveBeenCalled();
    expect(await db.notificationDelivery.count()).toBe(before);
  });

  it('still takes the order when the shop has no active admin', async () => {
    const send = vi.spyOn(mail, 'sendOrderNotice').mockResolvedValue(true);
    const active = [adminA, adminB];
    await db.user.updateMany({ where: { email: { in: active } }, data: { disabledAt: new Date() } });
    try {
      const response = await place(await prepareOrder());
      expect(response.status).toBe(201);
      await new Promise((resolve) => { setTimeout(resolve, 200); });
      expect(await deliveriesOf(codeOf(response))).toHaveLength(0);
      expect(send).not.toHaveBeenCalled();
    } finally {
      await db.user.updateMany({ where: { email: { in: active } }, data: { disabledAt: null } });
    }
  });

  describe('when the customer cancels (M4.4.3)', () => {
    const REASON = 'Lý do riêng 0987654321 của khách';

    async function cancelPlaced(response: supertest.Response, version = 0, key = orderKey()) {
      const token = await csrf();
      return guest.post(`/api/v1/orders/${codeOf(response)}/cancel`).set('X-CSRF-Token', token).set('Origin', origin).set('X-Forwarded-For', ip())
        .set('X-Order-Token', (response.body as { lookupToken: string }).lookupToken).set('Idempotency-Key', key)
        .send({ expectedVersion: version, reason: REASON });
    }
    const cancelNotices = async (code: string) => db.notificationDelivery.findMany({
      where: { orderId: await orderIdOf(code), event: 'order.cancelled.shop' } });

    async function settledCancelNotices(code: string) {
      await vi.waitFor(async () => {
        const rows = await cancelNotices(code);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((row) => row.status === 'SENT' || row.status === 'FAILED')).toBe(true);
      }, { timeout: 5000 });
      return cancelNotices(code);
    }

    it('tells each active admin, without the reason or customer data', async () => {
      const send = vi.spyOn(mail, 'sendOrderNotice').mockResolvedValue(true);
      const placed = await place(await prepareOrder());
      const code = codeOf(placed);
      await settled(code);
      send.mockClear();
      expect((await cancelPlaced(placed)).status).toBe(200);
      const rows = await settledCancelNotices(code);
      expect(rows.map((row) => row.recipient).sort()).toEqual([adminA, adminB].sort());
      for (const row of rows) expect(row).toMatchObject({ status: 'SENT', attempts: 1 });
      expect(send.mock.calls.map(([to]) => to).sort()).toEqual([adminA, adminB].sort());
      const [, subject, text] = send.mock.calls[0]!;
      expect(subject).toContain(code);
      expect(text).toContain(code);
      expect(text).toContain(`${origin}/admin/orders/${await orderIdOf(code)}`);
      for (const secret of [REASON, '0987654321', RECIPIENT, ADDRESS, CUSTOMER_EMAIL, NOTE]) expect(`${subject}\n${text}`).not.toContain(secret);
    });

    it('does not send again when the same key is replayed', async () => {
      const send = vi.spyOn(mail, 'sendOrderNotice').mockResolvedValue(true);
      const placed = await place(await prepareOrder());
      await settled(codeOf(placed));
      send.mockClear();
      const key = orderKey();
      expect((await cancelPlaced(placed, 0, key)).status).toBe(200);
      await settledCancelNotices(codeOf(placed));
      expect((await cancelPlaced(placed, 0, key)).status).toBe(200);
      await new Promise((resolve) => { setTimeout(resolve, 200); });
      expect(send).toHaveBeenCalledTimes(2);
      expect(await cancelNotices(codeOf(placed))).toHaveLength(2);
    });

    it('keeps the cancellation when the mail fails', async () => {
      const send = vi.spyOn(mail, 'sendOrderNotice').mockResolvedValue(true);
      const order = await prepareOrder();
      const placed = await place(order);
      await settled(codeOf(placed));
      send.mockRejectedValue(new Error('provider down'));
      expect((await cancelPlaced(placed)).status).toBe(200);
      for (const row of await settledCancelNotices(codeOf(placed))) expect(row).toMatchObject({ status: 'FAILED', attempts: 1 });
      expect(await db.order.findUniqueOrThrow({ where: { code: codeOf(placed) } })).toMatchObject({ status: 'CANCELLED' });
      expect(await db.inventory.findUniqueOrThrow({ where: { variantId: order.variantId } })).toMatchObject({ onHand: 5, reserved: 0 });
    });

    it('sends nothing for a refused cancellation', async () => {
      const send = vi.spyOn(mail, 'sendOrderNotice').mockResolvedValue(true);
      const placed = await place(await prepareOrder());
      await settled(codeOf(placed));
      send.mockClear();
      expect((await cancelPlaced(placed, 7)).status).toBe(409);
      await new Promise((resolve) => { setTimeout(resolve, 200); });
      expect(send).not.toHaveBeenCalled();
      expect(await cancelNotices(codeOf(placed))).toHaveLength(0);
    });

    it('does not mail the shop about its own cancellation', async () => {
      const placed = await place(await prepareOrder());
      await settled(codeOf(placed));
      const send = vi.spyOn(mail, 'sendOrderNotice').mockResolvedValue(true);
      const email = adminA;
      const agent = supertest.agent(server);
      const loginToken = (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
      await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', loginToken)
        .send({ email, password: 'notice-only-password-123!' }).expect(200);
      const token = (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
      await agent.post(`/api/v1/admin/orders/${await orderIdOf(codeOf(placed))}/cancel`).set('Origin', origin).set('X-CSRF-Token', token)
        .set('Idempotency-Key', orderKey()).send({ expectedVersion: 0, reason: 'Shop hết hàng' }).expect(200);
      await new Promise((resolve) => { setTimeout(resolve, 200); });
      expect(send).not.toHaveBeenCalled();
      expect(await cancelNotices(codeOf(placed))).toHaveLength(0);
    });
  });

  it('logs a failure by order code, never by address', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(mail, 'sendOrderNotice').mockRejectedValue(new Error(`provider refused ${adminA}`));
    const order = await prepareOrder();
    const response = await place(order);
    const code = codeOf(response);
    await settled(code);
    const logged = warn.mock.calls.map((call) => String(call[0])).join('\n');
    expect(logged).toContain(code);
    for (const secret of [adminA, adminB, RECIPIENT, order.body.contact.phone, CUSTOMER_EMAIL]) expect(logged).not.toContain(secret);
  });
});

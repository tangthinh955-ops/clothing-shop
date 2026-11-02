import { createIsolatedTestDatabase } from '../../../tools/test-database.mjs';
import { type ChildProcess, spawn } from 'node:child_process';
import { randomInt, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { hash } from 'argon2';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readEnvironment } from '../dist/config/environment.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';

// M4.10.2.1 restart catch-up on the real entry point: dist/main.js, not createApplication, is what starts
// the worker, so only a real process can show that deliveries left behind are picked up after a restart.

const MINUTE = 60000;
const MAILBOX = path.resolve('../../.local/test-mailbox');

let db: PrismaService;
let isolated: Awaited<ReturnType<typeof createIsolatedTestDatabase>> | undefined;
let backend: ChildProcess | undefined;
let adminEmail = '';
let orderId = '';
let code = '';

async function noticeFor(email: string, orderCode: string) {
  for (const filename of await readdir(MAILBOX).catch(() => [])) {
    if (!filename.endsWith('.json')) continue;
    const value: unknown = await readFile(path.join(MAILBOX, filename), 'utf8').then((raw) => JSON.parse(raw) as unknown).catch(() => null);
    if (value && typeof value === 'object' && 'to' in value && value.to === email
      && 'text' in value && typeof value.text === 'string' && value.text.includes(orderCode)) return value.text;
  }
  return null;
}

beforeAll(async () => {
  isolated = await createIsolatedTestDatabase(process.env.DATABASE_URL!, 'noticeworker');
  db = new PrismaService(readEnvironment({ ...process.env, DATABASE_URL: isolated.databaseUrl }));
  adminEmail = `${randomUUID()}-admin@example.test`;
  await db.user.create({ data: { email: adminEmail, name: 'Admin khởi động', role: 'ADMIN', passwordHash: await hash('worker-only-password-123!'), emailVerifiedAt: new Date() } });
  const category = await db.category.create({ data: { name: 'Danh mục khởi động', slug: `worker-${randomUUID()}`, active: true } });
  const product = await db.product.create({ data: { name: 'Áo khởi động', slug: `worker-${randomUUID()}`, description: '', categoryId: category.id,
    status: 'PUBLISHED', priceFrom: 200000, variants: { create: [{ sku: `WRK-${randomUUID()}`.toUpperCase().slice(0, 64), size: 'M', color: 'đen', price: 200000, active: true,
      inventory: { create: { onHand: 5, reserved: 2 } } }] } }, include: { variants: true } });
  code = `WWWW${randomUUID().replace(/[^A-F0-9]/gi, '').toUpperCase().slice(0, 8)}`;
  const order = await db.order.create({ data: {
    code, status: 'PENDING', source: 'WEB', userId: null, recipientName: 'Khách Khởi Động', phone: '0905000001', email: null, province: 'Hà Nội', district: '',
    ward: 'Phường A', addressLine: '1 Phố B', note: null, method: 'COD', currency: 'VND', subtotalVnd: 400000, shippingFeeVnd: 30000, totalVnd: 430000, settingsVersion: 0, version: 0,
    items: { create: [{ variantId: product.variants[0]!.id, productName: 'Áo khởi động', sku: 'SKU-W', size: 'M', color: 'đen', unitPriceVnd: 200000, quantity: 2, lineTotalVnd: 400000 }] },
    history: { create: [{ fromStatus: null, toStatus: 'PENDING', actorType: 'GUEST', actorId: null, version: 0 }] },
  } });
  orderId = order.id;
  // Two ways a delivery outlives its process: failed and now due, and never claimed.
  await db.notificationDelivery.create({ data: { event: 'order.created.shop', orderId, recipient: adminEmail, status: 'FAILED', attempts: 1, nextAttemptAt: new Date(Date.now() - MINUTE) } });
  await db.notificationDelivery.create({ data: { event: 'order.cancelled.shop', orderId, recipient: adminEmail, status: 'PENDING', createdAt: new Date(Date.now() - 10 * MINUTE) } });
});

afterAll(async () => {
  backend?.kill();
  try { await db?.$disconnect(); } finally { await isolated?.cleanup(); }
});

describe('the backend process (M4.10.2.1)', () => {
  it('picks up deliveries left behind as soon as it starts', async () => {
    backend = spawn(process.execPath, ['dist/main.js'], {
      env: { ...process.env, DATABASE_URL: isolated!.databaseUrl, PORT: String(randomInt(20000, 40000)), MAIL_MODE: 'preview', MAIL_PREVIEW_DIR: MAILBOX },
      stdio: 'ignore',
    });
    await vi.waitFor(async () => {
      const rows = await db.notificationDelivery.findMany({ where: { orderId } });
      expect(rows.map((row) => row.status)).toEqual(['SENT', 'SENT']);
    }, { timeout: 12000, interval: 200 });
    const rows = await db.notificationDelivery.findMany({ where: { orderId }, orderBy: { event: 'asc' } });
    expect(rows[0]).toMatchObject({ event: 'order.cancelled.shop', attempts: 1 });
    expect(rows[1]).toMatchObject({ event: 'order.created.shop', attempts: 2 });
    expect(await noticeFor(adminEmail, code)).not.toBeNull();
    expect(backend.exitCode).toBeNull();
  });
});

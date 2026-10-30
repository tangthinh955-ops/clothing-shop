import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { hash } from 'argon2';
import supertest, { type Agent } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../dist/application.js';
import { readEnvironment } from '../dist/config/environment.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';

// M4.1.1: read-only settings endpoints. The shared shop_settings row "default" is never modified or
// deleted by this suite — a missing row is created as a run fixture and cleaned up, an existing row
// is only read and its values asserted dynamically.

const origin = 'http://localhost:5173';
const adminEmail = `settings-${randomUUID()}@example.test`;
const customerEmail = `settings-${randomUUID()}@example.test`;
const password = 'settings-integration-password-123!';
let app: Awaited<ReturnType<typeof createApplication>>;
let db: PrismaService;
let server: Server;
let admin: Agent;
let customer: Agent;
let settingsCreated = false;
let saved: { shippingFeeVnd: number; bankDeadlineMinutes: number; bankName: string | null; bankBin: string | null;
  bankAccountNumber: string | null; bankAccountName: string | null; version: number };
let savedUpdatedAt = '';
const emails = [adminEmail, customerEmail];

beforeAll(async () => {
  if (process.env['NODE_ENV'] !== 'test' || !new URL(process.env['DATABASE_URL'] ?? '').pathname.endsWith('_test')) throw new Error('Test DB required');
  app = await createApplication(readEnvironment({ ...process.env, APP_ORIGIN: origin }));
  await app.listen(0, '127.0.0.1');
  db = app.get(PrismaService); server = app.getHttpServer() as Server;
  const passwordHash = await hash(password);
  await db.user.createMany({ data: [
    { email: adminEmail, name: 'Admin cài đặt thử', role: 'ADMIN', passwordHash, emailVerifiedAt: new Date() },
    { email: customerEmail, name: 'Khách cài đặt thử', role: 'CUSTOMER', passwordHash, emailVerifiedAt: new Date() },
  ] });
  admin = supertest.agent(server);
  customer = supertest.agent(server);
  const login = async (agent: Agent, email: string) => {
    const token = (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
    await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', token).send({ email, password }).expect(200);
  };
  await login(admin, adminEmail);
  await login(customer, customerEmail);
  if (!await db.shopSettings.findUnique({ where: { id: 'default' } })) {
    await db.shopSettings.create({ data: { id: 'default', shippingFeeVnd: 45000, bankDeadlineMinutes: 150,
      bankName: 'Ngân hàng thử', bankBin: '970422', bankAccountNumber: '12345678', bankAccountName: 'CONG TY THU' } });
    settingsCreated = true;
  }
  const row = await db.shopSettings.findUniqueOrThrow({ where: { id: 'default' } });
  saved = { shippingFeeVnd: row.shippingFeeVnd, bankDeadlineMinutes: row.bankDeadlineMinutes, bankName: row.bankName,
    bankBin: row.bankBin, bankAccountNumber: row.bankAccountNumber, bankAccountName: row.bankAccountName, version: row.version };
  savedUpdatedAt = row.updatedAt.toISOString();
});

afterAll(async () => {
  if (!db) return;
  // Steps clean independently; leftover counts and step errors must fail the suite instead of leaving
  // a green run with residue. The shared settings row is only removed when this run created it.
  const problems: string[] = [];
  const attempt = (label: string, step: () => Promise<unknown>) =>
    step().catch((error: unknown) => { problems.push(`${label}: ${error instanceof Error ? error.message : String(error)}`); });
  try {
    if (settingsCreated) await attempt('shop settings', () => db.shopSettings.deleteMany({ where: { id: 'default' } }));
    await attempt('users', () => db.user.deleteMany({ where: { email: { in: emails } } }));
    const leftovers: string[] = [];
    const expectGone = async (label: string, remaining: Promise<number>) => {
      if (await remaining > 0) leftovers.push(label);
    };
    if (settingsCreated) await expectGone('shop settings', db.shopSettings.count({ where: { id: 'default' } }));
    await expectGone('users', db.user.count({ where: { email: { in: emails } } }));
    if (problems.length || leftovers.length) {
      throw new Error(`Cleanup incomplete (failed steps: ${problems.join('; ') || 'none'}; leftovers: ${leftovers.join(', ') || 'none'})`);
    }
  } finally { await app.close(); }
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
    expect(row.updatedAt.toISOString()).toBe(savedUpdatedAt);
  });
});

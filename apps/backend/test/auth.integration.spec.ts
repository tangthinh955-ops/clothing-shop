import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import path from 'node:path';
import supertest, { type Agent } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../dist/application.js';
import { readEnvironment } from '../dist/config/environment.js';
import { PrismaService } from '../dist/prisma/prisma.service.js';

const origin = 'http://localhost:5173';
const password = 'local-test-password-123!';
const mailbox = path.resolve('../../.local/test-mailbox', randomUUID());
const emails = new Set<string>();
let app: Awaited<ReturnType<typeof createApplication>>;
let db: PrismaService;
let server: Server;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new Error('Expected object response');
  return value as Record<string, unknown>;
}

async function csrf(agent: Agent): Promise<string> {
  const response = await agent.get('/api/v1/auth/csrf').expect(200);
  const value = record(response.body)['csrfToken'];
  if (typeof value !== 'string') throw new Error('Missing csrf token');
  return value;
}

async function register(agent: Agent, extra: Record<string, unknown> = {}): Promise<string> {
  const email = `integration-${randomUUID()}@example.test`;
  emails.add(email);
  const token = await csrf(agent);
  await agent.post('/api/v1/auth/register').set('Origin', origin).set('X-CSRF-Token', token)
    .send({ email, password, name: 'Khách thử', ...extra }).expect(202);
  return email;
}

async function mailToken(email: string, kind: 'verify-email' | 'reset-password'): Promise<string> {
  for (const filename of (await readdir(mailbox)).reverse()) {
    const mail = record(JSON.parse(await readFile(path.join(mailbox, filename), 'utf8')) as unknown);
    if (mail['to'] !== email || typeof mail['text'] !== 'string') continue;
    const url = mail['text'].split(/\s/).find((word) => word.startsWith(`${origin}/${kind}#`));
    if (url) {
      const token = new URLSearchParams(new URL(url).hash.slice(1)).get('token');
      if (token) return token;
    }
  }
  throw new Error('Expected a real preview email for this test');
}

async function login(agent: Agent, email: string, inputPassword = password) {
  const token = await csrf(agent);
  return agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', token)
    .send({ email, password: inputPassword });
}

beforeAll(async () => {
  const url = process.env['DATABASE_URL'];
  if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('Integration requires a separate *_test database');
  if (process.env['NODE_ENV'] !== 'test') throw new Error('Integration requires NODE_ENV=test');
  const config = readEnvironment({ ...process.env, APP_ORIGIN: origin, MAIL_PREVIEW_DIR: mailbox });
  app = await createApplication(config);
  await app.listen(0, '127.0.0.1');
  db = app.get(PrismaService);
  server = app.getHttpServer() as Server;
});

afterAll(async () => {
  // Only test-created identities; never truncate shared tables or reset a database.
  if (db) await db.user.deleteMany({ where: { email: { in: [...emails] } } });
  if (app) await app.close();
});

describe('auth HTTP + real PostgreSQL + local email adapter', () => {
  it('does not accept a forged role or unlisted field on registration', async () => {
    const agent = supertest.agent(server);
    const token = await csrf(agent);
    await agent.post('/api/v1/auth/register').set('Origin', origin).set('X-CSRF-Token', token)
      .send({ email: 'forged@example.test', name: 'Khách thử', password, role: 'ADMIN' }).expect(400);
    expect(await db.user.findUnique({ where: { email: 'forged@example.test' } })).toBeNull();
  });

  it('requires CSRF and exact origin even for login', async () => {
    const agent = supertest.agent(server);
    await agent.post('/api/v1/auth/login').set('Origin', origin).send({ email: 'a@example.test', password }).expect(403);
    await agent.post('/api/v1/auth/login').set('Origin', 'https://attacker.example')
      .set('X-CSRF-Token', await csrf(agent)).send({ email: 'a@example.test', password }).expect(403);
  });

  it('hashes the password, sends verification, hides secrets and accepts the verification once', async () => {
    const agent = supertest.agent(server);
    const email = await register(agent);
    const stored = await db.user.findUniqueOrThrow({ where: { email } });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored.passwordHash).not.toBe(password);
    expect(stored.role).toBe('CUSTOMER');
    const token = await mailToken(email, 'verify-email');
    const rows = await db.authToken.findMany({ where: { userId: stored.id } });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => row.tokenHash === token)).toBe(false);
    await agent.post('/api/v1/auth/verify-email').set('Origin', origin).set('X-CSRF-Token', await csrf(agent))
      .send({ token }).expect(200);
    await agent.post('/api/v1/auth/verify-email').set('Origin', origin).set('X-CSRF-Token', await csrf(agent))
      .send({ token }).expect(400);
    const signedIn = await login(agent, email);
    expect(signedIn.status).toBe(200);
    expect(record(signedIn.body)['role']).toBe('CUSTOMER');
    expect(JSON.stringify(signedIn.body)).not.toContain('passwordHash');
    expect(JSON.stringify(signedIn.body)).not.toContain('sessionVersion');
    const me = await agent.get('/api/v1/me').expect(200);
    expect(record(me.body)['email']).toBe(email);
    expect(me.headers['cache-control']).toContain('no-store');
    await agent.post('/api/v1/auth/logout').set('Origin', origin).set('X-CSRF-Token', await csrf(agent)).expect(204);
    await agent.get('/api/v1/me').expect(401);
  });

  it('returns the same safe login failure for absent accounts and wrong passwords', async () => {
    const agent = supertest.agent(server);
    const email = await register(agent);
    const wrong = await login(agent, email, 'definitely-wrong-password');
    const absent = await login(agent, 'absent@example.test');
    expect(wrong.status).toBe(401);
    expect(absent.status).toBe(401);
    expect(record(wrong.body)['message']).toBe(record(absent.body)['message']);
    expect(record(wrong.body)['code']).toBe('INVALID_CREDENTIALS');
  });

  it('denies admin API to a customer and accepts an admin after reading the real user role', async () => {
    const customer = supertest.agent(server);
    const email = await register(customer);
    await login(customer, email).then((response) => expect(response.status).toBe(200));
    await customer.get('/api/v1/admin/access').expect(403);
    // Fixture elevation is test-only. Production has a separate one-time admin CLI.
    await db.user.update({ where: { email }, data: { role: 'ADMIN', emailVerifiedAt: new Date() } });
    const admin = supertest.agent(server);
    await login(admin, email).then((response) => expect(response.status).toBe(200));
    await admin.get('/api/v1/admin/access').expect(200);
  });

  it('resets one time, invalidates existing sessions and refuses the old password', async () => {
    const oldAgent = supertest.agent(server);
    const email = await register(oldAgent);
    await login(oldAgent, email).then((response) => expect(response.status).toBe(200));
    const resetAgent = supertest.agent(server);
    const initialToken = await csrf(resetAgent);
    await resetAgent.post('/api/v1/auth/forgot-password').set('Origin', origin).set('X-CSRF-Token', initialToken)
      .send({ email }).expect(202);
    const token = await mailToken(email, 'reset-password');
    const newPassword = 'new-test-password-456!';
    await resetAgent.post('/api/v1/auth/reset-password').set('Origin', origin).set('X-CSRF-Token', await csrf(resetAgent))
      .send({ token, password: newPassword }).expect(200);
    await oldAgent.get('/api/v1/me').expect(401);
    expect((await login(resetAgent, email)).status).toBe(401);
    expect((await login(resetAgent, email, newPassword)).status).toBe(200);
    await resetAgent.post('/api/v1/auth/reset-password').set('Origin', origin).set('X-CSRF-Token', await csrf(resetAgent))
      .send({ token, password: newPassword }).expect(400);
  });

  it('does not allow an expired reset token to change the password', async () => {
    const agent = supertest.agent(server);
    const email = await register(agent);
    await agent.post('/api/v1/auth/forgot-password').set('Origin', origin).set('X-CSRF-Token', await csrf(agent))
      .send({ email }).expect(202);
    const token = await mailToken(email, 'reset-password');
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    await db.authToken.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await agent.post('/api/v1/auth/reset-password').set('Origin', origin).set('X-CSRF-Token', await csrf(agent))
      .send({ token, password: 'replacement-password-123' }).expect(400);
    expect((await login(agent, email)).status).toBe(200);
  });

  it('never lets profile updates change role or verification state', async () => {
    const agent = supertest.agent(server);
    const email = await register(agent);
    await login(agent, email);
    await agent.patch('/api/v1/me').set('Origin', origin).set('X-CSRF-Token', await csrf(agent))
      .send({ name: 'Tên mới', role: 'ADMIN' }).expect(400);
    await agent.patch('/api/v1/me').set('Origin', origin).set('X-CSRF-Token', await csrf(agent))
      .send({ name: 'Tên mới' }).expect(200);
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user.name).toBe('Tên mới');
    expect(user.role).toBe('CUSTOMER');
  });

  it('rotates the pre-login session and sets browser protection flags', async () => {
    const agent = supertest.agent(server);
    const pre = await agent.get('/api/v1/auth/csrf').expect(200);
    const preCookie = (pre.headers['set-cookie'] as string[] | undefined)?.[0]?.split(';')[0];
    const email = await register(agent);
    const result = await login(agent, email);
    expect(result.status).toBe(200);
    const cookie = (result.headers['set-cookie'] as string[] | undefined)?.[0] ?? '';
    expect(cookie.includes('HttpOnly') && cookie.includes('SameSite=Lax')).toBe(true);
    expect(Boolean(preCookie) && cookie.split(';')[0] !== preCookie).toBe(true);
  });

  for (const scenario of [
    { role: 'CUSTOMER', field: 'lastSeenAt', age: 25 * 3600000 },
    { role: 'CUSTOMER', field: 'authenticatedAt', age: 8 * 86400000 },
    { role: 'ADMIN', field: 'lastSeenAt', age: 31 * 60000 },
    { role: 'ADMIN', field: 'authenticatedAt', age: 13 * 3600000 },
  ] as const) {
    it(`enforces ${scenario.role} ${scenario.field} expiry on the server`, async () => {
      const agent = supertest.agent(server);
      const email = await register(agent);
      const user = await db.user.update({ where: { email }, data: { role: scenario.role } });
      expect((await login(agent, email)).status).toBe(200);
      await db.$executeRaw`UPDATE sessions SET sess = jsonb_set(sess, ARRAY[${scenario.field}], to_jsonb(${Date.now() - scenario.age}::bigint)) WHERE sess->>'userId' = ${user.id}`;
      await agent.get('/api/v1/me').expect(401);
    });
  }

  it('rejects a disabled account even if a valid session cookie remains', async () => {
    const agent = supertest.agent(server);
    const email = await register(agent);
    expect((await login(agent, email)).status).toBe(200);
    await db.user.update({ where: { email }, data: { disabledAt: new Date() } });
    await agent.get('/api/v1/me').expect(401);
    expect((await login(agent, email)).status).toBe(401);
  });

  it('allows only one concurrent use of a reset token', async () => {
    const agent = supertest.agent(server);
    const email = await register(agent);
    await agent.post('/api/v1/auth/forgot-password').set('Origin', origin).set('X-CSRF-Token', await csrf(agent)).send({ email }).expect(202);
    const token = await mailToken(email, 'reset-password');
    const header = await csrf(agent);
    const reset = () => agent.post('/api/v1/auth/reset-password').set('Origin', origin).set('X-CSRF-Token', header)
      .send({ token, password: 'concurrent-password-789!' });
    const results = await Promise.all([reset(), reset()]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 400]);
  });

  it('rate limits repeated incorrect logins without exposing account existence', async () => {
    const agent = supertest.agent(server);
    const email = await register(agent);
    for (let i = 0; i < 5; i += 1) expect((await login(agent, email, 'incorrect-password-123')).status).toBe(401);
    const limited = await login(agent, email, 'incorrect-password-123');
    expect(limited.status).toBe(429);
    expect(record(limited.body)['code']).toBe('RATE_LIMITED');
  });
});

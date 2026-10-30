import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import sharp from 'sharp';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../dist/application.js';
import { readEnvironment, type AppConfig } from '../dist/config/environment.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';
import { UploadsService } from '../dist/modules/uploads/uploads.service.js';

// Production-shaped config on the _test database: HTTPS origin, real mail mode, a trusted proxy hop and an
// absolute uploads folder, as on the VPS. Nothing here sends mail or leaves the temp folder.
const ownerEmail = `prod-config-${randomUUID()}@example.test`;
let db: PrismaService;
let uploadsDir: string;
let production: AppConfig;

beforeAll(async () => {
  if (process.env['NODE_ENV'] !== 'test' || !new URL(process.env['DATABASE_URL'] ?? '').pathname.endsWith('_test')) throw new Error('Test DB required');
  uploadsDir = await mkdtemp(path.join(tmpdir(), 'prod-uploads-'));
  // The `{...process.env}` spread loads `.env.test`, whose development-grade session secret contains
  // the marker strings the production validator rejects; a valid production-shaped secret is supplied
  // here explicitly (≥32 chars, no forbidden markers) and the validator itself stays untouched.
  production = readEnvironment({ ...process.env, NODE_ENV: 'production', APP_ORIGIN: 'https://shop.example', MAIL_MODE: 'resend',
    SESSION_SECRET: 'prod-config-spec-secret-000102030405060708090a0b0c0d0e0f',
    RESEND_API_KEY: 're_test_not_used', MAIL_FROM: 'shop@shop.example', SWAGGER_ENABLED: 'false', TRUST_PROXY: '1', UPLOADS_DIR: uploadsDir });
  db = new PrismaService(readEnvironment(process.env));
  await db.user.create({ data: { email: ownerEmail, name: 'Admin cấu hình VPS', role: 'ADMIN', passwordHash: 'not-used', emailVerifiedAt: new Date() } });
});

afterAll(async () => {
  if (!db) return;
  try {
    const owner = await db.user.findUnique({ where: { email: ownerEmail } });
    if (owner) {
      await db.uploadAsset.deleteMany({ where: { ownerId: owner.id } });
      await db.user.delete({ where: { id: owner.id } });
    }
  } finally {
    await db.$disconnect();
    if (uploadsDir) await rm(uploadsDir, { recursive: true, force: true });
  }
});

describe('production configuration on a VPS', () => {
  it('accepts admin uploads in production and stores them in the configured absolute folder', async () => {
    const owner = await db.user.findUniqueOrThrow({ where: { email: ownerEmail } });
    const uploads = new UploadsService(db, production);
    const image = await sharp({ create: { width: 120, height: 160, channels: 3, background: '#8899aa' } }).png().toBuffer();
    const saved = await uploads.upload(owner.id, { buffer: image, mimetype: 'image/png' });
    expect(await readdir(uploadsDir)).toEqual([`${saved.id}.webp`]);
    expect((await uploads.read(saved.id, owner.id)).length).toBeGreaterThan(0);
  });

  it('issues the secure __Host- session cookie when the reverse proxy forwards HTTPS', async () => {
    const app = await createApplication(production);
    try {
      await app.listen(0, '127.0.0.1');
      const server = app.getHttpServer() as Server;
      const response = await supertest(server).get('/api/v1/auth/csrf').set('X-Forwarded-Proto', 'https').expect(200);
      const cookie = ([] as string[]).concat(response.headers['set-cookie'] ?? []).join(';');
      expect(cookie).toMatch(/__Host-shop\.sid=/);
      expect(cookie).toMatch(/Secure/i);
    } finally { await app.close(); }
  });
});

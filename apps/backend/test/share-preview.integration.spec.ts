import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import supertest, { type Agent } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../dist/application.js';
import { readEnvironment } from '../dist/config/environment.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';

const origin = 'http://localhost:5173';
const email = `share-${randomUUID()}@example.test`;
const testEmails = new Set([email]);
let app: Awaited<ReturnType<typeof createApplication>>;
let db: PrismaService;
let server: Server;
let admin: Agent;
let categoryId = '';
let assetIds: string[] = [];
let namedSlug = '';
let plainSlug = '';
let draftSlug = '';
let xssSlug = '';

const write = async (path: string, body: object, method: 'post' | 'patch' | 'put' = 'post', key?: string) => {
  const token = (await admin.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
  const call = admin[method](`/api/v1${path}`).set('Origin', origin).set('X-CSRF-Token', token);
  if (key) call.set('Idempotency-Key', key);
  return call.send(body);
};
const share = (slug: string) => supertest(server).get(`/api/v1/share/products/${slug}`);
// Publish rules require at least one image and every asset belongs to exactly one product, so
// each published fixture uploads its own PNG and then attaches + publishes it.
const publishWithOwnImage = async (productId: string, version: number) => {
  const { default: sharp } = await import('sharp');
  const image = await sharp({ create: { width: 750, height: 1000, channels: 3, background: '#e4dfd7' } }).png().toBuffer();
  const csrf = (await admin.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
  const upload = await admin.post('/api/v1/admin/uploads/images').set('Origin', origin).set('X-CSRF-Token', csrf)
    .attach('file', image, { filename: 'share.png', contentType: 'image/png' }).expect(201);
  assetIds.push(upload.body.id as string);
  const attached = await write(`/admin/products/${productId}/images`, { assetIds: [upload.body.id as string], expectedVersion: version }, 'put');
  expect(attached.status).toBe(200);
  const published = await write(`/admin/products/${productId}/publish`, { expectedVersion: attached.body.version as number });
  expect(published.status).toBe(201);
  return upload.body.id as string;
};

beforeAll(async () => {
  if (process.env['NODE_ENV'] !== 'test' || !new URL(process.env['DATABASE_URL'] ?? '').pathname.endsWith('_test')) throw new Error('Test DB required');
  app = await createApplication(readEnvironment({ ...process.env, APP_ORIGIN: origin }));
  await app.listen(0, '127.0.0.1');
  db = app.get(PrismaService); server = app.getHttpServer() as Server;
  admin = supertest.agent(server);
  await write('/auth/register', { email, name: 'Admin thử', password: 'share-password-123!' }).then((r) => expect(r.status).toBe(202));
  await db.user.update({ where: { email }, data: { role: 'ADMIN', emailVerifiedAt: new Date() } });
  await write('/auth/login', { email, password: 'share-password-123!' }).then((r) => expect(r.status).toBe(200));

  const category = await write('/admin/categories', { name: 'Áo share thử', slug: `share-${randomUUID()}`, active: true });
  expect(category.status).toBe(201); categoryId = category.body.id as string;
  const sku = `SHARE-${randomUUID()}`.toUpperCase();
  const variants = (size: string, price: number, suffix: string) => [{ sku: `${sku}-${suffix}`, size, color: 'đen', price, active: true }];
  // One published product with a description, one without, one draft, one with HTML in the name.
  const named = await write('/admin/products', { name: 'Áo share có ảnh', slug: `named-${randomUUID()}`, description: 'Áo cotton 280gsm.', categoryId,
    variants: variants('M', 250000, 'A') });
  expect(named.status).toBe(201);
  namedSlug = named.body.slug as string;
  const plain = await write('/admin/products', { name: 'Áo share không mô tả', slug: `plain-${randomUUID()}`, description: '', categoryId,
    variants: variants('L', 300000, 'B') });
  expect(plain.status).toBe(201);
  plainSlug = plain.body.slug as string;
  const draft = await write('/admin/products', { name: 'Áo share nháp', slug: `draft-${randomUUID()}`, description: 'Chưa bán.', categoryId,
    variants: variants('M', 100000, 'C') });
  expect(draft.status).toBe(201);
  draftSlug = draft.body.slug as string;
  const xss = await write('/admin/products', { name: 'Áo "<b>đậm</b>" & của hàng', slug: `xss-${randomUUID()}`, description: 'Mô tả có "<ký tự>" đặc biệt.', categoryId,
    variants: variants('M', 200000, 'D') });
  expect(xss.status).toBe(201);
  xssSlug = xss.body.slug as string;

  await publishWithOwnImage(named.body.id as string, named.body.version as number);
  await publishWithOwnImage(plain.body.id as string, plain.body.version as number);
  await publishWithOwnImage(xss.body.id as string, xss.body.version as number);
});

afterAll(async () => {
  if (db) {
    const products = await db.product.findMany({ where: { category: { id: categoryId } }, select: { id: true } });
    for (const product of products) {
      await db.productImage.deleteMany({ where: { productId: product.id } });
      await db.inventory.deleteMany({ where: { variant: { productId: product.id } } });
      await db.variant.deleteMany({ where: { productId: product.id } });
      await db.product.deleteMany({ where: { id: product.id } });
    }
    for (const assetId of assetIds) await db.uploadAsset.deleteMany({ where: { id: assetId } });
    if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
    const users = await db.user.findMany({ where: { email: { in: [...testEmails] } }, select: { id: true } });
    for (const user of users) await db.session.deleteMany({ where: { sess: { path: ['userId'], equals: user.id } } });
    await db.user.deleteMany({ where: { email: { in: [...testEmails] } } });
  }
  if (app) await app.close();
});

describe('M7.1.1 share preview', () => {
  it('serves crawler HTML with absolute og:image and a redirect to the SPA page', async () => {
    const result = await share(namedSlug).expect(200);
    expect(result.headers['content-type']).toContain('text/html');
    expect(result.text).toContain(`<title>Áo share có ảnh | RMG Labels</title>`);
    expect(result.text).toContain(`<meta property="og:image" content="${origin}/api/v1/media/${assetIds[0]}" />`);
    expect(result.text).toContain('<meta property="og:type" content="product" />');
    expect(result.text).toContain(`<meta property="og:url" content="${origin}/api/v1/share/products/${namedSlug}" />`);
    expect(result.text).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(result.text).toContain(`<meta http-equiv="refresh" content="0; url=/products/${namedSlug}" />`);
    expect(result.text).toContain('Áo cotton 280gsm.');
    expect(result.text).not.toContain('undefined');
  });
  it('falls back to a price description when the product has none', async () => {
    const result = await share(plainSlug).expect(200);
    expect(result.text).toContain('Giá từ 300.000đ');
  });
  it('escapes product-provided text so crawlers never execute it', async () => {
    const result = await share(xssSlug).expect(200);
    expect(result.text).toContain('Áo &quot;&lt;b&gt;đậm&lt;/b&gt;&quot; &amp; của hàng');
    expect(result.text).not.toContain('<b>đậm</b>');
    expect(result.text).toContain('Mô tả có &quot;&lt;ký tự&gt;&quot; đặc biệt.');
  });
  it('answers hidden, draft and unknown slugs with the same 404', async () => {
    await share(draftSlug).expect(404);
    await share('khong-ton-tai').expect(404);
  });
});

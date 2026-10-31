import { createIsolatedTestDatabase } from '../../../tools/test-database.mjs';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import supertest, { type Agent } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../dist/application.js';
import { readEnvironment } from '../dist/config/environment.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';

// The checkout quote is a guest preview priced entirely by the server: one consistent-read transaction
// plus one quote row. Stock, settings and prices are read, never written; hidden rows leak nothing.

const origin = 'http://localhost:5173';
let app: Awaited<ReturnType<typeof createApplication>>;
let db: PrismaService;
let isolated: Awaited<ReturnType<typeof createIsolatedTestDatabase>> | undefined;
let server: Server;
let guest: Agent;

const tag = () => randomUUID().replaceAll('-', '').toUpperCase().slice(0, 12);
let variantA = ''; // 200.000đ, onHand 5
let variantB = ''; // 300.000đ, onHand 3
let variantDraft = ''; // variant of a DRAFT product
let variantInactive = ''; // inactive variant of product A
let categoryId = '';
let productAId = '';
let productDraftId = '';
let settingsPreExisting = false;

async function quote(body: unknown, options: { withoutCsrf?: boolean } = {}): Promise<supertest.Response> {
  let csrfToken: string | undefined;
  if (!options.withoutCsrf) {
    const csrf = await guest.get('/api/v1/auth/csrf').expect(200);
    csrfToken = (csrf.body as { csrfToken: string }).csrfToken;
  }
  const request = guest.post('/api/v1/checkout/quote');
  if (csrfToken !== undefined) request.set('X-CSRF-Token', csrfToken);
  request.set('Origin', origin).send(body);
  return await request;
}

beforeAll(async () => {
  isolated = await createIsolatedTestDatabase(process.env.DATABASE_URL!, 'quote');
  process.env.DATABASE_URL = isolated.databaseUrl;
  app = await createApplication(readEnvironment({ ...process.env, APP_ORIGIN: origin }));
  await app.listen(0, '127.0.0.1');
  db = app.get(PrismaService); server = app.getHttpServer() as Server;
  guest = supertest.agent(server);
  await db.shopSettings.create({ data: { id: 'default', shippingFeeVnd: 30000, bankDeadlineMinutes: 120 } });
  const category = await db.category.create({ data: { name: 'Danh mục báo giá thử', slug: `quote-${tag().toLowerCase()}`, active: true } });
  categoryId = category.id;
  const productA = await db.product.create({ data: { name: 'Áo báo giá A', slug: `quote-a-${tag().toLowerCase()}`, description: '', categoryId,
    status: 'PUBLISHED', priceFrom: 200000, variants: { create: [
      { sku: `QA-${tag()}`, size: 'M', color: 'đen', price: 200000, active: true, inventory: { create: { onHand: 5, reserved: 0 } } },
      { sku: `QAI-${tag()}`, size: 'L', color: 'đen', price: 210000, active: false, inventory: { create: { onHand: 5, reserved: 0 } } },
    ] } } });
  productAId = productA.id;
  variantA = (await db.variant.findFirstOrThrow({ where: { productId: productAId, active: true } })).id;
  variantInactive = (await db.variant.findFirstOrThrow({ where: { productId: productAId, active: false } })).id;
  const productB = await db.product.create({ data: { name: 'Quần báo giá B', slug: `quote-b-${tag().toLowerCase()}`, description: '', categoryId,
    status: 'PUBLISHED', priceFrom: 300000, variants: { create: [
      { sku: `QB-${tag()}`, size: 'L', color: 'xanh', price: 300000, active: true, inventory: { create: { onHand: 3, reserved: 0 } } },
    ] } } });
  variantB = (await db.variant.findFirstOrThrow({ where: { productId: productB.id } })).id;
  const productDraft = await db.product.create({ data: { name: 'Áo nháp giấu', slug: `quote-d-${tag().toLowerCase()}`, description: '', categoryId,
    status: 'DRAFT', priceFrom: 500000, variants: { create: [
      { sku: `QD-${tag()}`, size: 'M', color: 'trắng', price: 500000, active: true, inventory: { create: { onHand: 9, reserved: 0 } } },
    ] } } });
  productDraftId = productDraft.id;
  variantDraft = (await db.variant.findFirstOrThrow({ where: { productId: productDraftId } })).id;
});

afterAll(async () => {
  try { if (app) await app.close(); } finally { await isolated?.cleanup(); }
});

describe('POST /checkout/quote (M4.2.2)', () => {
  it('prices the guest cart from server data, stores the snapshot and touches no stock', async () => {
    const inventoryBefore = await db.inventory.findMany({ where: { variantId: { in: [variantA, variantB] } }, orderBy: { variantId: 'asc' } });
    const response = await quote({ items: [{ variantId: variantA.toUpperCase(), quantity: 2 }, { variantId: variantB, quantity: 1 }], method: 'COD' });
    expect(response.status).toBe(201);
    const body = response.body as Record<string, unknown>;
    expect(body).toMatchObject({ method: 'COD', currency: 'VND', subtotal: 700000, shippingFee: 30000,
      total: 730000, settingsVersion: 0 });
    expect(Array.isArray(body['items'])).toBe(true);
    expect(typeof body['quoteId']).toBe('string');
    expect(typeof body['serverNow']).toBe('string');
    const row = await db.checkoutQuote.findUniqueOrThrow({ where: { id: body['quoteId'] as string } });
    expect(Number(row.subtotalVnd)).toBe(700000);
    expect(Number(row.shippingFeeVnd)).toBe(30000);
    expect(Number(row.totalVnd)).toBe(730000);
    expect(row.method).toBe('COD');
    expect(row.currency).toBe('VND');
    expect(row.items).toEqual(body['items']);
    const span = row.expiresAt.getTime() - Date.parse(body['serverNow'] as string);
    expect(span).toBe(15 * 60000);
    const inventoryAfter = await db.inventory.findMany({ where: { variantId: { in: [variantA, variantB] } }, orderBy: { variantId: 'asc' } });
    expect(inventoryAfter).toEqual(inventoryBefore);
    expect(await db.order.count()).toBe(0);
    expect(await db.orderItem.count()).toBe(0);
    expect(await db.orderStatusHistory.count()).toBe(0);
    expect(await db.inventoryMovement.count()).toBe(0);
    expect(await db.idempotencyRecord.count()).toBe(0);
  });

  it('keeps old quotes untouched when prices or settings change and prices new quotes freshly', async () => {
    const first = await quote({ items: [{ variantId: variantA, quantity: 1 }], method: 'COD' });
    expect(first.status).toBe(201);
    const firstBody = first.body as Record<string, unknown>;
    const firstRow = await db.checkoutQuote.findUniqueOrThrow({ where: { id: firstBody['quoteId'] as string } });
    await db.variant.update({ where: { id: variantA }, data: { price: 250000 } });
    await db.shopSettings.update({ where: { id: 'default' }, data: { shippingFeeVnd: 40000, version: { increment: 1 } } });
    const recheck = await db.checkoutQuote.findUniqueOrThrow({ where: { id: firstBody['quoteId'] as string } });
    expect(recheck).toMatchObject({ subtotalVnd: firstRow.subtotalVnd, shippingFeeVnd: firstRow.shippingFeeVnd,
      totalVnd: firstRow.totalVnd, settingsVersion: firstRow.settingsVersion });
    const second = await quote({ items: [{ variantId: variantA, quantity: 1 }], method: 'COD' });
    expect(second.status).toBe(201);
    expect(second.body).toMatchObject({ subtotal: 250000, shippingFee: 40000, total: 290000, settingsVersion: 1 });
    // Restore fixture values so later assertions stay on the agreed example.
    await db.variant.update({ where: { id: variantA }, data: { price: 200000 } });
    await db.shopSettings.update({ where: { id: 'default' }, data: { shippingFeeVnd: 30000 } });
  });

  it('rejects BANK explicitly, malformed payloads and unknown fields', async () => {
    const bank = await quote({ items: [{ variantId: variantA, quantity: 1 }], method: 'BANK' });
    expect(bank.status).toBe(400);
    expect((bank.body as { code?: string }).code).toBe('VALIDATION_ERROR');
    const bankErrors = (bank.body as { fieldErrors?: Array<{ message?: string }> }).fieldErrors ?? [];
    expect(bankErrors.some((entry) => (entry.message ?? '').includes('COD'))).toBe(true);
    for (const body of [
      { items: [], method: 'COD' },
      { items: [{ variantId: variantA, quantity: 0 }], method: 'COD' },
      { items: [{ variantId: variantA, quantity: 1.5 }], method: 'COD' },
      { items: [{ variantId: 'khong-phai-uuid', quantity: 1 }], method: 'COD' },
      { items: Array.from({ length: 101 }, () => ({ variantId: variantA, quantity: 1 })), method: 'COD' },
      { items: [{ variantId: variantA, quantity: 1 }], method: 'COD', subtotal: 1 },
    ]) {
      const response = await quote(body);
      expect(response.status).toBe(400);
      expect((response.body as { code?: string }).code).toBe('VALIDATION_ERROR');
    }
  });

  it('refuses unavailable rows with only the client id and never leaks hidden data', async () => {
    const beforeCount = await db.checkoutQuote.count();
    const response = await quote({ items: [{ variantId: variantDraft, quantity: 1 }], method: 'COD' });
    expect(response.status).toBe(409);
    const body = response.body as { code?: string; fieldErrors?: Array<{ field?: string; message?: string }> };
    expect(body.code).toBe('ITEM_UNAVAILABLE');
    expect(body.fieldErrors).toEqual([{ field: 'items.variantId', message: variantDraft }]);
    expect(JSON.stringify(response.body)).not.toContain('Áo nháp giấu');
    expect(await db.checkoutQuote.count()).toBe(beforeCount);
  });

  it('refuses quantities above available stock without reserving anything', async () => {
    const beforeCount = await db.checkoutQuote.count();
    const before = await db.inventory.findUniqueOrThrow({ where: { variantId: variantB } });
    const response = await quote({ items: [{ variantId: variantB, quantity: 4 }], method: 'COD' });
    expect(response.status).toBe(409);
    expect((response.body as { code?: string }).code).toBe('OUT_OF_STOCK');
    const after = await db.inventory.findUniqueOrThrow({ where: { variantId: variantB } });
    expect(after).toMatchObject({ onHand: before.onHand, reserved: before.reserved });
    expect(await db.checkoutQuote.count()).toBe(beforeCount);
  });

  it('refuses inactive variants and requires the CSRF mechanism', async () => {
    const beforeCount = await db.checkoutQuote.count();
    const inactive = await quote({ items: [{ variantId: variantInactive, quantity: 1 }], method: 'COD' });
    expect(inactive.status).toBe(409);
    expect((inactive.body as { code?: string }).code).toBe('ITEM_UNAVAILABLE');
    const withoutToken = await quote({ items: [{ variantId: variantA, quantity: 1 }], method: 'COD' }, { withoutCsrf: true });
    expect(withoutToken.status).toBe(403);
    expect(await db.checkoutQuote.count()).toBe(beforeCount);
  });
});

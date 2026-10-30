import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../dist/application.js';
import { readEnvironment } from '../dist/config/environment.js';
import type { Prisma } from '../dist/generated/prisma/client.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';

// Schema-level behavior of the M4 order foundation (m4-contract §2–§9): uniqueness, CHECK constraints,
// snapshot atomicity and guest/system actor metadata. No HTTP endpoints exist yet by design (M4.0.2).

const origin = 'http://localhost:5173';
let app: Awaited<ReturnType<typeof createApplication>>;
let db: PrismaService;
const orderCodes: string[] = [];
const quoteIds: string[] = [];
const idempotencyIds: string[] = [];
let categoryId = '';
let productId = '';
let variantId = '';
let settingsWritten = false;

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

function orderData(overrides: Partial<Prisma.OrderUncheckedCreateInput> = {}): Prisma.OrderUncheckedCreateInput {
  const code = `HD${randomUUID().replaceAll('-', '').slice(0, 10)}`.toUpperCase();
  orderCodes.push(code);
  return {
    code,
    recipientName: 'Khách thử', phone: '0901234567', province: 'Hà Nội', district: 'Cầu Giấy', ward: 'Dịch Vọng',
    addressLine: 'Số 12 đường thử nghiệm', method: 'COD',
    subtotalVnd: 700000, shippingFeeVnd: 30000, totalVnd: 730000, settingsVersion: 0,
    ...overrides,
  };
}

const itemData = (orderId: string, overrides: Partial<Prisma.OrderItemUncheckedCreateInput> = {}): Prisma.OrderItemUncheckedCreateInput => ({
  orderId, variantId, productName: 'Áo thử nghiệm', sku: `M4T-${randomUUID()}`.toUpperCase().slice(0, 64),
  size: 'M', color: 'đen', unitPriceVnd: 350000, quantity: 2, lineTotalVnd: 700000, ...overrides,
});

beforeAll(async () => {
  if (process.env['NODE_ENV'] !== 'test' || !new URL(process.env['DATABASE_URL'] ?? '').pathname.endsWith('_test')) throw new Error('Test DB required');
  app = await createApplication(readEnvironment({ ...process.env, APP_ORIGIN: origin }));
  db = app.get(PrismaService);
  const category = await db.category.create({ data: { name: 'Danh mục đơn thử', slug: `m4-foundation-${randomUUID()}`, active: true } });
  categoryId = category.id;
  const product = await db.product.create({ data: { name: 'Áo nền tảng thử', slug: `m4-foundation-${randomUUID()}`, description: '', categoryId,
    status: 'PUBLISHED', priceFrom: 350000, variants: { create: { sku: `M4F-${randomUUID()}`.toUpperCase().slice(0, 64), size: 'M', color: 'đen',
      price: 350000, active: true, inventory: { create: { onHand: 5, reserved: 0 } } } } } });
  productId = product.id;
  variantId = (await db.variant.findFirstOrThrow({ where: { productId } })).id;
});

afterAll(async () => {
  if (!db) return;
  // Each step cleans independently so one failure cannot strand fixtures in the shared test database;
  // leftover counts and step errors must fail the suite instead of leaving a green run with residue.
  const problems: string[] = [];
  const attempt = (label: string, step: () => Promise<unknown>) =>
    step().catch((error: unknown) => { problems.push(`${label}: ${error instanceof Error ? error.message : String(error)}`); });
  try {
    // Orders cascade their items/history; movement rows go before the variant (FK Restrict).
    if (orderCodes.length) await attempt('orders', () => db.order.deleteMany({ where: { code: { in: orderCodes } } }));
    if (quoteIds.length) await attempt('quotes', () => db.checkoutQuote.deleteMany({ where: { id: { in: quoteIds } } }));
    if (idempotencyIds.length) await attempt('idempotency', () => db.idempotencyRecord.deleteMany({ where: { id: { in: idempotencyIds } } }));
    if (productId) {
      await attempt('movements', () => db.inventoryMovement.deleteMany({ where: { variant: { productId } } }));
      await attempt('inventory', () => db.inventory.deleteMany({ where: { variant: { productId } } }));
      await attempt('variants', () => db.variant.deleteMany({ where: { productId } }));
      await attempt('product', () => db.product.deleteMany({ where: { id: productId } }));
    }
    if (categoryId) await attempt('category', () => db.category.deleteMany({ where: { id: categoryId } }));
    if (settingsWritten) await attempt('settings', () => db.shopSettings.deleteMany({ where: { id: 'default' } }));
    const leftovers: string[] = [];
    const expectGone = async (label: string, remaining: Promise<number>) => {
      if (await remaining > 0) leftovers.push(label);
    };
    if (orderCodes.length) await expectGone('orders', db.order.count({ where: { code: { in: orderCodes } } }));
    if (quoteIds.length) await expectGone('quotes', db.checkoutQuote.count({ where: { id: { in: quoteIds } } }));
    if (idempotencyIds.length) await expectGone('idempotency records', db.idempotencyRecord.count({ where: { id: { in: idempotencyIds } } }));
    if (productId) {
      await expectGone('movements', db.inventoryMovement.count({ where: { variant: { productId } } }));
      await expectGone('inventory rows', db.inventory.count({ where: { variant: { productId } } }));
      await expectGone('variants', db.variant.count({ where: { productId } }));
      await expectGone('product', db.product.count({ where: { id: productId } }));
    }
    if (categoryId) await expectGone('category', db.category.count({ where: { id: categoryId } }));
    if (settingsWritten) await expectGone('shop settings row', db.shopSettings.count({ where: { id: 'default' } }));
    if (problems.length || leftovers.length) {
      throw new Error(`Cleanup incomplete (failed steps: ${problems.join('; ') || 'none'}; leftovers: ${leftovers.join(', ') || 'none'})`);
    }
  } finally { await app.close(); }
});

describe('M4 order foundation schema', () => {
  it('enforces unique order code, unique lookup token hash and unique idempotency scope+identity+key', async () => {
    const order = await db.order.create({ data: orderData({ lookupTokenHash: tokenHash('token-thu-nhat') }) });
    await expect(db.order.create({ data: orderData({ code: order.code }) })).rejects.toMatchObject({ code: 'P2002' });
    await expect(db.order.create({ data: orderData({ lookupTokenHash: order.lookupTokenHash }) })).rejects.toMatchObject({ code: 'P2002' });
    const record = { scope: 'orders.create', identity: `guest:${randomUUID()}`, key: `key-${randomUUID()}`,
      requestHash: tokenHash('body'), resourceId: order.id, expiresAt: new Date(Date.now() + 86400000) };
    const row = await db.idempotencyRecord.create({ data: record });
    idempotencyIds.push(row.id);
    await expect(db.idempotencyRecord.create({ data: record })).rejects.toMatchObject({ code: 'P2002' });
    await expect(db.idempotencyRecord.create({ data: { ...record, requestHash: tokenHash('body-khac') } })).rejects.toMatchObject({ code: 'P2002' });
    const other = await db.idempotencyRecord.create({ data: { ...record, key: `key-${randomUUID()}` } });
    idempotencyIds.push(other.id);
    const another = await db.idempotencyRecord.create({ data: { ...record, identity: `guest:${randomUUID()}` } });
    idempotencyIds.push(another.id);
  });

  it('rejects invalid money, quantity, settings and inventory invariants through CHECK constraints', async () => {
    await expect(db.order.create({ data: orderData({ subtotalVnd: 100000, shippingFeeVnd: 30000, totalVnd: 200000 }) }))
      .rejects.toThrow(/orders_money_valid/);
    await expect(db.order.create({ data: orderData({ shippingFeeVnd: -1 }) })).rejects.toThrow(/orders_money_valid/);
    const quote = await db.checkoutQuote.create({ data: { items: [{ variantId, quantity: 2, unitPriceVnd: 350000, lineTotalVnd: 700000 }],
      method: 'BANK_TRANSFER', subtotalVnd: 700000, shippingFeeVnd: 30000, totalVnd: 730000, settingsVersion: 0,
      expiresAt: new Date(Date.now() + 1800000) } });
    quoteIds.push(quote.id);
    await expect(db.checkoutQuote.create({ data: { items: [], method: 'COD', subtotalVnd: 100000, shippingFeeVnd: 30000,
      totalVnd: 500000, settingsVersion: 0, expiresAt: new Date(Date.now() + 1800000) } })).rejects.toThrow(/checkout_quote_totals_valid/);
    const settings = await db.shopSettings.create({ data: { id: 'default' } });
    settingsWritten = true;
    expect(settings).toMatchObject({ shippingFeeVnd: 30000, bankDeadlineMinutes: 120, version: 0, bankName: null });
    await expect(db.shopSettings.update({ where: { id: 'default' }, data: { shippingFeeVnd: -100 } })).rejects.toThrow(/shop_settings_bounds_valid/);
    await expect(db.shopSettings.update({ where: { id: 'default' }, data: { bankDeadlineMinutes: 10 } })).rejects.toThrow(/shop_settings_bounds_valid/);
    await expect(db.shopSettings.update({ where: { id: 'default' }, data: { bankDeadlineMinutes: 3000 } })).rejects.toThrow(/shop_settings_bounds_valid/);
    const order = await db.order.create({ data: orderData() });
    await expect(db.orderItem.create({ data: itemData(order.id, { quantity: 0 }) })).rejects.toThrow(/order_item_fields_valid/);
    await expect(db.orderItem.create({ data: itemData(order.id, { unitPriceVnd: 100000001 }) })).rejects.toThrow(/order_item_fields_valid/);
    await expect(db.orderItem.create({ data: itemData(order.id, { lineTotalVnd: 1 }) })).rejects.toThrow(/order_item_fields_valid/);
  });

  it('persists order snapshots with history and rolls back the whole transaction when one part fails', async () => {
    const quote = await db.checkoutQuote.create({ data: { items: [{ variantId, quantity: 2, unitPriceVnd: 350000, lineTotalVnd: 700000 }],
      method: 'COD', subtotalVnd: 700000, shippingFeeVnd: 30000, totalVnd: 730000, settingsVersion: 0,
      expiresAt: new Date(Date.now() + 1800000) } });
    quoteIds.push(quote.id);
    const saved = await db.$transaction(async (tx) => {
      const order = await tx.order.create({ data: orderData({ quoteId: quote.id, method: 'COD', note: 'Giao giờ hành chính' }) });
      await tx.orderItem.create({ data: itemData(order.id) });
      await tx.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: null, toStatus: 'PENDING', actorType: 'GUEST',
        actorId: null, version: 0 } });
      return order;
    });
    expect(saved).toMatchObject({ status: 'PENDING', source: 'WEB', settingsVersion: 0 });
    expect(Number(saved.totalVnd)).toBe(730000);
    const withItems = await db.order.findUniqueOrThrow({ where: { id: saved.id }, include: { items: true, history: true } });
    expect(withItems.items).toHaveLength(1);
    expect(withItems.history).toHaveLength(1);
    expect(withItems.history[0]).toMatchObject({ fromStatus: null, toStatus: 'PENDING', actorType: 'GUEST' });
    const brokenCode = `HD${randomUUID().replaceAll('-', '').slice(0, 10)}`.toUpperCase();
    orderCodes.push(brokenCode);
    await expect(db.$transaction(async (tx) => {
      const order = await tx.order.create({ data: orderData({ code: brokenCode }) });
      await tx.orderItem.create({ data: itemData(order.id) });
      await tx.orderItem.create({ data: itemData(order.id, { variantId: randomUUID(), quantity: 1, lineTotalVnd: 350000 }) });
      return order;
    })).rejects.toBeTruthy();
    expect(await db.order.count({ where: { code: brokenCode } })).toBe(0);
    expect(await db.orderItem.count({ where: { order: { code: brokenCode } } })).toBe(0);
    expect(await db.orderStatusHistory.count({ where: { order: { code: brokenCode } } })).toBe(0);
  });

  it('stores guest/system movement metadata without users, applies defaults and keeps invariants', async () => {
    const reserveKey = `order:${randomUUID()}:reserve:${variantId}`;
    const releaseKey = `order:${randomUUID()}:release:${variantId}`;
    const reserve = await db.inventoryMovement.create({ data: { variantId, actorId: null, actorType: 'GUEST',
      source: 'ORDER_RESERVE', effectKey: reserveKey, key: reserveKey, requestHash: tokenHash('reserve'), delta: 0,
      reason: 'Đặt hàng giữ kho', before: 5, after: 5, reserved: 2, version: 1 } });
    expect(reserve).toMatchObject({ actorId: null, actorType: 'GUEST', source: 'ORDER_RESERVE' });
    const release = await db.inventoryMovement.create({ data: { variantId, actorType: 'SYSTEM', source: 'ORDER_RELEASE',
      effectKey: releaseKey, key: releaseKey, requestHash: tokenHash('release'), delta: 0, reason: 'Hết hạn nhả giữ',
      before: 5, after: 5, reserved: 0, version: 2 } });
    expect(release).toMatchObject({ actorId: null, actorType: 'SYSTEM' });
    const legacy = await db.inventoryMovement.create({ data: { variantId, key: `legacy-${randomUUID()}`, requestHash: tokenHash('legacy'),
      delta: 3, reason: 'Nhập hàng thử', before: 5, after: 8, reserved: 0, version: 3 } });
    expect(legacy).toMatchObject({ actorType: 'ADMIN', source: 'ADMIN_ADJUSTMENT' });
    await expect(db.inventoryMovement.create({ data: { variantId, key: `bad-${randomUUID()}`, requestHash: tokenHash('bad'),
      delta: 1, reason: 'Sai bất biến', before: 5, after: 5, reserved: 9, version: 4 } })).rejects.toThrow(/inventory_effect_valid/);
    await expect(db.inventoryMovement.create({ data: { variantId, actorId: randomUUID(), actorType: 'ADMIN', key: `ghost-${randomUUID()}`,
      requestHash: tokenHash('ghost'), delta: 1, reason: 'Actor không tồn tại', before: 5, after: 6, reserved: 0, version: 5 } }))
      .rejects.toBeTruthy();
    await expect(db.inventoryMovement.create({ data: { variantId, source: 'ORDER_SHIP', effectKey: reserveKey, key: `dup-${randomUUID()}`,
      requestHash: tokenHash('dup'), delta: -1, reason: 'Trùng effectKey', before: 5, after: 4, reserved: 0, version: 6 } }))
      .rejects.toMatchObject({ code: 'P2002' });
  });
});

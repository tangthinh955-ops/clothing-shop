import { BadRequestException, ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { SettingsService } from '../settings/settings.service.js';
import type { InventoryOperationsService, StockEffect } from './inventory-operations.service.js';
import { canonicalizeOrderCommand, hashOrderCommand } from './order-command.js';
import { OrderCreationService } from './order-creation.service.js';
import type { OrderNotificationsService } from './order-notifications.service.js';
import { normalizeVietnamesePhone } from './order-command.js';

const variantA = '17bfecab-9df4-4de4-bd91-3c11116fca5b';
const variantB = '98d3a8f8-8ac2-4a54-b9e4-34d3fcb8816f';
const quoteId = 'c1a2b3d4-0000-4000-8000-000000000001';
const serverNow = new Date('2026-10-31T10:00:00.000Z');
const phone = '0901234567';

const quoteSnapshot = [
  { variantId: variantA, productName: 'Áo cotton', sku: 'AO-A', size: 'M', color: 'đen', unitPriceVnd: 200000, quantity: 2, lineTotalVnd: 400000 },
  { variantId: variantB, productName: 'Quần jean', sku: 'JEAN-B', size: 'L', color: 'xanh', unitPriceVnd: 300000, quantity: 1, lineTotalVnd: 300000 },
];

const quoteRow = {
  id: quoteId, method: 'COD', items: quoteSnapshot, subtotalVnd: 700000, shippingFeeVnd: 30000,
  totalVnd: 730000, settingsVersion: 3, expiresAt: new Date(serverNow.getTime() + 10 * 60000),
};

const command = {
  quoteId, method: 'COD' as const,
  items: [{ variantId: variantA.toUpperCase(), quantity: 2 }, { variantId: variantB, quantity: 1 }],
  contact: { name: '  Nguyễn Văn A  ', phone: '+84 90 123 45 67', email: 'GUEST@Example.test' },
  address: { province: ' TP. Hồ Chí Minh ', district: '', ward: 'Phường Bến Nghé', addressLine: '  12 Nguyễn Huệ  ' },
  note: '  Giao giờ hành chính  ',
};

interface Harness {
  service: OrderCreationService;
  tx: Record<string, ReturnType<typeof vi.fn>> & { $queryRaw: ReturnType<typeof vi.fn> };
  reserve: ReturnType<typeof vi.fn>;
  settings: { currentInTx: ReturnType<typeof vi.fn> };
  isolation: { level?: string };
  commands: Array<Record<string, unknown>>;
}

function harness(options: {
  quote?: Record<string, unknown> | null;
  config?: { shippingFeeVnd: number; bankDeadlineMinutes: number; version: number };
  pendingCount?: number;
  recorded?: Record<string, unknown> | null;
  createdOrder?: Record<string, unknown>;
  reserveError?: Error;
  createError?: Error & { code?: string; meta?: { target?: string[] } };
} = {}): Harness {
  const createdOrders: Array<Record<string, unknown>> = [];
  let createCalls = 0;
  const tx = {
    idempotencyRecord: {
      findUnique: vi.fn(async () => options.recorded ?? null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data })),
    },
    $queryRaw: vi.fn(async (query: readonly string[]) => {
      const text = String(query[0] ?? query);
      if (text.includes('clock_timestamp()')) return [{ now: serverNow }];
      if (text.includes('pg_advisory')) return [{ locked: true }];
      if (text.includes('FOR UPDATE') || text.includes('FOR SHARE')) return [];
      return [];
    }),
    checkoutQuote: { findUnique: vi.fn(async () => options.quote === undefined ? quoteRow : options.quote ?? null) },
    variant: { findMany: vi.fn(async () => [
      { id: variantA, sku: 'AO-A', size: 'M', color: 'đen', price: 200000, active: true,
        inventory: { onHand: 5, reserved: 0 }, product: { name: 'Áo cotton', status: 'PUBLISHED', category: { active: true } } },
      { id: variantB, sku: 'JEAN-B', size: 'L', color: 'xanh', price: 300000, active: true,
        inventory: { onHand: 3, reserved: 0 }, product: { name: 'Quần jean', status: 'PUBLISHED', category: { active: true } } },
    ]) },
    order: {
      count: vi.fn(async () => options.pendingCount ?? 0),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        // A colliding code throws once; the retry then succeeds with a fresh code.
        if (options.createError && createCalls++ === 0) throw options.createError;
        const row = { id: 'order-1', createdAt: serverNow, ...data };
        createdOrders.push(row);
        return row;
      }),
    },
    orderItem: { createMany: vi.fn(async () => ({ count: 2 })) },
    orderStatusHistory: { create: vi.fn(async () => ({})) },
  };
  const reserve = vi.fn(async (_tx: unknown, effectKey: string, lines: Array<{ variantId: string; quantity: number }>): Promise<StockEffect[]> => {
    if (options.reserveError) throw options.reserveError;
    return lines.map((line) => ({ variantId: line.variantId, onHand: 5, reserved: line.quantity, available: 5 - line.quantity, version: 1 }));
  });
  const settings = { currentInTx: vi.fn(async () => options.config ?? { shippingFeeVnd: 30000, bankDeadlineMinutes: 120, version: 3 }) };
  const isolation: { level?: string } = {};
  const db = {
    $transaction: vi.fn(async (work: (client: typeof tx) => Promise<unknown>, options?: { isolationLevel?: string }) => {
      isolation.level = options?.isolationLevel;
      return work(tx);
    }),
    idempotencyRecord: { findUnique: vi.fn(async () => null) },
  };
  const ops = { reserve } as unknown as InventoryOperationsService;
  const notifications = { enqueueOrderCreated: vi.fn(async () => undefined), dispatchOrderCreated: vi.fn(async () => undefined) };
  const service = new OrderCreationService(db as unknown as PrismaService, settings as unknown as SettingsService, ops,
    notifications as unknown as OrderNotificationsService);
  return { service, tx, reserve, settings, isolation, commands: createdOrders };
}

describe('normalizeVietnamesePhone', () => {
  it.each([
    ['0901234567', '0901234567'],
    ['+84 90 123 45 67', '0901234567'],
    ['84.90.123.45.67', '0901234567'],
    ['  090-123-4567 ', '0901234567'],
  ])('normalizes %s to one stored form', (raw, expected) => {
    expect(normalizeVietnamesePhone(raw)).toBe(expected);
  });
  it.each(['12345', '09012345', 'abcdefghij', ''])('rejects %s as not a Vietnamese mobile number', (raw) => {
    expect(normalizeVietnamesePhone(raw)).toBeNull();
  });
});

describe('OrderCreationService.create', () => {
  it('creates a PENDING COD order from the accepted quote with full snapshot and guest history', async () => {
    const specs = harness();
    const result = await specs.service.create({ key: 'key-0123456789abcdef', sessionId: 'sess-1', dto: command });
    expect(result.order).toMatchObject({ code: expect.stringMatching(/^[A-HJ-NP-Z2-9]{12}$/), status: 'PENDING',
      method: 'COD', currency: 'VND', subtotal: 700000, shippingFee: 30000, total: 730000 });
    // 192 bits as base64url: 24 bytes encode to 32 characters.
    expect(result.lookupToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(specs.isolation.level).toBe('ReadCommitted');
    const orderData = specs.commands[0]!;
    expect(orderData).toMatchObject({ status: 'PENDING', source: 'WEB', userId: null, quoteId,
      phone, recipientName: 'Nguyễn Văn A', district: '', email: 'guest@example.test' });
    expect(orderData['lookupTokenHash']).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(orderData)).not.toContain(result.lookupToken);
    expect(specs.reserve).toHaveBeenCalledTimes(1);
    expect(specs.reserve.mock.calls[0]?.[1]).toBe(`order:order-1:reserve`);
    expect(specs.reserve.mock.calls[0]?.[3]).toEqual({ type: 'GUEST' });
    // History is created nested inside the single order insert (atomic like the M3 create path).
    expect(orderData['history']).toEqual({ create: expect.objectContaining({
      fromStatus: null, toStatus: 'PENDING', actorType: 'GUEST', actorId: null, version: 0 }) });
  });

  it('stores an idempotency record whose response is the safe view without token or PII', async () => {
    const specs = harness();
    const result = await specs.service.create({ key: 'key-0123456789abcdef', sessionId: 'sess-1', dto: command });
    const record = specs.tx.idempotencyRecord.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(record).toMatchObject({ scope: 'orders.create', identity: 'guest:sess-1', key: 'key-0123456789abcdef', resourceId: 'order-1' });
    expect(String(record['requestHash'])).toMatch(/^[a-f0-9]{64}$/);
    const response = record['response'] as Record<string, unknown>;
    expect(JSON.stringify(response)).not.toContain(result.lookupToken);
    expect(JSON.stringify(response)).not.toContain('Nguyễn Văn A');
    expect(JSON.stringify(response)).not.toContain(phone);
    expect(JSON.stringify(response)).not.toContain('GUEST@example.test');
  });

  it('answers a replay before any quote expiry, price or quota check', async () => {
    const commandHash = hashOrderCommand(canonicalizeOrderCommand(command));
    const recorded = { scope: 'orders.create', identity: 'guest:sess-1', key: 'key-0123456789abcdef',
      requestHash: commandHash, resourceId: 'order-1',
      response: { order: { code: 'AB23456789CD', status: 'PENDING', method: 'COD', currency: 'VND',
        items: quoteSnapshot, subtotal: 700000, shippingFee: 30000, total: 730000 } } };
    const specs = harness({ recorded, quote: { ...quoteRow, expiresAt: new Date(serverNow.getTime() - 60000) } });
    await expect(specs.service.create({ key: 'key-0123456789abcdef', sessionId: 'sess-1', dto: command }))
      .resolves.toMatchObject({ order: { code: 'AB23456789CD' }, replay: true });
    expect(specs.settings.currentInTx).not.toHaveBeenCalled();
    expect(specs.reserve).not.toHaveBeenCalled();
  });

  it('rejects the same key bound to different content', async () => {
    const recorded = { scope: 'orders.create', identity: 'guest:sess-1', key: 'key-0123456789abcdef',
      requestHash: 'f'.repeat(64), resourceId: 'order-1', response: {} };
    const specs = harness({ recorded });
    await expect(specs.service.create({ key: 'key-0123456789abcdef', sessionId: 'sess-1', dto: command }))
      .rejects.toThrow(/nội dung khác/);
  });

  it.each([
    ['expired', { ...quoteRow, expiresAt: new Date(serverNow.getTime() - 60000) }, /đã hết hạn/],
    ['cart mismatch', { ...quoteRow, items: [quoteSnapshot[0]!] }, /Giỏ đã thay đổi/],
    ['price change', { ...quoteRow, items: [{ ...quoteSnapshot[0]!, unitPriceVnd: 250000, lineTotalVnd: 500000 }, quoteSnapshot[1]!] }, /Giá hoặc phí đã thay đổi/],
    ['fee change', { ...quoteRow, shippingFeeVnd: 40000, totalVnd: 740000 }, /Giá hoặc phí đã thay đổi/],
  ])('blocks a $label quote with QUOTE_CHANGED', async (_label, brokenQuote, message) => {
    const specs = harness({ quote: brokenQuote });
    const error = await specs.service.create({ key: 'key-0123456789abcdef', sessionId: 'sess-1', dto: command })
      .catch((cause: unknown) => cause);
    // eslint-disable-next-line no-console
    console.log('LABEL-DEBUG', _label, error instanceof ConflictException ? 'conflict' : JSON.stringify(error).slice(0, 120));
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({ code: 'QUOTE_CHANGED' });
    expect((error as ConflictException).message).toMatch(message as RegExp);
    expect(specs.reserve).not.toHaveBeenCalled();
  });

  it('rejects a BANK command and a missing quote without reserving', async () => {
    const { service, reserve } = harness();
    await expect(service.create({ key: 'key-0123456789abcdef', sessionId: 's', dto: { ...command, method: 'BANK' } }))
      .rejects.toBeInstanceOf(BadRequestException);
    const missing = harness({ quote: null });
    await expect(missing.service.create({ key: 'key-0123456789abcdef', sessionId: 's', dto: command }))
      .rejects.toMatchObject({ response: { code: 'QUOTE_CHANGED' } });
    expect(reserve).not.toHaveBeenCalled();
  });

  it('refuses hidden or oversold rows at creation time', async () => {
    const hidden = harness();
    hidden.tx.variant.findMany.mockResolvedValue([
      { id: variantA, sku: 'AO-A', size: 'M', color: 'đen', price: 200000, active: true,
        inventory: { onHand: 5, reserved: 0 }, product: { name: 'Áo ẩn', status: 'DRAFT', category: { active: true } } }]);
    const hiddenError = await hidden.service.create({ key: 'key-0123456789abcdef', sessionId: 's', dto: command })
      .catch((cause: unknown) => cause);
    expect((hiddenError as ConflictException).getResponse()).toMatchObject({ code: 'ITEM_UNAVAILABLE' });
    expect(JSON.stringify((hiddenError as ConflictException).getResponse())).not.toContain('Áo ẩn');
    const oversold = harness();
    oversold.tx.variant.findMany.mockResolvedValue([
      { id: variantA, sku: 'AO-A', size: 'M', color: 'đen', price: 200000, active: true,
        inventory: { onHand: 1, reserved: 0 }, product: { name: 'Áo cotton', status: 'PUBLISHED', category: { active: true } } }]);
    await expect(oversold.service.create({ key: 'key-0123456789abcdef', sessionId: 's', dto: command }))
      .rejects.toMatchObject({ response: { code: 'OUT_OF_STOCK' } });
  });

  it('enforces the pending-order quota per normalized phone under the advisory lock', async () => {
    const specs = harness({ pendingCount: 3 });
    const error = await specs.service.create({ key: 'key-0123456789abcdef', sessionId: 'sess-1', dto: command })
      .catch((cause: unknown) => cause);
    expect((error as { status?: number; getResponse(): unknown }).status).toBe(429);
    expect((error as { getResponse(): { code?: string } }).getResponse().code).toBe('RATE_LIMITED');
    expect(JSON.stringify(specs.tx.$queryRaw.mock.calls)).toContain('pg_advisory_xact_lock');
    expect(specs.reserve).not.toHaveBeenCalled();
  });

  it('rolls the whole transaction back when the stock reserve fails', async () => {
    const specs = harness({ reserveError: new ConflictException({ code: 'OUT_OF_STOCK', message: 'Chỉ còn 0 chiếc.' }) });
    await expect(specs.service.create({ key: 'key-0123456789abcdef', sessionId: 'sess-1', dto: command }))
      .rejects.toMatchObject({ response: { code: 'OUT_OF_STOCK' } });
    expect(specs.reserve).toHaveBeenCalledTimes(1);
  });

  it('retries a colliding order code with a fresh code instead of failing', async () => {
    const collision = Object.assign(new Error('Unique violation'), { code: 'P2002', meta: { target: ['orders_code_key'] } });
    const specs = harness({ createError: collision });
    const result = await specs.service.create({ key: 'key-0123456789abcdef', sessionId: 'sess-1', dto: command });
    expect(result.order.code).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);
    expect(specs.tx.order.create).toHaveBeenCalledTimes(2); // first attempt hit the unique code
    expect(specs.commands).toHaveLength(1); // only the second attempt committed
  });

  it('verifies quote expiry against clock_timestamp and locks rows for a consistent read', async () => {
    const specs = harness();
    await specs.service.create({ key: 'key-0123456789abcdef', sessionId: 'sess-1', dto: command });
    // Template tags receive the static strings array: join all parts to see the full SQL.
    const queries = specs.tx.$queryRaw.mock.calls.map((call) => Array.isArray(call[0]) ? call[0].join('') : String(call[0]));
    expect(queries.some((text) => text.includes('clock_timestamp()'))).toBe(true);
    expect(queries.some((text) => text.includes('now()') && !text.includes('clock_timestamp()'))).toBe(false);
    expect(queries.filter((text) => text.includes('FOR UPDATE')).length).toBeGreaterThanOrEqual(1);
    expect(queries.some((text) => text.includes('FOR SHARE') && text.includes('shop_settings'))).toBe(true);
  });

  it('re-checks expiry after the reserve so lock waits cannot smuggle an expired quote', async () => {
    const specs = harness();
    // The first clock_timestamp read happens inside the main verification (still valid); the second
    // runs after the reserve — by then the quote has expired and everything must roll back.
    let clockCalls = 0;
    specs.tx.$queryRaw.mockImplementation(async (query: readonly string[]) => {
      const text = Array.isArray(query[0]) ? query[0].join('') : String(query[0]);
      if (text.includes('clock_timestamp()')) {
        clockCalls += 1;
        return [{ now: new Date(serverNow.getTime() + (clockCalls === 1 ? 0 : 16 * 60000)) }];
      }
      if (text.includes('pg_advisory')) return [{ locked: true }];
      return [];
    });
    await expect(specs.service.create({ key: 'key-0123456789abcdef', sessionId: 'sess-1', dto: command }))
      .rejects.toMatchObject({ response: { code: 'QUOTE_CHANGED' } });
    expect(specs.reserve).toHaveBeenCalledTimes(1); // reserve ran, then the re-check rolled everything back
  });

  it('requires a well-formed idempotency key and treats empty carts as invalid', async () => {
    const specs = harness();
    await expect(specs.service.create({ key: 'short', sessionId: 's', dto: command })).rejects.toBeInstanceOf(BadRequestException);
    await expect(specs.service.create({ key: 'key-0123456789abcdef', sessionId: 's',
      dto: { ...command, items: [] } })).rejects.toBeInstanceOf(BadRequestException);
  });
});

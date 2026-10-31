import { BadRequestException, ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { SettingsService } from '../settings/settings.service.js';
import { CheckoutService } from './checkout.service.js';

const variantA = '17bfecab-9df4-4de4-bd91-3c11116fca5b';
const variantB = '98d3a8f8-8ac2-4a54-b9e4-34d3fcb8816f';
const serverNow = new Date('2026-10-30T10:00:00.000Z');

interface VariantRow {
  id: string; sku: string; size: string; color: string; price: number; active: boolean;
  inventory: { onHand: number; reserved: number } | null;
  product: { name: string; status: string; category: { active: boolean } };
}

const sellable = (id: string, price: number, onHand = 10, overrides: Partial<VariantRow> = {}): VariantRow => ({
  id, sku: `SKU-${id.slice(0, 4)}`, size: 'M', color: 'đen', price, active: true,
  inventory: { onHand, reserved: 0 },
  product: { name: `Áo ${id.slice(0, 4)}`, status: 'PUBLISHED', category: { active: true } },
  ...overrides,
});

interface Harness {
  service: CheckoutService;
  tx: { variant: { findMany: ReturnType<typeof vi.fn> }; checkoutQuote: { create: ReturnType<typeof vi.fn> };
    $queryRaw: ReturnType<typeof vi.fn> };
  settings: { currentInTx: ReturnType<typeof vi.fn> };
  isolation: { level?: string };
}

function harness(rows: VariantRow[], config = { shippingFeeVnd: 30000, bankDeadlineMinutes: 120, version: 3 }): Harness {
  const tx = {
    variant: { findMany: vi.fn(async () => rows) },
    checkoutQuote: { create: vi.fn(async ({ data }: { data: object }) => ({ id: 'quote-1', createdAt: serverNow, ...data })) },
    $queryRaw: vi.fn(async () => [{ now: serverNow }]),
  };
  const isolation: { level?: string } = {};
  const db = { $transaction: vi.fn(async (work: (client: typeof tx) => Promise<unknown>, options?: { isolationLevel?: string }) => {
    isolation.level = options?.isolationLevel;
    return work(tx);
  }) };
  const settings = { currentInTx: vi.fn(async () => config) };
  const service = new CheckoutService(db as unknown as PrismaService, settings as unknown as SettingsService);
  return { service, tx, settings, isolation };
}

describe('CheckoutService quote', () => {
  it('prices the agreed example from server data: 2×200.000 + 1×300.000 + 30.000 = 730.000', async () => {
    const { service, tx, isolation } = harness([sellable(variantA, 200000, 5), sellable(variantB, 300000, 3)]);
    const view = await service.quote({ method: 'COD', items: [
      { variantId: variantA.toUpperCase(), quantity: 2 }, { variantId: variantB, quantity: 1 }] });
    expect(view).toMatchObject({ method: 'COD', currency: 'VND', subtotal: 700000, shippingFee: 30000, total: 730000,
      settingsVersion: 3, serverNow: serverNow.toISOString(), expiresAt: new Date(serverNow.getTime() + 15 * 60000).toISOString() });
    expect(view.items).toHaveLength(2);
    expect(view.items[0]).toMatchObject({ variantId: variantA, productName: `Áo ${variantA.slice(0, 4)}`,
      unitPriceVnd: 200000, quantity: 2, lineTotalVnd: 400000 });
    expect(tx.checkoutQuote.create).toHaveBeenCalledTimes(1);
    expect(tx.checkoutQuote.create.mock.calls[0]?.[0]?.data).toMatchObject({ method: 'COD', subtotalVnd: 700000,
      shippingFeeVnd: 30000, totalVnd: 730000, settingsVersion: 3 });
    expect(isolation.level).toBe('RepeatableRead');
  });

  it('merges duplicate variants case-insensitively before judging the limits', async () => {
    const { service, tx } = harness([sellable(variantA, 200000, 99)]);
    const view = await service.quote({ method: 'COD', items: [
      { variantId: variantA.toUpperCase(), quantity: 40 }, { variantId: variantA, quantity: 59 }] });
    expect(view.items).toHaveLength(1);
    expect(view.items[0]?.quantity).toBe(99);
    expect(tx.variant.findMany).toHaveBeenCalledTimes(1);
  });

  it('rejects empty carts, per-variant overflow after merging and over-long carts', async () => {
    const { service, tx } = harness([sellable(variantA, 200000)]);
    await expect(service.quote({ method: 'COD', items: [] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.quote({ method: 'COD', items: [
      { variantId: variantA, quantity: 99 }, { variantId: variantA, quantity: 1 }] })).rejects.toThrow(/99 chiếc/);
    const lines = Array.from({ length: 51 }, () => ({ variantId: randomUUID(), quantity: 1 }));
    await expect(service.quote({ method: 'COD', items: lines })).rejects.toThrow(/50 dòng/);
    expect(tx.variant.findMany).not.toHaveBeenCalled();
  });

  it('rejects totals above 1.000.000.000 VND without rounding anything', async () => {
    const { service } = harness([sellable(variantA, 100000000, 99)]);
    await expect(service.quote({ method: 'COD', items: [{ variantId: variantA, quantity: 11 }] }))
      .rejects.toThrow(/1\.000\.000\.000/);
  });

  it.each([
    ['draft product', sellable(variantA, 200000, 5, { product: { name: 'Áo ẩn', status: 'DRAFT', category: { active: true } } })],
    ['inactive variant', sellable(variantA, 200000, 5, { active: false })],
    ['inactive category', sellable(variantA, 200000, 5, { product: { name: 'Áo ẩn', status: 'PUBLISHED', category: { active: false } } })],
    ['unknown id', undefined],
  ])('refuses %s with ITEM_UNAVAILABLE and only the client id', async (_label, row) => {
    const rows = row ? [row] : [] as VariantRow[];
    const { service } = harness(rows);
    const error = await service.quote({ method: 'COD', items: [{ variantId: variantA, quantity: 1 }] })
      .catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({ code: 'ITEM_UNAVAILABLE',
      fieldErrors: [{ field: 'items.variantId', message: variantA }] });
    expect(JSON.stringify((error as ConflictException).getResponse())).not.toContain('Áo');
  });

  it('refuses quantities above available stock with OUT_OF_STOCK', async () => {
    const { service } = harness([sellable(variantA, 200000, 2)]);
    const error = await service.quote({ method: 'COD', items: [{ variantId: variantA, quantity: 3 }] })
      .catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({ code: 'OUT_OF_STOCK',
      fieldErrors: [{ field: 'items.variantId', message: variantA }] });
  });

  it('keeps stock out of the transaction path: reads variants, writes only the quote row', async () => {
    const { service, tx } = harness([sellable(variantA, 200000, 5)]);
    await service.quote({ method: 'COD', items: [{ variantId: variantA, quantity: 1 }] });
    // The fake transaction carries no inventory/order clients at all: any attempt to reserve or
    // adjust stock would crash on an undefined property and fail this test.
    expect(tx.checkoutQuote.create).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects BANK explicitly instead of coercing to COD', async () => {
    const { service, tx } = harness([sellable(variantA, 200000, 5)]);
    await expect(service.quote({ method: 'BANK', items: [{ variantId: variantA, quantity: 1 }] } as never))
      .rejects.toThrow(/COD/);
    expect(tx.checkoutQuote.create).not.toHaveBeenCalled();
  });

  it('propagates a mid-transaction failure so nothing incomplete is stored', async () => {
    const { service, tx } = harness([sellable(variantA, 200000, 5)]);
    tx.checkoutQuote.create.mockRejectedValueOnce(new Error('db gone'));
    await expect(service.quote({ method: 'COD', items: [{ variantId: variantA, quantity: 1 }] }))
      .rejects.toThrow('db gone');
  });
});

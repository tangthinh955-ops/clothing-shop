import { describe, expect, it } from 'vitest';
import type { CreateOrderBody } from './orders.api';
import { parseOrderConfirmation } from './orders.api';

const variantA = '17bfecab-9df4-4de4-bd91-3c11116fca5b';
const variantB = '98d3a8f8-8ac2-4a54-b9e4-34d3fcb8816f';

const command: CreateOrderBody = {
  quoteId: 'c1a2b3d4-0000-4000-8000-000000000001',
  items: [{ variantId: variantA, quantity: 2 }, { variantId: variantB, quantity: 1 }],
  contact: { name: 'Nguyễn Thử', phone: '0901234567' },
  address: { province: 'TP. Hồ Chí Minh', ward: 'Phường Bến Nghé', addressLine: '12 Nguyễn Huệ' },
  method: 'COD',
};

const okResponse = (overrides: Record<string, unknown> = {}) => ({
  order: {
    code: 'AB23456789CD', status: 'PENDING', method: 'COD', currency: 'VND',
    items: [
      { variantId: variantA, productName: 'Áo cotton', sku: 'AO-A', size: 'M', color: 'đen',
        unitPriceVnd: 200000, quantity: 2, lineTotalVnd: 400000 },
      { variantId: variantB, productName: 'Quần jean', sku: 'JEAN-B', size: 'L', color: 'xanh',
        unitPriceVnd: 300000, quantity: 1, lineTotalVnd: 300000 },
    ],
    subtotal: 700000, shippingFee: 30000, total: 730000,
  },
  lookupToken: 'a'.repeat(32),
  ...overrides,
});

describe('parseOrderConfirmation (m4.3.1 review fix 7)', () => {
  it('accepts a well-formed confirmation that matches the command', () => {
    expect(parseOrderConfirmation(okResponse(), command).order.total).toBe(730000);
  });

  it('rejects duplicate variant rows, out-of-range quantities and negative or oversized money', () => {
    const duplicate = okResponse();
    (duplicate.order.items[1] as { variantId: string }).variantId = variantA;
    expect(() => parseOrderConfirmation(duplicate, command)).toThrow(/INVALID_RESPONSE|Chưa đọc/);
    expect(() => parseOrderConfirmation(okResponse({
      order: { ...(okResponse().order as Record<string, unknown>), items: [
        { ...okResponse().order.items[0], quantity: 100, lineTotalVnd: 200000 * 100 },
        okResponse().order.items[1]!] } }), command)).toThrow();
    const negativeFee = okResponse({ order: { ...(okResponse().order as Record<string, unknown>), shippingFeeVnd: -1 } });
    expect(() => parseOrderConfirmation({ ...negativeFee, order: {
      ...(negativeFee.order as Record<string, unknown>), shippingFee: -1,
      total: (negativeFee.order as { subtotal: number }).subtotal - 1 } })).toThrow();
    const oversized = okResponse({ order: { ...(okResponse().order as Record<string, unknown>),
      subtotal: 1000000001, shippingFee: 0, total: 1000000001 } });
    expect(() => parseOrderConfirmation(oversized, command)).toThrow();
  });

  it('rejects totals that do not add up from the echoed lines', () => {
    const wrongTotal = okResponse({ order: { ...(okResponse().order as Record<string, unknown>), total: 999999 } });
    expect(() => parseOrderConfirmation(wrongTotal, command)).toThrow();
    const wrongLine = okResponse({ order: { ...(okResponse().order as Record<string, unknown>),
      items: [{ ...okResponse().order.items[0], lineTotalVnd: 999999 }, okResponse().order.items[1]!] } });
    expect(() => parseOrderConfirmation(wrongLine, command)).toThrow();
  });

  it('rejects a confirmation whose lines differ from the command that was sent', () => {
    // A self-consistent single-line confirmation (its own totals add up) that differs from the
    // two-line command: only the command comparison can catch this.
    const mismatched = okResponse({ order: { ...(okResponse().order as Record<string, unknown>),
      items: [{ ...okResponse().order.items[0], quantity: 3, lineTotalVnd: 600000 }],
      subtotal: 600000, total: 630000 } });
    expect(() => parseOrderConfirmation(mismatched, command)).toThrow();
    // Without the command reference the parser still validates the shape.
    expect(parseOrderConfirmation(mismatched).order.total).toBe(630000);
  });
});

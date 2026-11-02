import { describe, expect, it } from 'vitest';
import { parseOrderDetailView, parseOrderLookupResult, type OrderDetailResult } from './orders.api';

// M4.4.1 runtime contract: the guest order view is untrusted until parsed; anything malformed or
// out of bounds never renders as an order view.

const token = 'A'.repeat(32); // token never enters the parser — it only rides the request header.

const recipient = {
  name: 'Nguyễn Thử Đơn A', phone: '0901230001', email: 'viewer-a@example.test',
  province: 'TP. Hồ Chí Minh', district: '', ward: 'Phường Bến Nghé', addressLine: '12 Nguyễn Huệ',
  note: 'Giao giờ hành chính',
};

const view = (): OrderDetailResult => ({
  order: {
    code: 'ABCDUVWXYZ2', status: 'CONFIRMED', method: 'COD', currency: 'VND',
    createdAt: '2026-10-31T03:30:00.000Z',
    items: [{ variantId: '17bfecab-9df4-4de4-bd91-3c11116fca5b', productName: 'Áo xem chi tiết', sku: 'ACC-A',
      size: 'M', color: 'Đen', unitPriceVnd: 400000, quantity: 1, lineTotalVnd: 400000 }],
    subtotal: 400000, shippingFee: 30000, total: 430000, recipient, trackingNumber: null, deliveredAt: null,
  },
  timeline: [
    { fromStatus: null, toStatus: 'PENDING', actorLabel: 'Khách đặt hàng', reason: null, version: 0,
      at: '2026-10-31T03:30:00.000Z' },
    { fromStatus: 'PENDING', toStatus: 'CONFIRMED', actorLabel: 'Cửa hàng', reason: 'Xác nhận qua điện thoại',
      version: 1, at: '2026-10-31T03:31:00.000Z' },
  ],
});

describe('parseOrderDetailView', () => {
  it('accepts an exactly-shaped server view and keeps every customer-visible field', () => {
    const parsed = parseOrderDetailView(view());
    expect(parsed).toEqual(view());
  });

  it('keeps a real delivery time and refuses anything else', () => {
    const withDelivery = (deliveredAt: unknown) => ({ ...view(), order: { ...view().order, deliveredAt } });
    expect(parseOrderDetailView(withDelivery('2026-11-01T03:00:00.000Z')).order.deliveredAt).toBe('2026-11-01T03:00:00.000Z');
    expect(() => parseOrderDetailView(withDelivery('hôm qua'))).toThrow();
    expect(() => parseOrderDetailView(withDelivery(42))).toThrow();
    expect(() => parseOrderDetailView(withDelivery(undefined))).toThrow();
  });

  it('keeps a tracking number up to the column limit and refuses anything else', () => {
    const withTracking = (trackingNumber: unknown) => ({ ...view(), order: { ...view().order, trackingNumber } });
    expect(parseOrderDetailView(withTracking('GHN-123.ABC_9')).order.trackingNumber).toBe('GHN-123.ABC_9');
    expect(parseOrderDetailView(withTracking('T'.repeat(100))).order.trackingNumber).toBe('T'.repeat(100));
    expect(() => parseOrderDetailView(withTracking('T'.repeat(101)))).toThrow();
    expect(() => parseOrderDetailView(withTracking(42))).toThrow();
    expect(() => parseOrderDetailView(withTracking(undefined))).toThrow();
  });

  it('accepts null email and note and a single-entry timeline', () => {
    const source = view();
    source.order.recipient = { ...recipient, email: null, note: null };
    source.timeline = [source.timeline[0]!];
    expect(parseOrderDetailView(source).order.recipient).toMatchObject({ email: null, note: null });
    expect(parseOrderDetailView(source).timeline).toHaveLength(1);
  });

  it('rejects a non-object root and a view without a timeline', () => {
    expect(() => parseOrderDetailView(undefined)).toThrow();
    expect(() => parseOrderDetailView('nope')).toThrow();
    const missingTimeline = { order: view().order };
    expect(() => parseOrderDetailView(missingTimeline)).toThrow();
  });

  it('rejects bad fields: unknown status, wrong method or currency', () => {
    expect(() => parseOrderDetailView(view())).not.toThrow();
    expect(() => parseOrderDetailView({ ...view(), order: { ...view().order, status: 'PAID' } })).toThrow();
    expect(() => parseOrderDetailView({ ...view(), order: { ...view().order, method: 'BANK' } })).toThrow();
    expect(() => parseOrderDetailView({ ...view(), order: { ...view().order, currency: 'USD' } })).toThrow();
  });

  it('rejects money that no longer adds up or overflows the business bounds', () => {
    expect(() => parseOrderDetailView({ ...view(), order: { ...view().order, total: 999999 } })).toThrow();
    expect(() => parseOrderDetailView({ ...view(), order: { ...view().order, subtotal: 5, total: 430000 } })).toThrow();
    expect(() => parseOrderDetailView({ ...view(),
      order: { ...view().order, items: [{ ...view().order.items[0]!, lineTotalVnd: 7 }] } })).toThrow();
  });

  it('rejects a timeline whose versions are not strictly increasing', () => {
    const stale = { ...view(), timeline: [view().timeline[1]!, view().timeline[0]!] };
    expect(() => parseOrderDetailView(stale)).toThrow();
  });

  it('rejects name fields that lost their type', () => {
    expect(() => parseOrderDetailView({ ...view(),
      order: { ...view().order, recipient: { ...recipient, name: 42 } } })).toThrow();
  });

  // Backend schema: orders.note VARCHAR(500), order_status_history.reason VARCHAR(500),
  // orders.email VARCHAR(254) — each field is checked against its own real limit.
  it('accepts note and reason up to 500 characters and keeps email capped at 254', () => {
    // note boundary sweep: 254/255 must pass (the old shared 254 rule wrongly rejected 255+)
    for (const length of [254, 255, 500]) {
      const parsed = parseOrderDetailView({ ...view(),
        order: { ...view().order, recipient: { ...view().order.recipient, note: 'N'.repeat(length) } } });
      expect(parsed.order.recipient.note).toHaveLength(length);
    }
    expect(() => parseOrderDetailView({ ...view(),
      order: { ...view().order, recipient: { ...view().order.recipient, note: 'N'.repeat(501) } } })).toThrow();

    // timeline reason picks up the same 500-character limit
    const reasonOk = { ...view(), timeline: [view().timeline[0]!, { ...view().timeline[1]!, reason: 'R'.repeat(500) }] };
    expect(parseOrderDetailView(reasonOk).timeline).toMatchObject([expect.anything(), { reason: 'R'.repeat(500) }]);
    expect(() => parseOrderDetailView({ ...view(),
      timeline: [view().timeline[0]!, { ...view().timeline[1]!, reason: 'R'.repeat(501) }] })).toThrow();

    // email keeps its tighter 254-character limit
    expect(parseOrderDetailView({ ...view(),
      order: { ...view().order, recipient: { ...view().order.recipient, email: 'e'.repeat(254) } } })
      .order.recipient.email).toHaveLength(254);
    expect(() => parseOrderDetailView({ ...view(),
      order: { ...view().order, recipient: { ...view().order.recipient, email: 'e'.repeat(255) } } })).toThrow();
  });
});

describe('parseOrderLookupResult (M4.4.2)', () => {
  const CODE = 'ABCDUVWXYZ2';
  const wire = () => ({ ...view(), lookupToken: 'T'.repeat(32) }); // 192-bit base64url token

  it('keeps the allowlisted view and the fresh token of a well-formed lookup answer', () => {
    const parsed = parseOrderLookupResult(wire(), CODE);
    expect(parsed.view).toEqual(view());
    expect(parsed.lookupToken).toBe('T'.repeat(32));
  });

  it('refuses to navigate on a missing, short or non-string token', () => {
    expect(() => parseOrderLookupResult(view(), CODE)).toThrow(); // token missing entirely
    expect(() => parseOrderLookupResult({ ...view(), lookupToken: 'short' }, CODE)).toThrow();
    expect(() => parseOrderLookupResult({ ...view(), lookupToken: 42 }, CODE)).toThrow();
  });

  it('binds the answer to the requested order code, foreign or punctuated alike', () => {
    expect(() => parseOrderLookupResult(wire(), 'MNPQRSTUV34')).toThrow(); // a different order's code
    expect(() => parseOrderLookupResult({ ...wire(), order: { ...view().order, code: 'A?x=1' } }, CODE))
      .toThrow(); // query-string-looking code must never pass the binding
    expect(() => parseOrderLookupResult({ ...wire(), order: { ...view().order, code: 'ABCDUVWXYZ2 ' } }, CODE))
      .toThrow(); // untrimmed echo does not match the normalized request
  });

  it('collapses a malformed view part into the error state instead of an order view', () => {
    expect(() => parseOrderLookupResult({ unexpected: 'shape' }, CODE)).toThrow();
    expect(() => parseOrderLookupResult({ ...view(), order: { ...view().order, total: 1 } }, CODE)).toThrow();
  });
});

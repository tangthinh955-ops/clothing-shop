import { ApiError, request } from '../../../shared/api/client';

// Wire shape of GET /api/v1/orders/:code + X-Order-Token — m4-contract §5 "Xem đơn" (M4.4.1).
// The response is untrusted until parseOrderDetailView has checked it; a malformed payload never
// renders as an order view.

export interface OrderDetailItem {
  variantId: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  unitPriceVnd: number;
  quantity: number;
  lineTotalVnd: number;
}

export interface OrderDetailRecipient {
  name: string;
  phone: string;
  email: string | null;
  province: string;
  district: string;
  ward: string;
  addressLine: string;
  note: string | null;
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PACKING' | 'SHIPPED' | 'DELIVERED'
  | 'CANCELLED' | 'DELIVERY_FAILED' | 'RETURNED_TO_SHOP';

export interface OrderDetailView {
  code: string;
  status: OrderStatus;
  method: 'COD';
  currency: 'VND';
  createdAt: string;
  items: OrderDetailItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
  recipient: OrderDetailRecipient;
}

export interface OrderDetailTimelineEntry {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorLabel: string;
  reason: string | null;
  version: number;
  at: string;
}

export interface OrderDetailResult {
  order: OrderDetailView;
  timeline: OrderDetailTimelineEntry[];
}

const STATUSES: readonly string[] = ['PENDING', 'CONFIRMED', 'PACKING', 'SHIPPED', 'DELIVERED',
  'CANCELLED', 'DELIVERY_FAILED', 'RETURNED_TO_SHOP'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && Number.isSafeInteger(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 500;
// Schema limits differ per field (orders.email VARCHAR(254), orders.note and
// order_status_history.reason VARCHAR(500)) — one shared 254 bound would wrongly reject a legal note.
const nullableText = (value: unknown, max: number): value is string | null =>
  typeof value === 'string' ? value.length <= max : value === null;
const iso = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));

// Business money/quantity bounds mirrored from the server checks (m4-contract §5, order CHECKs).
const MAX_UNIT_VND = 100_000_000;
const MAX_TOTAL_VND = 1_000_000_000;
const MAX_FEE_VND = 100_000_000;

function malformed(): ApiError {
  return new ApiError('INVALID_RESPONSE', 'Chưa đọc được thông tin đơn hàng. Vui lòng thử lại.', 200);
}

/** Strict runtime read of the guest order view; everything here is what the customer is shown. */
export function parseOrderDetailView(value: unknown): OrderDetailResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw malformed();
  const root = value as Record<string, unknown>;
  if (typeof root['order'] !== 'object' || root['order'] === null || Array.isArray(root['order'])) throw malformed();
  const order = root['order'] as Record<string, unknown>;
  if (!Array.isArray(root['timeline']) || root['timeline'].length === 0) throw malformed();

  if (!Array.isArray(order['items']) || order['items'].length === 0 || order['items'].length > 50) throw malformed();
  const items: OrderDetailItem[] = [];
  let subtotal = 0;
  const seenVariants = new Set<string>();
  for (const entry of order['items']) {
    if (typeof entry !== 'object' || entry === null) throw malformed();
    const item = entry as Record<string, unknown>;
    if (typeof item['variantId'] !== 'string' || !UUID_PATTERN.test(item['variantId'])
      || !text(item['productName']) || typeof item['sku'] !== 'string' || typeof item['size'] !== 'string'
      || typeof item['color'] !== 'string'
      || !integer(item['unitPriceVnd']) || (item['unitPriceVnd'] as number) < 1 || (item['unitPriceVnd'] as number) > MAX_UNIT_VND
      || !integer(item['quantity']) || (item['quantity'] as number) < 1 || (item['quantity'] as number) > 99
      || !integer(item['lineTotalVnd']) || (item['lineTotalVnd'] as number) !== (item['unitPriceVnd'] as number) * (item['quantity'] as number)) {
      throw malformed();
    }
    if (seenVariants.has(item['variantId'])) throw malformed(); // one row per variant, like the cart
    seenVariants.add(item['variantId']);
    subtotal += item['lineTotalVnd'] as number;
    items.push({ variantId: item['variantId'], productName: item['productName'], sku: item['sku'],
      size: item['size'], color: item['color'], unitPriceVnd: item['unitPriceVnd'],
      quantity: item['quantity'], lineTotalVnd: item['lineTotalVnd'] });
  }
  if (typeof order['code'] !== 'string' || order['code'].length === 0 || order['code'].length > 24
    || typeof order['status'] !== 'string' || !STATUSES.includes(order['status'])
    || order['method'] !== 'COD' || order['currency'] !== 'VND'
    || !iso(order['createdAt'])
    || !integer(order['subtotal']) || (order['subtotal'] as number) !== subtotal || (order['subtotal'] as number) > MAX_TOTAL_VND
    || !integer(order['shippingFee']) || (order['shippingFee'] as number) < 0 || (order['shippingFee'] as number) > MAX_FEE_VND
    || !integer(order['total']) || (order['total'] as number) !== (order['subtotal'] as number) + (order['shippingFee'] as number)
    || (order['total'] as number) > MAX_TOTAL_VND) {
    throw malformed();
  }
  if (typeof order['recipient'] !== 'object' || order['recipient'] === null || Array.isArray(order['recipient']))
    throw malformed();
  const recipientRow = order['recipient'] as Record<string, unknown>;
  if (!text(recipientRow['name']) || !text(recipientRow['phone'])
    || !nullableText(recipientRow['email'], 254) || typeof recipientRow['district'] !== 'string'
    || !text(recipientRow['province']) || !text(recipientRow['ward']) || !text(recipientRow['addressLine'])
    || !nullableText(recipientRow['note'], 500)) {
    throw malformed();
  }
  const timeline: OrderDetailTimelineEntry[] = [];
  let lastVersion = -1;
  for (const entry of root['timeline']) {
    if (typeof entry !== 'object' || entry === null) throw malformed();
    const row = entry as Record<string, unknown>;
    const toStatus = row['toStatus'];
    const fromStatus = row['fromStatus'];
    if (typeof toStatus !== 'string' || !STATUSES.includes(toStatus)
      || !(fromStatus === null || typeof fromStatus === 'string' && STATUSES.includes(fromStatus))
      || !text(row['actorLabel']) || !nullableText(row['reason'], 500)
      || !integer(row['version']) || (row['version'] as number) <= lastVersion || (row['version'] as number) > 9999
      || !iso(row['at'])) {
      throw malformed();
    }
    lastVersion = row['version'] as number;
    timeline.push({ fromStatus: fromStatus as OrderStatus | null, toStatus: toStatus as OrderStatus,
      actorLabel: row['actorLabel'] as string, reason: row['reason'] as string | null,
      version: row['version'] as number, at: row['at'] as string });
  }
  return {
    order: {
      code: order['code'] as string, status: order['status'] as OrderStatus, method: 'COD', currency: 'VND',
      createdAt: order['createdAt'] as string, items,
      subtotal: order['subtotal'] as number, shippingFee: order['shippingFee'] as number, total: order['total'] as number,
      recipient: { name: recipientRow['name'] as string, phone: recipientRow['phone'] as string,
        email: recipientRow['email'] as string | null, province: recipientRow['province'] as string,
        district: recipientRow['district'] as string, ward: recipientRow['ward'] as string,
        addressLine: recipientRow['addressLine'] as string, note: recipientRow['note'] as string | null },
    },
    timeline,
  };
}

export interface OrderLookupResult {
  view: OrderDetailResult;
  /** Plaintext token of this lookup only; it must travel in the navigation fragment, nowhere else. */
  lookupToken: string;
}

const LOOKUP_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/; // mirrors the server token envelope

function lookupMalformed(): ApiError {
  return new ApiError('INVALID_RESPONSE', 'Chưa đọc được kết quả tra cứu. Vui lòng thử lại.', 200);
}

/** Strict runtime read of the lookup answer: the allowlisted view must echo the requested code and
 * carry exactly one fresh token — anything else collapses into INVALID_RESPONSE, never navigation. */
export function parseOrderLookupResult(value: unknown, expectedCode: string): OrderLookupResult {
  let view: OrderDetailResult;
  try {
    view = parseOrderDetailView(value);
  } catch {
    throw lookupMalformed(); // one lookup-specific message, whatever part of the payload broke
  }
  const token = (value as Record<string, unknown>)['lookupToken'];
  if (typeof token !== 'string' || !LOOKUP_TOKEN_PATTERN.test(token) || view.order.code !== expectedCode) {
    throw lookupMalformed();
  }
  return { view, lookupToken: token };
}

export const ordersApi = {
  /** Read-only view; the lookup token rides the X-Order-Token header and never the URL. */
  view: async (code: string, token: string): Promise<OrderDetailResult> =>
    parseOrderDetailView(await request<unknown>(`/orders/${encodeURIComponent(code)}`, { orderToken: token })),
  /** M4.4.2 lookup: code+phone trade for the allowlisted view plus a fresh 192-bit token. The code
   * is normalized once here (trim + uppercase — the backend DTO rule) and the answer is bound to
   * it; the phone passes through untouched for the server's single normalization. */
  lookup: async (body: { code: string; phone: string }): Promise<OrderLookupResult> => {
    const code = body.code.trim().toUpperCase();
    return parseOrderLookupResult(
      await request<unknown>('/orders/lookup', { method: 'POST', body: { code, phone: body.phone } }), code);
  },
};

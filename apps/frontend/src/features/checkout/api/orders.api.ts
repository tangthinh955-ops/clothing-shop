import { ApiError, request } from '../../../shared/api/client';
import { VARIANT_ID_PATTERN } from '../../cart/cart-store';
import type { QuoteItem } from './checkout.api';

// Wire shape of POST /api/v1/orders — m4-contract §5 Create. The body is untrusted until
// parseOrderConfirmation has checked it; a malformed payload never renders as a confirmed order.
export interface CreateOrderBody {
  quoteId: string;
  items: Array<{ variantId: string; quantity: number }>;
  contact: { name: string; phone: string; email?: string | undefined };
  address: { province: string; district?: string | undefined; ward: string; addressLine: string };
  note?: string | undefined;
  method: 'COD';
}

export interface OrderLine {
  variantId: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  unitPriceVnd: number;
  quantity: number;
  lineTotalVnd: number;
}

export interface OrderConfirmation {
  code: string;
  status: 'PENDING';
  method: 'COD';
  currency: 'VND';
  items: OrderLine[];
  subtotal: number;
  shippingFee: number;
  total: number;
}

export interface CreateOrderResult {
  order: OrderConfirmation;
  /** Plaintext lookup token, present only on the first committed create (never on a replay). */
  lookupToken?: string | undefined;
  replay?: boolean;
}

const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && Number.isSafeInteger(value);

function malformed(): ApiError {
  return new ApiError('INVALID_RESPONSE', 'Chưa đọc được kết quả đặt hàng. Vui lòng gửi lại.', 201);
}

// Business money/quantity bounds (business-rules + orders table CHECKs) the confirmation must obey.
const MAX_UNIT_VND = 100_000_000;
const MAX_TOTAL_VND = 1_000_000_000;
const MAX_FEE_VND = 100_000_000;
const MAX_QUANTITY = 99;

export function parseOrderConfirmation(value: unknown, command?: CreateOrderBody | undefined): CreateOrderResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw malformed();
  const row = value as Record<string, unknown>;
  const order = row['order'];
  if (typeof order !== 'object' || order === null || Array.isArray(order)) throw malformed();
  const view = order as Record<string, unknown>;
  const rows = view['items'];
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 50) throw malformed();
  const items: OrderLine[] = [];
  const seenVariants = new Set<string>();
  let subtotal = 0;
  for (const entry of rows) {
    if (typeof entry !== 'object' || entry === null) throw malformed();
    const item = entry as Record<string, unknown>;
    if (typeof item['variantId'] !== 'string' || !VARIANT_ID_PATTERN.test(item['variantId'])
      || typeof item['productName'] !== 'string' || typeof item['sku'] !== 'string'
      || typeof item['size'] !== 'string' || typeof item['color'] !== 'string'
      || !integer(item['unitPriceVnd']) || (item['unitPriceVnd'] as number) < 1 || (item['unitPriceVnd'] as number) > MAX_UNIT_VND
      || !integer(item['quantity']) || (item['quantity'] as number) < 1 || (item['quantity'] as number) > MAX_QUANTITY
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
  if (typeof view['code'] !== 'string' || view['code'].length === 0
    || view['status'] !== 'PENDING' || view['method'] !== 'COD' || view['currency'] !== 'VND'
    || !integer(view['subtotal']) || (view['subtotal'] as number) !== subtotal || (view['subtotal'] as number) > MAX_TOTAL_VND
    || !integer(view['shippingFee']) || (view['shippingFee'] as number) < 0 || (view['shippingFee'] as number) > MAX_FEE_VND
    || !integer(view['total']) || (view['total'] as number) !== (view['subtotal'] as number) + (view['shippingFee'] as number)
    || (view['total'] as number) > MAX_TOTAL_VND) {
    throw malformed();
  }
  // The confirmation must echo exactly the command the shopper sent (same lines, same quantities).
  if (command) {
    const expected = [...command.items]
      .map((line) => ({ variantId: line.variantId, quantity: line.quantity }))
      .sort((left, right) => (left.variantId < right.variantId ? -1 : 1));
    const actual = items.map((item) => ({ variantId: item.variantId, quantity: item.quantity }))
      .sort((left, right) => (left.variantId < right.variantId ? -1 : 1));
    if (JSON.stringify(expected) !== JSON.stringify(actual)) throw malformed();
  }
  const token = row['lookupToken'];
  if (token !== undefined && typeof token !== 'string') throw malformed();
  return {
    order: { code: view['code'], status: 'PENDING', method: 'COD', currency: 'VND', items,
      subtotal: view['subtotal'], shippingFee: view['shippingFee'], total: view['total'] },
    lookupToken: token as string | undefined,
    replay: row['replay'] === true,
  };
}

export const ordersApi = {
  /** Exactly one call per intent: the key is generated once and kept for replays (m4-contract §7). */
  create: async (key: string, body: CreateOrderBody): Promise<CreateOrderResult> =>
    parseOrderConfirmation(await request<unknown>('/orders', { method: 'POST', body, idempotencyKey: key }), body),
};

/** True when the failure is definite (the server answered and nothing committed as a new order). */
export function isDefiniteOrderError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.status >= 400 && error.status < 500
    && ['VALIDATION_ERROR', 'QUOTE_CHANGED', 'OUT_OF_STOCK', 'ITEM_UNAVAILABLE', 'CONFLICT', 'RATE_LIMITED'].includes(error.code);
}

export type { QuoteItem };

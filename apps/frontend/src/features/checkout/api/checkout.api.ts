import { ApiError, request } from '../../../shared/api/client';
import { VARIANT_ID_PATTERN } from '../../cart/cart-store';

// Wire shape of POST /api/v1/checkout/quote — m4-contract §5. The response body is untrusted until
// parseCheckoutQuote has checked it entry by entry; a malformed payload never renders as a quote.
export interface QuoteItem {
  variantId: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  unitPriceVnd: number;
  quantity: number;
  lineTotalVnd: number;
}

export interface CheckoutQuote {
  quoteId: string;
  method: 'COD';
  currency: 'VND';
  items: QuoteItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
  settingsVersion: number;
  serverNow: string;
  expiresAt: string;
}

const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && Number.isSafeInteger(value);
const isoText = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));

function malformed(): ApiError {
  return new ApiError('INVALID_RESPONSE', 'Chưa đọc được báo giá. Vui lòng thử lại.', 200);
}

export function parseCheckoutQuote(value: unknown): CheckoutQuote {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw malformed();
  const row = value as Record<string, unknown>;
  const rows = row['items'];
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 50) throw malformed();
  const items: QuoteItem[] = [];
  let subtotal = 0;
  for (const entry of rows) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) throw malformed();
    const item = entry as Record<string, unknown>;
    if (typeof item['variantId'] !== 'string' || !VARIANT_ID_PATTERN.test(item['variantId'])
      || typeof item['productName'] !== 'string' || typeof item['sku'] !== 'string'
      || typeof item['size'] !== 'string' || typeof item['color'] !== 'string'
      || !integer(item['unitPriceVnd']) || (item['unitPriceVnd'] as number) < 1
      || !integer(item['quantity']) || (item['quantity'] as number) < 1 || (item['quantity'] as number) > 99
      || !integer(item['lineTotalVnd']) || (item['lineTotalVnd'] as number) !== (item['unitPriceVnd'] as number) * (item['quantity'] as number)) {
      throw malformed();
    }
    subtotal += item['lineTotalVnd'] as number;
    items.push({ variantId: item['variantId'], productName: item['productName'], sku: item['sku'],
      size: item['size'], color: item['color'], unitPriceVnd: item['unitPriceVnd'],
      quantity: item['quantity'], lineTotalVnd: item['lineTotalVnd'] });
  }
  if (!integer(row['subtotal']) || (row['subtotal'] as number) !== subtotal
    || !integer(row['shippingFee']) || (row['shippingFee'] as number) < 0
    || !integer(row['total']) || (row['total'] as number) !== (row['subtotal'] as number) + (row['shippingFee'] as number)
    || row['method'] !== 'COD' || row['currency'] !== 'VND' || typeof row['quoteId'] !== 'string'
    || !integer(row['settingsVersion']) || !isoText(row['serverNow']) || !isoText(row['expiresAt'])) {
    throw malformed();
  }
  return { quoteId: row['quoteId'] as string, method: 'COD', currency: 'VND', items,
    subtotal: row['subtotal'] as number, shippingFee: row['shippingFee'] as number, total: row['total'] as number,
    settingsVersion: row['settingsVersion'] as number, serverNow: row['serverNow'] as string, expiresAt: row['expiresAt'] as string };
}

export const checkoutApi = {
  /** Explicit shopper action; the caller provides cart lines, prices stay server-owned. */
  quote: async (items: readonly { variantId: string; quantity: number }[]): Promise<CheckoutQuote> =>
    parseCheckoutQuote(await request<unknown>('/checkout/quote', {
      method: 'POST',
      body: { items: items.map(({ variantId, quantity }) => ({ variantId, quantity })), method: 'COD' },
    })),
};

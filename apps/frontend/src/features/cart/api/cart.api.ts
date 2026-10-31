import { ApiError, request } from '../../../shared/api/client';
import { VARIANT_ID_PATTERN } from '../cart-store';
import type { CartLine } from '../cart-store';

// Wire shape of POST /api/v1/cart/resolve — fixed by docs/m4-contract.md §5: one reply entry
// per requested id (including unknown ones), first-occurrence order, no quantity echo, and
// unavailable rows carry nothing but the id and the status.
export type CartResolveStatus = 'AVAILABLE' | 'EXCEEDS_STOCK' | 'OUT_OF_STOCK' | 'UNAVAILABLE';

export interface CartResolvedProduct { name: string; slug: string }
export interface CartResolvedImage { url: string }

export interface CartAvailableResolvedItem {
  variantId: string;
  status: Exclude<CartResolveStatus, 'UNAVAILABLE'>;
  /** Sellable stock read at resolve time (onHand − reserved, never negative). */
  available: number;
  product: CartResolvedProduct;
  sku: string;
  size: string;
  color: string;
  price: number;
  image: CartResolvedImage | null;
}

export interface CartUnavailableResolvedItem {
  variantId: string;
  status: 'UNAVAILABLE';
}

export type CartResolvedItem = CartAvailableResolvedItem | CartUnavailableResolvedItem;

const RESOLVED_STATUSES = new Set(['AVAILABLE', 'EXCEEDS_STOCK', 'OUT_OF_STOCK', 'UNAVAILABLE']);

function readableText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** Entry-by-entry runtime validation; one malformed row invalidates the whole response. */
export function parseCartResolve(value: unknown): CartResolvedItem[] {
  const rows = typeof value === 'object' && value !== null ? (value as { items?: unknown }).items : undefined;
  if (!Array.isArray(rows)) return [];
  const items: CartResolvedItem[] = [];
  for (const entry of rows) {
    if (typeof entry !== 'object' || entry === null) return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.variantId !== 'string' || !VARIANT_ID_PATTERN.test(row.variantId)) return [];
    if (typeof row.status !== 'string' || !RESOLVED_STATUSES.has(row.status)) return [];
    if (row.status === 'UNAVAILABLE') {
      if (Object.keys(row).some((key) => key !== 'variantId' && key !== 'status')) return [];
      items.push({ variantId: row.variantId, status: 'UNAVAILABLE' });
      continue;
    }
    const product = row.product;
    const image = row.image;
    if (!dataComplete(row, product, image)) return [];
    items.push({
      variantId: row.variantId,
      status: row.status as CartAvailableResolvedItem['status'],
      available: row.available as number,
      product: product as CartResolvedProduct,
      sku: row.sku as string,
      size: row.size as string,
      color: row.color as string,
      price: row.price as number,
      image: image === null ? null : image as CartResolvedImage,
    });
  }
  return items;
}

function dataComplete(row: Record<string, unknown>, product: unknown, image: unknown): boolean {
  if (typeof row.available !== 'number' || !Number.isInteger(row.available) || row.available < 0) return false;
  if (typeof row.price !== 'number' || !Number.isInteger(row.price) || row.price < 0) return false;
  if (typeof row.sku !== 'string' || typeof row.size !== 'string' || typeof row.color !== 'string') return false;
  if (typeof product !== 'object' || product === null) return false;
  const info = product as Record<string, unknown>;
  if (!readableText(info.name) || !readableText(info.slug)) return false;
  if (image !== null && (typeof image !== 'object' || image === null)) return false;
  if (image !== null && !readableText((image as Record<string, unknown>).url)) return false;
  return true;
}

export const cartApi = {
  /** Read-only server lookup; nothing else in the feature may query variant data directly. */
  async resolve(items: readonly CartLine[]): Promise<CartResolvedItem[]> {
    if (items.length === 0) return [];
    const view = await request<unknown>('/cart/resolve', { method: 'POST', body: { items: [...items] } });
    const parsed = parseCartResolve(view);
    // Every requested id is answered, so a shorter or empty reply is not something to render.
    const expectedIds = new Set(items.map((item) => item.variantId));
    const actualIds = new Set(parsed.map((item) => item.variantId));
    if (parsed.length !== items.length || actualIds.size !== expectedIds.size
      || [...expectedIds].some((id) => !actualIds.has(id))) {
      throw new ApiError('INVALID_RESPONSE', 'Chưa đọc được giá và tình trạng của giỏ hàng. Vui lòng thử lại.', 0);
    }
    return parsed;
  },
};

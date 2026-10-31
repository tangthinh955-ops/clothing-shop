import { describe, expect, it, vi } from 'vitest';
import * as client from '../../../shared/api/client';
import { ApiError } from '../../../shared/api/client';
import { cartApi, parseCartResolve, type CartAvailableResolvedItem, type CartResolvedItem } from './cart.api';

const variantA = '17bfecab-9df4-4de4-bd91-3c11116fca5b';
const variantB = '98d3a8f8-8ac2-4a54-b9e4-34d3fcb8816f';

/** Narrow a resolved row to its sellable shape; the error marks a contract bug in the parser. */
function assertSellable(item: CartResolvedItem | undefined): asserts item is CartAvailableResolvedItem {
  if (!item || item.status === 'UNAVAILABLE') throw new Error('Test setup: expected a sellable resolved row');
}

describe('cart API resolve', () => {
  it('rejects a response with duplicate or unexpected variant IDs', async () => {
    vi.spyOn(client, 'request').mockResolvedValue({ items: [
      { variantId: variantA, status: 'UNAVAILABLE' }, { variantId: variantA, status: 'UNAVAILABLE' },
    ] });
    await expect(cartApi.resolve([{ variantId: variantA, quantity: 1 }, { variantId: variantB, quantity: 1 }]))
      .rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('does not call the server for an empty cart', async () => {
    const request = vi.spyOn(client, 'request').mockResolvedValue({ items: [] });
    const items = await cartApi.resolve([]);
    expect(items).toEqual([]);
    expect(request).not.toHaveBeenCalled();
  });

  it('posts the exact resolved payload once per cart shape', async () => {
    const payload = {
      items: [
        { variantId: variantA, status: 'AVAILABLE', available: 4,
          product: { name: 'Áo cotton', slug: 'ao-cotton' }, sku: 'CART-A-1', size: 'M', color: 'Đen',
          price: 200000, image: { url: '/api/v1/media/1234abcd' } },
        { variantId: variantB, status: 'UNAVAILABLE' },
      ],
    };
    const request = vi.spyOn(client, 'request').mockResolvedValue(payload);

    const items = await cartApi.resolve([
      { variantId: variantA, quantity: 2 },
      { variantId: variantB, quantity: 1 },
    ]);

    expect(items).toHaveLength(2);
    // Each row is the full documented shape; narrowing by status is how the union reads back.
    assertSellable(items[0]);
    expect(items[0].available).toBe(4);
    expect(items[0].product).toEqual({ name: 'Áo cotton', slug: 'ao-cotton' });
    expect(items[0].price).toBe(200000);
    expect(items[1]?.status).toBe('UNAVAILABLE');
    expect(Object.keys(items[1] as object)).toEqual(['variantId', 'status']);
    expect(request).toHaveBeenCalledExactlyOnceWith('/cart/resolve', {
      method: 'POST',
      body: { items: [{ variantId: variantA, quantity: 2 }, { variantId: variantB, quantity: 1 }] },
    });
    expect(request.mock.calls[0]?.[0]).toBe('/cart/resolve');
  });
});

describe('cart resolve response validation', () => {
  it('accepts the exact documented shape in order', () => {
    const parsed = parseCartResolve({
      items: [
        { variantId: variantA, status: 'AVAILABLE', available: 4,
          product: { name: 'Áo cotton', slug: 'ao-cotton' }, sku: 'CART-A-1', size: 'M', color: 'Đen',
          price: 200000, image: { url: '/api/v1/media/1234abcd' } },
        { variantId: variantB, status: 'UNAVAILABLE' },
        { variantId: variantA, status: 'EXCEEDS_STOCK', available: 2, product: { name: 'Áo cotton', slug: 'ao-cotton' },
          sku: 'CART-A-1', size: 'M', color: 'Đen', price: 200000, image: null },
      ],
    });
    expect(parsed).toHaveLength(3);
    assertSellable(parsed[0]);
    expect(parsed[0].image?.url).toBe('/api/v1/media/1234abcd');
    expect(parsed[1]?.status).toBe('UNAVAILABLE');
    expect(parsed[2]?.status).toBe('EXCEEDS_STOCK');
    assertSellable(parsed[2]);
    expect(parsed[2].image).toBeNull();
  });

  it('does not treat malformed responses as cart data', () => {
    expect(parseCartResolve(undefined)).toEqual([]);
    expect(parseCartResolve(null)).toEqual([]);
    expect(parseCartResolve({})).toEqual([]);
    expect(parseCartResolve({ items: 'hai' })).toEqual([]);
    expect(parseCartResolve({ items: [42] })).toEqual([]);
    expect(parseCartResolve({ items: [{ variantId: variantA, status: 'AVAILABLE', available: 'bốn',
      product: { name: 'Áo', slug: 'ao' }, sku: 'S', size: 'M', color: 'Đen', price: 1, image: null }] })).toEqual([]);
    expect(parseCartResolve({ items: [{ variantId: 'không-phải-uuid', status: 'UNAVAILABLE' }] })).toEqual([]);
    expect(parseCartResolve({ items: [{ variantId: variantA, status: 'AVAILABLE', product: { name: 'a', slug: 'b' } }] })).toEqual([]);
  });
});

describe('cart resolve failure mapping', () => {
  it('throws clear errors instead of showing stale prices as fresh data', async () => {
    vi.spyOn(client, 'request').mockRejectedValue(new ApiError('SERVICE_UNAVAILABLE', 'Dịch vụ chưa sẵn sàng…', 503));
    await expect(cartApi.resolve([{ variantId: variantA, quantity: 1 }])).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    vi.spyOn(client, 'request').mockRejectedValue(new ApiError('VALIDATION_ERROR', 'Giỏ chỉ chứa tối đa 50 dòng…', 400));
    await expect(cartApi.resolve([{ variantId: variantA, quantity: 1 }])).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import * as client from '../../../shared/api/client';
import { cartResolveQueryKey, useCartResolve } from './useCartResolve';

const variantA = '17bfecab-9df4-4de4-bd91-3c11116fca5b';
const variantB = '98d3a8f8-8ac2-4a54-b9e4-34d3fcb8816f';
const rows = {
  items: [
    { variantId: variantA, status: 'AVAILABLE', available: 10, product: { name: 'Áo', slug: 'ao' },
      sku: 'AO-1-M', size: 'M', color: 'Đen', price: 200000, image: null },
  ],
};

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

describe('cart resolve query', () => {
  it('keeps one cache identity per normalized cart', () => {
    expect(cartResolveQueryKey([])).toEqual(['shop-cart-resolve', []]);
    expect(cartResolveQueryKey([
      { variantId: variantA, quantity: 1 },
      { variantId: variantB, quantity: 2 },
    ])).toEqual(['shop-cart-resolve', [`${variantA}:1`, `${variantB}:2`]]);
    // The signature follows the cart's own row order: a differently ordered cart is a
    // different identity, so a previous response never shows up as the newer cart's data.
    expect(cartResolveQueryKey([{ variantId: variantB, quantity: 2 }, { variantId: variantA, quantity: 1 }]))
      .toEqual(['shop-cart-resolve', [`${variantB}:2`, `${variantA}:1`]]);
  });

  it('fetches and exposes the resolved items', async () => {
    const request = vi.spyOn(client, 'request').mockResolvedValue(rows);
    const { result } = renderHook(() => useCartResolve([{ variantId: variantA, quantity: 2 }]), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data?.[0]).toMatchObject({ variantId: variantA, status: 'AVAILABLE', available: 10 });
    expect(request).toHaveBeenCalledExactlyOnceWith('/cart/resolve', {
      method: 'POST', body: { items: [{ variantId: variantA, quantity: 2 }] },
    });
  });

  it('stays idle for an empty cart', () => {
    vi.spyOn(client, 'request').mockResolvedValue(rows);
    const { result } = renderHook(() => useCartResolve([]), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('re-fetches only when the cart changes, leaning on cache otherwise', async () => {
    const request = vi.spyOn(client, 'request').mockResolvedValue(rows);
    const first = renderHook((query: unknown) => useCartResolve(query as { variantId: string; quantity: number }[]), {
      initialProps: [{ variantId: variantA, quantity: 2 }], wrapper,
    });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    // Re-rendering with the same rows keeps serving cache without a new network call.
    first.rerender([{ variantId: variantA, quantity: 2 }]);
    expect(request).toHaveBeenCalledTimes(1);
    await first.rerender([{ variantId: variantA, quantity: 3 }]);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });
});

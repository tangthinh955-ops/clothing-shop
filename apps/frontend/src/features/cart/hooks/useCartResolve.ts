import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { cartApi, type CartResolvedItem } from '../api/cart.api';
import type { CartLine } from '../cart-store';

/** Cache identity of a cart: normalized rows so Drawer and /cart share one fetch result. */
export function cartResolveQueryKey(items: readonly CartLine[]): readonly unknown[] {
  return ['shop-cart-resolve', items.map((line) => `${line.variantId}:${line.quantity}`)];
}

/** Server prices/stock of the cart lines; keyed by the cart itself, nothing keeps a cached copy. */
export function useCartResolve(items: readonly CartLine[]) {
  const queryKey = useMemo(() => cartResolveQueryKey(items), [items]);
  return useQuery<CartResolvedItem[]>({
    queryKey,
    queryFn: () => cartApi.resolve(items),
    enabled: items.length > 0,
    // Re-check whenever a cart view becomes active; prices and stock can change at any time.
    staleTime: 0,
  });
}

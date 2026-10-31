import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CartProvider, useCart } from './CartProvider';
import { CART_STORAGE_KEY } from './cart-store';

// jsdom Storage ignores instance-level spies, so whole-storage swaps are the reliable seam here.
const realStorage = window.localStorage;

/** Fake Storage made of a Map; overrides replace single operations (they may throw). */
function fakeStorage(overrides: Partial<Storage> = {}): Storage {
  const map = new Map<string, string>();
  const base = {
    get length() { return map.size; },
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
  };
  return { ...base, ...overrides } as Storage;
}

function swapStorage(overrides: Partial<Storage>): void {
  Object.defineProperty(window, 'localStorage', { configurable: true, value: fakeStorage(overrides) });
}


const variantA = '17bfecab-9df4-4de4-bd91-3c11116fca5b';
const variantB = '98d3a8f8-8ac2-4a54-b9e4-34d3fcb8816f';

function Probe({ variantId, quantity }: { variantId: string; quantity: number }) {
  const cart = useCart();
  return <div>
    <span data-testid="items">{JSON.stringify(cart.items)}</span>
    <span data-testid="total">{String(cart.totalQuantity)}</span>
    <span data-testid="drawer">{String(cart.drawerOpen)}</span>
    <span data-testid="highlight">{cart.highlight ? `${cart.highlight.variantId}:${cart.highlight.token}` : '-'}</span>
    <span data-testid="rejection">{cart.rejection ? `${cart.rejection.error}:${cart.rejection.variantId ?? ''}:${cart.rejection.token}` : '-'}</span>
    <span data-testid="warning">{cart.storageWarning ?? '-'}</span>
    <button data-testid="add" onClick={() => cart.addItem(variantId, quantity)}>add</button>
    <button data-testid="update" onClick={() => cart.updateQuantity(variantId, quantity)}>update</button>
    <button data-testid="remove" onClick={() => cart.removeItem(variantId)}>remove</button>
    <button data-testid="open" onClick={cart.openDrawer}>open</button>
    <button data-testid="close" onClick={cart.closeDrawer}>close</button>
  </div>;
}

function renderProbe(variantId = variantA, quantity = 2) {
  return render(<CartProvider><Probe variantId={variantId} quantity={quantity} /></CartProvider>);
}

const text = (testId: string) => screen.getByTestId(testId).textContent ?? '';
const user = userEvent.setup();

beforeEach(() => { realStorage.clear(); });
afterEach(() => {
  Object.defineProperty(window, 'localStorage', { configurable: true, value: realStorage });
  vi.restoreAllMocks();
});

describe('guest cart provider', () => {
  it('reports a corrupt saved cart when React StrictMode initializes twice', () => {
    window.localStorage.setItem(CART_STORAGE_KEY, '{broken');
    render(<StrictMode><CartProvider><Probe variantId={variantA} quantity={2} /></CartProvider></StrictMode>);
    expect(text('warning')).toBe('corrupt');
  });
  it('keeps a memory cart when the localStorage getter itself is blocked', async () => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });
    renderProbe();
    expect(text('warning')).toBe('unavailable');
    await user.click(screen.getByTestId('add'));
    expect(JSON.parse(text('items'))).toEqual([{ variantId: variantA, quantity: 2 }]);
    expect(text('warning')).toBe('unavailable');
  });
  it('opens the drawer and highlights the row after a successful add, then persists', async () => {
    renderProbe();
    await user.click(screen.getByTestId('add'));
    await waitFor(() => {
      expect(JSON.parse(text('items'))).toEqual([{ variantId: variantA, quantity: 2 }]);
      expect(text('total')).toBe('2');
      expect(text('drawer')).toBe('true');
      expect(text('highlight')).toContain(`${variantA}:`);
      expect(text('warning')).toBe('-');
    });
    expect(window.localStorage.getItem(CART_STORAGE_KEY)).toContain(variantA);
  });

  it('refuses a rejected add: no drawer, previous cart wins, clear error', async () => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, items: [{ variantId: variantA, quantity: 97 }] }));
    renderProbe(variantA, 3);
    await user.click(screen.getByTestId('add'));
    await waitFor(() => expect(text('rejection')).toContain('max-per-variant'));
    expect(JSON.parse(text('items'))).toEqual([{ variantId: variantA, quantity: 97 }]);
    expect(text('total')).toBe('97');
    expect(text('drawer')).toBe('false');
  });

  it('opens fresh from persisted rows after a remount (transient state resets)', async () => {
    const first = renderProbe(variantA, 2);
    await user.click(screen.getByTestId('add'));
    const original = await waitFor(() => {
      const value = text('highlight');
      expect(value).toContain(`${variantA}:`);
      return value;
    });
    await user.click(screen.getByTestId('add')); // same variant merges; still a success
    await waitFor(() => expect(text('highlight')).not.toBe(original));
    expect(text('drawer')).toBe('true');
    first.unmount();
    // Transient drawer/highlight state never persists, only the merged cart rows do.
    renderProbe(variantB, 1);
    await waitFor(() => expect(JSON.parse(text('items'))).toEqual([{ variantId: variantA, quantity: 4 }]));
    expect(text('drawer')).toBe('false');
    expect(text('highlight')).toBe('-');
  });

  it('reports storage corruption and starts from an empty memory cart', async () => {
    window.localStorage.setItem(CART_STORAGE_KEY, '{schemaVersion:1, items: broken');
    renderProbe();
    await waitFor(() => expect(text('warning')).toBe('corrupt'));
    expect(JSON.parse(text('items'))).toEqual([]);
  });

  it('clears the storage warning once a fresh cart saves successfully', async () => {
    window.localStorage.setItem(CART_STORAGE_KEY, '{broken');
    renderProbe();
    await waitFor(() => expect(text('warning')).toBe('corrupt'));
    await user.click(screen.getByTestId('add'));
    await waitFor(() => expect(text('warning')).toBe('-'));
    expect(JSON.parse(text('items'))).toEqual([{ variantId: variantA, quantity: 2 }]);
  });

  it('warns and keeps the in-memory cart when the storage blocks reads', async () => {
    swapStorage({ getItem: () => { throw new DOMException('blocked', 'SecurityError'); } });
    renderProbe();
    await waitFor(() => expect(text('warning')).toBe('unavailable'));
    await user.click(screen.getByTestId('add'));
    await waitFor(() => expect(JSON.parse(text('items'))).toEqual([{ variantId: variantA, quantity: 2 }]));
    expect(text('drawer')).toBe('true');
  });

  it('warns when writing fails (quota) and keeps serving the memory cart', async () => {
    swapStorage({ setItem: () => { throw new DOMException('quota', 'QuotaExceededError'); } });
    renderProbe();
    await user.click(screen.getByTestId('add'));
    await waitFor(() => expect(text('warning')).toBe('unavailable'));
    expect(JSON.parse(text('items'))).toEqual([{ variantId: variantA, quantity: 2 }]);
  });

  it('passes quantity edits to the exact row; 0 stays an error instead of a removal', async () => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, items: [{ variantId: variantA, quantity: 3 }] }));
    renderProbe(variantA, 0);
    await user.click(screen.getByTestId('update'));
    await waitFor(() => expect(text('rejection')).toContain('invalid-quantity'));
    expect(JSON.parse(text('items'))).toEqual([{ variantId: variantA, quantity: 3 }]);
    await user.click(screen.getByTestId('remove'));
    await waitFor(() => expect(JSON.parse(text('items'))).toEqual([]));
    await user.click(screen.getByTestId('remove'));
    await waitFor(() => expect(text('rejection')).toContain('not-in-cart'));
  });
});

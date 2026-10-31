import { describe, expect, it } from 'vitest';
import {
  addLine, cartTotalQuantity, createCart, loadCart, parseCartJson, removeLine,
  saveCart, serializeCart, updateQuantity, CART_STORAGE_KEY, type CartState,
} from './cart-store';

const variantA = '17bfecab-9df4-4de4-bd91-3c11116fca5b';
const variantB = '98d3a8f8-8ac2-4a54-b9e4-34d3fcb8816f';
const uuid = () => globalThis.crypto.randomUUID();

describe('cart lines and limits', () => {
  it('starts with an empty normalized cart of schema version 1', () => {
    expect(createCart()).toEqual({ schemaVersion: 1, items: [] });
  });

  it('adds a variant to an empty cart with its requested quantity', () => {
    const { next } = addLine(createCart(), variantA, 2);
    expect(next).toEqual({ schemaVersion: 1, items: [{ variantId: variantA, quantity: 2 }] });
  });

  it('merges repeated adds of the same variant instead of adding a second row', () => {
    let state = createCart();
    state = addLine(state, variantA, 1).next;
    state = addLine(state, variantB, 3).next;
    state = addLine(state, variantA, 4).next;
    expect(state.items).toEqual([
      { variantId: variantA, quantity: 5 },
      { variantId: variantB, quantity: 3 },
    ]);
    expect(cartTotalQuantity(state)).toBe(8);
  });

  it('rejects add below 1 or above 99 and keeps the previous cart', () => {
    const state = addLine(createCart(), variantA, 1).next;
    for (const quantity of [0, -2, 1.5, 100]) {
      const result = addLine(state, variantA, quantity);
      expect(result.error).toBe('invalid-quantity');
      expect(result.next).toBe(state); // same reference: the failed operation changes nothing
    }
  });

  it('reports exceeding 99 per merged variant without trimming the cart', () => {
    const state = addLine(createCart(), variantA, 97).next;
    const result = addLine(state, variantA, 3);
    expect(result.error).toBe('max-per-variant');
    expect(result.next).toBe(state);
    expect(result.next.items[0]).toEqual({ variantId: variantA, quantity: 97 });
  });

  it('allows 50 lines after merging and refuses the 51st product', () => {
    const ids = Array.from({ length: 50 }, () => uuid());
    let state: CartState = createCart();
    for (const variantId of ids) state = addLine(state, variantId, 1).next;
    expect(state.items).toHaveLength(50);
    const overflow = addLine(state, uuid(), 1);
    expect(overflow.error).toBe('max-lines');
    expect(overflow.next).toBe(state);
    // Merging into an existing line still works at 50 rows.
    const merged = addLine(state, ids[0] as string, 1);
    expect(merged.error).toBeUndefined();
    expect(merged.next.items).toHaveLength(50);
    // Removing one row opens a slot for new products again.
    const reduced = removeLine(state, ids[0] as string).next;
    expect(addLine(reduced, uuid(), 1).error).toBeUndefined();
  });

  it('updates the quantity of the exact row it was asked to', () => {
    let state = addLine(createCart(), variantA, 2).next;
    state = addLine(state, variantB, 9).next;
    state = updateQuantity(state, variantB, 5).next;
    expect(state.items).toEqual([
      { variantId: variantA, quantity: 2 },
      { variantId: variantB, quantity: 5 },
    ]);
  });

  it('refuses quantity 0 so a mistyped edit never silently deletes the row', () => {
    const state = addLine(createCart(), variantA, 3).next;
    const result = updateQuantity(state, variantA, 0);
    expect(result.error).toBe('invalid-quantity');
    expect(result.next).toBe(state);
    expect(result.next.items).toEqual([{ variantId: variantA, quantity: 3 }]);
  });

  it('rejects out-of-range or non-integer quantity updates and missing rows', () => {
    const state = addLine(createCart(), variantA, 3).next;
    for (const quantity of [-1, 2.25, 100]) {
      const result = updateQuantity(state, variantA, quantity);
      expect(result.error).toBe('invalid-quantity');
      expect(result.next).toBe(state);
    }
    const missing = updateQuantity(state, uuid(), 2);
    expect(missing.error).toBe('not-in-cart');
    expect(missing.next).toBe(state);
  });

  it('removes only the touched row through the explicit remove action', () => {
    let state = addLine(createCart(), variantA, 2).next;
    state = addLine(state, variantB, 4).next;
    state = removeLine(state, variantA).next;
    expect(state.items).toEqual([{ variantId: variantB, quantity: 4 }]);
    // Removing again keeps the cart and reports that the row is already gone.
    const again = removeLine(state, variantA);
    expect(again.error).toBe('not-in-cart');
    expect(again.next).toBe(state);
  });
});

describe('cart persistence shape', () => {
  it('serializes only schemaVersion, variantId and quantity', () => {
    let state = addLine(createCart(), variantA, 2).next;
    state = addLine(state, variantB, 1).next;
    const parsed = JSON.parse(serializeCart(state)) as Record<string, unknown>;
    expect(parsed).toEqual({
      schemaVersion: 1,
      items: [
        { variantId: variantA, quantity: 2 },
        { variantId: variantB, quantity: 1 },
      ],
    });
  });

  it('round-trips through serialize and parse', () => {
    const state = addLine(createCart(), variantA, 2).next;
    expect(parseCartJson(serializeCart(state))).toEqual(state);
  });

  it('treats broken JSON, foreign schemas and bad rows as unusable', () => {
    expect(parseCartJson('not-json')).toBeUndefined();
    expect(parseCartJson('[]')).toBeUndefined();
    expect(parseCartJson('{')).toBeUndefined();
    expect(parseCartJson(JSON.stringify({ schemaVersion: 2, items: [] }))).toBeUndefined();
    expect(parseCartJson(JSON.stringify({ items: [{ variantId: variantA, quantity: 1 }] }))).toBeUndefined();
    expect(parseCartJson(JSON.stringify({ schemaVersion: 1, items: {} }))).toBeUndefined();
    expect(parseCartJson(JSON.stringify({ schemaVersion: 1, items: [{ variantId: 'không-phải-uuid', quantity: 1 }] }))).toBeUndefined();
    expect(parseCartJson(JSON.stringify({ schemaVersion: 1, items: [{ variantId: variantA, quantity: 0 }] }))).toBeUndefined();
    expect(parseCartJson(JSON.stringify({ schemaVersion: 1, items: [{ variantId: variantA, quantity: 2.5 }] }))).toBeUndefined();
    expect(parseCartJson(JSON.stringify({ schemaVersion: 1, items: [{ variantId: variantA }] }))).toBeUndefined();
    expect(parseCartJson(JSON.stringify({ schemaVersion: 1, items: [{ quantity: 2 }] }))).toBeUndefined();
  });
});

describe('cart storage adapter', () => {
  it('rejects persisted duplicate and oversized carts instead of restoring invalid state', () => {
    const storage = memoryStorage();
    storage.setItem(CART_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, items: [
      { variantId: variantA, quantity: 60 }, { variantId: variantA, quantity: 60 },
    ] }));
    expect(loadCart(storage)).toMatchObject({ warning: 'corrupt', state: { items: [] } });
    const items = Array.from({ length: 51 }, (_, index) => ({
      variantId: `17bfecab-9df4-4de4-bd91-${String(index).padStart(12, '0')}`, quantity: 1,
    }));
    storage.setItem(CART_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, items }));
    expect(loadCart(storage)).toMatchObject({ warning: 'corrupt', state: { items: [] } });
  });
  it('uses one stable storage key that carry no shop configuration identity', () => {
    expect(CART_STORAGE_KEY).toBe('guest-cart-v1');
  });

  it('saves into localStorage and loads the same cart back', () => {
    const storage = memoryStorage();
    window.localStorage.clear();
    const state = addLine(createCart(), variantA, 2).next;
    expect(saveCart(window.localStorage, state)).toBe(true);
    const loaded = loadCart(window.localStorage);
    expect(loaded.warning).toBeUndefined();
    expect(loaded.state).toEqual(state);
    expect(loadCart(storage).state).toEqual({ schemaVersion: 1, items: [] });
  });

  it('reports an empty cart when the storage is empty', () => {
    window.localStorage.clear();
    const loaded = loadCart(window.localStorage);
    expect(loaded.state).toEqual({ schemaVersion: 1, items: [] });
    expect(loaded.warning).toBeUndefined();
  });

  it('falls back to a memory cart and warns when reading the storage is blocked', () => {
    const blocked = memoryStorage({ getItem: () => { throw new DOMException('blocked', 'SecurityError'); } });
    const loaded = loadCart(blocked);
    expect(loaded.state).toEqual({ schemaVersion: 1, items: [] });
    expect(loaded.warning).toBe('unavailable');
  });

  it('resets with a warning on corrupted stored content and clears the bad value', () => {
    window.localStorage.clear();
    window.localStorage.setItem(CART_STORAGE_KEY, '{schemaVersion:1, items: broken');
    const loaded = loadCart(window.localStorage);
    expect(loaded.warning).toBe('corrupt');
    expect(loaded.state).toEqual({ schemaVersion: 1, items: [] });
    expect(window.localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
  });

  it('still recovers when removing corrupted data is blocked', () => {
    window.localStorage.clear();
    const stubborn = memoryStorage({
      removeItem: () => { throw new DOMException('blocked', 'SecurityError'); },
    });
    stubborn.setItem(CART_STORAGE_KEY, 'not-json');
    const loaded = loadCart(stubborn);
    expect(loaded.warning).toBe('corrupt');
    expect(loaded.state).toEqual({ schemaVersion: 1, items: [] });
  });

  it('still works in memory and warns when writing fails, keeping the requested cart', () => {
    const state = addLine(createCart(), variantA, 1).next;
    expect(saveCart(failingWriteStorage(), state)).toBe(false);
    expect(saveCart(window.localStorage, state)).toBe(true);
    expect(loadCart(window.localStorage).state).toEqual(state);
  });
});

/** Minimal Storage working from a map; overrides replace single operations (they may throw). */
function memoryStorage(overrides: Partial<Storage> = {}): Storage {
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

/** Storage whose writes always fail, e.g. an exceeded quota. */
function failingWriteStorage(): Storage {
  return memoryStorage({ setItem: () => { throw new DOMException('quota', 'QuotaExceededError'); } });
}

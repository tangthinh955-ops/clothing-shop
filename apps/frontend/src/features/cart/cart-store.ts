// Guest cart model: the one normalized cart shape shared by the drawer, the shopping
// cart page and persistent storage. Everything here is pure — no React, no server —
// so behavior limits are testable and the provider can put them behind a reducer.
export const CART_STORAGE_KEY = 'guest-cart-v1';
export const CART_SCHEMA_VERSION = 1;
export const CART_LINES_LIMIT = 50;
export const CART_QUANTITY_LIMIT = 99;

export interface CartLine { variantId: string; quantity: number }
export interface CartState { schemaVersion: typeof CART_SCHEMA_VERSION; items: CartLine[] }

export type CartOperationError = 'invalid-quantity' | 'max-per-variant' | 'max-lines' | 'not-in-cart';
export interface CartOperationResult { next: CartState; error?: CartOperationError }

export type CartStorageWarning = 'unavailable' | 'corrupt';
export interface CartLoadResult { state: CartState; warning?: CartStorageWarning }

const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
/** Ids leave as UUIDs in every persisted or wire shape the frontend accepts. */
export const VARIANT_ID_PATTERN = UUID_PATTERN;

/** A fresh, empty cart in the supported schema. */
export function createCart(): CartState {
  return { schemaVersion: CART_SCHEMA_VERSION, items: [] };
}

/** Badge totals count pieces, not rows: two sizes of two pieces means four pieces. */
export function cartTotalQuantity(state: CartState): number {
  return state.items.reduce((total, line) => total + line.quantity, 0);
}

function validQuantity(quantity: unknown): quantity is number {
  return typeof quantity === 'number' && Number.isInteger(quantity) && quantity >= 1 && quantity <= CART_QUANTITY_LIMIT;
}

function lineIndex(items: CartLine[], variantId: string): number {
  return items.findIndex((line) => line.variantId === variantId);
}

/**
 * Adds a variant or merges into its existing row. Rejected operations return the SAME
 * state object — shoppers keep exactly what they had, nothing is trimmed silently.
 */
export function addLine(state: CartState, variantId: string, quantity: number): CartOperationResult {
  if (!validQuantity(quantity)) return { next: state, error: 'invalid-quantity' };
  const existing = lineIndex(state.items, variantId);
  if (existing === -1) {
    if (state.items.length >= CART_LINES_LIMIT) return { next: state, error: 'max-lines' };
    return { next: { schemaVersion: CART_SCHEMA_VERSION, items: [...state.items, { variantId, quantity }] } };
  }
  const line = state.items[existing] as CartLine;
  const merged = line.quantity + quantity;
  if (merged > CART_QUANTITY_LIMIT) return { next: state, error: 'max-per-variant' };
  const items = state.items.map((item, index) => index === existing
    ? { variantId: item.variantId, quantity: merged } : item);
  return { next: { schemaVersion: CART_SCHEMA_VERSION, items } };
}

/** Replaces one row's quantity; quantity 0 is refused instead of acting like a removal. */
export function updateQuantity(state: CartState, variantId: string, quantity: number): CartOperationResult {
  if (!validQuantity(quantity)) return { next: state, error: 'invalid-quantity' };
  const existing = lineIndex(state.items, variantId);
  if (existing === -1) return { next: state, error: 'not-in-cart' };
  const items = state.items.map((item, index) => index === existing
    ? { variantId: item.variantId, quantity } : item);
  return { next: { schemaVersion: CART_SCHEMA_VERSION, items } };
}

/** The only way to drop a row — always an explicit shopper action. */
export function removeLine(state: CartState, variantId: string): CartOperationResult {
  const existing = lineIndex(state.items, variantId);
  if (existing === -1) return { next: state, error: 'not-in-cart' };
  const items = state.items.filter((_, index) => index !== existing);
  return { next: { schemaVersion: CART_SCHEMA_VERSION, items } };
}

/** Empties the cart; used after a confirmed order consumed exactly these lines. */
export function clearCart(state: CartState): CartOperationResult {
  if (state.items.length === 0) return { next: state };
  return { next: createCart() };
}

/** Serialized exactly like the agreed shape; prices or identities have no place here. */
export function serializeCart(state: CartState): string {
  return JSON.stringify({
    schemaVersion: CART_SCHEMA_VERSION,
    items: state.items.map(({ variantId, quantity }) => ({ variantId, quantity })),
  });
}

/** Untrusted storage content is validated entry by entry; anything off makes it unreadable. */
export function parseCartJson(text: string): CartState | undefined {
  let value: unknown;
  try { value = JSON.parse(text) as unknown; } catch { return undefined; }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== CART_SCHEMA_VERSION) return undefined;
  if (!Array.isArray(record.items)) return undefined;
  if (record.items.length > 100) return undefined;
  let state = createCart();
  for (const entry of record.items) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return undefined;
    const line = entry as Record<string, unknown>;
    if (typeof line.variantId !== 'string' || !UUID_PATTERN.test(line.variantId)) return undefined;
    if (!validQuantity(line.quantity)) return undefined;
    const result = addLine(state, line.variantId.toLowerCase(), line.quantity);
    if (result.error) return undefined;
    state = result.next;
  }
  return state;
}

/**
 * Reads the persisted cart. Blocked storages (privacy settings, embedded frames)
 * degrade to a memory cart with a warning; corrupted values are reset and reported.
 */
export function loadCart(storage: Pick<Storage, 'getItem' | 'removeItem'>): CartLoadResult {
  let raw: string | null;
  try { raw = storage.getItem(CART_STORAGE_KEY); } catch { return { state: createCart(), warning: 'unavailable' }; }
  if (raw === null) return { state: createCart() };
  const state = parseCartJson(raw);
  if (state) return { state };
  try { storage.removeItem(CART_STORAGE_KEY); } catch { /* the warning explains the empty cart */ }
  return { state: createCart(), warning: 'corrupt' };
}

/** Writes the cart; failures (quota, blocked storage) return false, never an application crash. */
export function saveCart(storage: Storage, state: CartState): boolean {
  try {
    storage.setItem(CART_STORAGE_KEY, serializeCart(state));
    return true;
  } catch { return false; }
}

import { createContext, useContext, useEffect, useReducer, useMemo, useRef, type ReactNode } from 'react';
// One cart for every guest surface: this provider owns the cart rows, the drawer state and
// the transient display signals (highlight/rejection/warning) built on the pure cart-store.
import {
  addLine, cartTotalQuantity, clearCart, loadCart, removeLine, saveCart, updateQuantity,
  type CartLine, type CartOperationError, type CartState, type CartStorageWarning,
} from './cart-store';

export interface CartHighlight { variantId: string; token: number }
export interface CartRejection { variantId: string | null; error: CartOperationError; token: number }

export interface CartContextValue {
  items: readonly CartLine[];
  totalQuantity: number;
  drawerOpen: boolean;
  openDrawer(): void;
  closeDrawer(): void;
  addItem(variantId: string, quantity: number): void;
  updateQuantity(variantId: string, quantity: number): void;
  removeItem(variantId: string): void;
  clear(): void;
  /** Row of the most recent successful add; token lets widgets know a newer add happened. */
  highlight: CartHighlight | null;
  rejection: CartRejection | null;
  /** Persisted state could not be read ('corrupt') or shared ('unavailable') — see cart-store. */
  storageWarning: CartStorageWarning | null;
}

interface CartUiState {
  cart: CartState;
  drawerOpen: boolean;
  highlight: CartHighlight | null;
  rejection: CartRejection | null;
  storageWarning: CartStorageWarning | null;
}

type CartAction =
  | { type: 'add'; variantId: string; quantity: number; token: number }
  | { type: 'update'; variantId: string; quantity: number; token: number }
  | { type: 'remove'; variantId: string; token: number }
  | { type: 'clear' }
  | { type: 'openDrawer' }
  | { type: 'closeDrawer' }
  | { type: 'persist'; ok: boolean };

function reducer(state: CartUiState, action: CartAction): CartUiState {
  switch (action.type) {
    case 'add': {
      const result = addLine(state.cart, action.variantId, action.quantity);
      if (result.error) {
        return { ...state, rejection: { variantId: action.variantId, error: result.error, token: action.token } };
      }
      // A successful add is what opens the drawer; failed ones must not pretend success.
      return {
        ...state, cart: result.next, drawerOpen: true,
        highlight: { variantId: action.variantId, token: action.token }, rejection: null,
      };
    }
    case 'update': {
      const result = updateQuantity(state.cart, action.variantId, action.quantity);
      if (result.error) {
        return { ...state, rejection: { variantId: action.variantId, error: result.error, token: action.token } };
      }
      return { ...state, cart: result.next, rejection: null };
    }
    case 'remove': {
      const result = removeLine(state.cart, action.variantId);
      if (result.error) {
        return { ...state, rejection: { variantId: action.variantId, error: result.error, token: action.token } };
      }
      return { ...state, cart: result.next, rejection: null };
    }
    case 'clear': return { ...state, cart: clearCart(state.cart).next, highlight: null, rejection: null };
    case 'openDrawer': return { ...state, drawerOpen: true };
    case 'closeDrawer': return { ...state, drawerOpen: false };
    case 'persist': {
      // A fresh write replaces both warn reasons: the shopper's current cart is on disk again.
      if (action.ok) return state.storageWarning === null ? state : { ...state, storageWarning: null };
      return state.storageWarning === 'unavailable' ? state : { ...state, storageWarning: 'unavailable' };
    }
  }
}

function initialize(): CartUiState {
  let loaded: ReturnType<typeof loadCart>;
  try { loaded = loadCart(window.localStorage); }
  catch { loaded = { state: { schemaVersion: 1, items: [] }, warning: 'unavailable' }; }
  return { cart: loaded.state, drawerOpen: false, highlight: null, rejection: null, storageWarning: loaded.warning ?? null };
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialize);
  const token = useRef(0);
  // The cart as loaded is already on disk; persist from the first change onwards, reporting
  // write failures (blocked storage, quota) instead of losing the cart silently.
  const persisted = useRef<CartState | null>(null);

  useEffect(() => {
    if (persisted.current === null) { persisted.current = state.cart; return; }
    if (persisted.current === state.cart) return;
    persisted.current = state.cart;
    let ok = false;
    try { ok = saveCart(window.localStorage, state.cart); } catch { /* storage getter can throw */ }
    dispatch({ type: 'persist', ok });
  }, [state.cart]);

  const value = useMemo<CartContextValue>(() => ({
    items: state.cart.items,
    totalQuantity: cartTotalQuantity(state.cart),
    drawerOpen: state.drawerOpen,
    openDrawer: () => dispatch({ type: 'openDrawer' }),
    closeDrawer: () => dispatch({ type: 'closeDrawer' }),
    addItem: (variantId, quantity) => dispatch({ type: 'add', variantId, quantity, token: token.current++ }),
    updateQuantity: (variantId, quantity) => dispatch({ type: 'update', variantId, quantity, token: token.current++ }),
    removeItem: (variantId) => dispatch({ type: 'remove', variantId, token: token.current++ }),
    clear: () => dispatch({ type: 'clear' }),
    highlight: state.highlight,
    rejection: state.rejection,
    storageWarning: state.storageWarning,
  }), [state]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (value === null) throw new Error('Giỏ hàng chỉ dùng được bên trong CartProvider của App.');
  return value;
}

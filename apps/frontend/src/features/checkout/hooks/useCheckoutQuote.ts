import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import type { CartLine } from '../../cart/cart-store';
import { checkoutApi, type CheckoutQuote } from '../api/checkout.api';

export type QuotePhase = 'idle' | 'pending' | 'accepted' | 'stale' | 'expired' | 'confirm' | 'error';

export interface CheckoutQuoteState {
  phase: QuotePhase;
  /**
   * The quote the shopper last saw. It is kept for reference in stale/expired/confirm/error so the UI
   * can clearly separate "old" from "valid" — it is only a valid quote while phase is 'accepted'.
   */
  quote: CheckoutQuote | null;
  /** Fresh quote whose price or fee differs from the accepted one; applies only after confirmation. */
  pendingQuote: CheckoutQuote | null;
  error: string | null;
  /** Milliseconds left, computed from the server clock offset; cosmetic only, the server re-checks. */
  remainingMs: number | null;
}

/** Price/fee identity of a quote: the change a shopper must explicitly confirm. */
const signatureOf = (quote: CheckoutQuote) => JSON.stringify([
  quote.items.map((item) => [item.variantId, item.unitPriceVnd, item.quantity]), quote.shippingFee]);

/** Cart identity used for drift detection — same normalization as the backend merge. */
const cartKey = (items: readonly CartLine[]) => JSON.stringify(
  [...items]
    .map((line) => ({ id: line.variantId.toLowerCase(), quantity: line.quantity }))
    .sort((left, right) => (left.id < right.id ? -1 : 1))
    .map((line) => [line.id, line.quantity]));

export function useCheckoutQuote(items: readonly CartLine[]) {
  const [state, setState] = useState<CheckoutQuoteState>(
    { phase: 'idle', quote: null, pendingQuote: null, error: null, remainingMs: null });
  const inFlightRef = useRef(false);         // synchronous double-submit guard
  const sequenceRef = useRef(0);             // late responses never win over newer ones
  const requestKeyRef = useRef('');          // cart snapshot the in-flight request was built from
  const cartNowRef = useRef('');             // latest cart identity, refreshed on every render
  const serverOffsetRef = useRef(0);         // serverNow − clientNow when the response landed
  const acceptedSignatureRef = useRef('');   // price/fee signature the shopper last accepted

  const normalizedCart = useMemo(() => cartKey(items), [items]);
  cartNowRef.current = normalizedCart;

  const fetchQuote = useCallback(async () => {
    if (inFlightRef.current || items.length === 0) return;
    inFlightRef.current = true;
    const sequence = ++sequenceRef.current;
    const requestKey = normalizedCart;
    requestKeyRef.current = requestKey;
    setState((prev) => ({ ...prev, phase: 'pending', pendingQuote: null, error: null, remainingMs: null }));
    try {
      const quote = await checkoutApi.quote(items);
      if (sequence !== sequenceRef.current) return;
      if (cartNowRef.current !== requestKey) {
        // The cart was edited mid-flight: the response describes a cart that no longer exists.
        setState((prev) => prev.phase === 'pending'
          ? { ...prev, phase: 'stale', pendingQuote: null, error: null, remainingMs: null } : prev);
        return;
      }
      serverOffsetRef.current = Date.parse(quote.serverNow) - Date.now();
      const differs = acceptedSignatureRef.current !== '' && acceptedSignatureRef.current !== signatureOf(quote);
      if (differs) {
        setState((prev) => ({ ...prev, phase: 'confirm', pendingQuote: quote, error: null, remainingMs: null }));
      } else {
        acceptedSignatureRef.current = signatureOf(quote);
        setState((prev) => ({ ...prev, phase: 'accepted', quote, pendingQuote: null, error: null }));
      }
    } catch (cause) {
      if (sequence !== sequenceRef.current) return;
      setState((prev) => ({ ...prev, phase: 'error',
        error: cause instanceof ApiError ? cause.message : 'Chưa lấy được báo giá. Vui lòng thử lại.' }));
    } finally {
      if (sequence === sequenceRef.current) inFlightRef.current = false;
    }
  }, [items, normalizedCart]);

  const acceptPending = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== 'confirm' || !prev.pendingQuote) return prev;
      if (Date.parse(prev.pendingQuote.expiresAt) <= Date.now() + serverOffsetRef.current) {
        return { ...prev, phase: 'expired', pendingQuote: null, remainingMs: 0 };
      }
      acceptedSignatureRef.current = signatureOf(prev.pendingQuote);
      return { ...prev, phase: 'accepted', quote: prev.pendingQuote, pendingQuote: null, error: null };
    });
  }, []);

  // Cart drift: any previously seen quote stops applying as soon as the cart differs from the request.
  useEffect(() => {
    setState((prev) => {
      if (prev.phase === 'idle' || prev.phase === 'pending') return prev;
      if (requestKeyRef.current === '' || cartNowRef.current === requestKeyRef.current) return prev;
      return { ...prev, phase: 'stale', pendingQuote: null, error: null, remainingMs: null };
    });
  }, [normalizedCart]);

  // Cosmetic countdown on the server clock; sleep/wake is handled by recomputing on visibility.
  const { phase } = state;
  const timedQuote = phase === 'confirm' ? state.pendingQuote : state.quote;
  useEffect(() => {
    if ((phase !== 'accepted' && phase !== 'confirm') || !timedQuote) return;
    const expiresAtMs = Date.parse(timedQuote.expiresAt);
    const tick = () => {
      const remaining = expiresAtMs - (Date.now() + serverOffsetRef.current);
      setState((prev) => (prev.phase === 'accepted' || prev.phase === 'confirm')
        ? (remaining <= 0
          ? { ...prev, phase: 'expired', pendingQuote: null, remainingMs: 0 }
          : { ...prev, remainingMs: remaining })
        : prev);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    const onVisibility = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [phase, timedQuote]);

  return { ...state, fetchQuote, acceptPending };
}

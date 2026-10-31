import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError } from '../../shared/api/client';
import { isDefiniteOrderError, ordersApi, type CreateOrderBody, type CreateOrderResult } from './api/orders.api';

export type SubmissionPhase = 'idle' | 'pending' | 'unknown' | 'confirmed' | 'failed';

export interface OrderSubmissionState {
  phase: SubmissionPhase;
  /** The one command (key + body) of the current intent; kept verbatim for the replay path. */
  key: string | null;
  body: CreateOrderBody | null;
  result: CreateOrderResult | null;
  error: string | null;
  /** Definite-failure field errors keyed by API field path (`contact.name`, `address.province`…). */
  fieldErrors: Record<string, string>;
  /** True once the confirmed order's cart-clear side effect has been applied (exactly once per command). */
  cartHandled: boolean;
}

export interface OrderSubmissionContextValue extends OrderSubmissionState {
  /** One shopper intent: generates the key once and posts it; errors route to unknown/failed. */
  submit(body: CreateOrderBody): Promise<void>;
  /** Resends the exact captured command (same key, same body) after a lost/unclear response. */
  retry(): Promise<void>;
  /** Clears a definitively failed intent so the next placement generates a fresh key. */
  reset(): void;
  /** Marks a confirmed submission as consumed by the UI. */
  dismiss(): void;
  /** Records that the confirmed order's cart-clear side effect has run (exactly once per command). */
  markCartHandled(): void;
}

const OrderSubmissionContext = createContext<OrderSubmissionContextValue | undefined>(undefined);

const emptyState: OrderSubmissionState = { phase: 'idle', key: null, body: null, result: null, error: null,
  fieldErrors: {}, cartHandled: false };

export function OrderSubmissionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OrderSubmissionState>(emptyState);
  const inFlightRef = useRef(false);
  const sequenceRef = useRef(0);

  const run = useCallback(async (key: string, body: CreateOrderBody, sequence: number, isRetry: boolean) => {
    setState((prev) => ({ ...prev, phase: 'pending', key, body, error: null, fieldErrors: {} }));
    try {
      const result = await ordersApi.create(key, body);
      if (sequence !== sequenceRef.current) return;
      setState((prev) => ({ ...prev, phase: 'confirmed', result, error: null }));
    } catch (cause) {
      if (sequence !== sequenceRef.current) return;
      if (cause instanceof ApiError && isDefiniteOrderError(cause)) {
        // A 429 during a retry proves nothing: the original request may already have committed while
        // this attempt only tripped the rate limiter (m4.3.1 review fix 5) — stay unknown and keep
        // the exact command so the shopper can wait and send it again. Every other definite 4xx
        // (quote changed, out of stock, validation) was rolled back before anything was written.
        if (isRetry && cause.code === 'RATE_LIMITED') {
          setState((prev) => ({ ...prev, phase: 'unknown',
            error: 'Hệ thống đang quá tải. Vui lòng đợi một lúc rồi bấm “Gửi lại”.' }));
          return;
        }
        const fieldErrors = Object.fromEntries(cause.fieldErrors.map((field) => [field.field, field.message]));
        setState((prev) => ({ ...prev, phase: 'failed', error: cause.message, fieldErrors }));
      } else {
        // Network loss, 5xx or a malformed 2xx: the server may have committed — keep the exact command.
        setState((prev) => ({ ...prev, phase: 'unknown',
          error: cause instanceof ApiError && cause.code === 'INVALID_RESPONSE'
            ? cause.message
            : 'Không nhận được kết quả đặt hàng. Đơn có thể đã được tạo — bấm “Gửi lại” để kiểm tra an toàn.' }));
      }
    } finally {
      if (sequence === sequenceRef.current) inFlightRef.current = false;
    }
  }, []);

  const submit = useCallback(async (body: CreateOrderBody) => {
    if (inFlightRef.current || state.phase === 'pending' || state.phase === 'unknown') return;
    inFlightRef.current = true;
    const sequence = ++sequenceRef.current;
    await run(crypto.randomUUID(), body, sequence, false);
  }, [run, state.phase]);

  const retry = useCallback(async () => {
    if (inFlightRef.current || state.phase !== 'unknown' || !state.key || !state.body) return;
    inFlightRef.current = true;
    const sequence = ++sequenceRef.current;
    await run(state.key, state.body, sequence, true);
  }, [run, state.phase, state.key, state.body]);

  const reset = useCallback(() => {
    if (inFlightRef.current || state.phase === 'pending' || state.phase === 'unknown') return;
    setState(emptyState);
  }, [state.phase]);

  const dismiss = useCallback(() => {
    // A pending or unclear intent must not be silently discarded: the shopper first resolves it
    // through Gửi lại (unknown) or waits for the response (pending).
    if (inFlightRef.current || state.phase === 'pending' || state.phase === 'unknown') return;
    setState(emptyState);
  }, [state.phase]);

  const markCartHandled = useCallback(() => {
    setState((prev) => prev.phase === 'confirmed' && !prev.cartHandled ? { ...prev, cartHandled: true } : prev);
  }, []);

  // An unsettled intent must not die silently on reload/close; the response-loss path explains itself.
  useEffect(() => {
    if (state.phase !== 'pending' && state.phase !== 'unknown') return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [state.phase]);

  const value = useMemo(() => ({ ...state, submit, retry, reset, dismiss, markCartHandled }),
    [state, submit, retry, reset, dismiss, markCartHandled]);
  return <OrderSubmissionContext.Provider value={value}>{children}</OrderSubmissionContext.Provider>;
}

export function useOrderSubmission(): OrderSubmissionContextValue {
  const context = useContext(OrderSubmissionContext);
  if (!context) throw new Error('OrderSubmissionProvider is missing around the checkout feature.');
  return context;
}

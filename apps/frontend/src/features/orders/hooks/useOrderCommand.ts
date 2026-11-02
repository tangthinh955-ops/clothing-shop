import { useRef, useState } from 'react';
import { ApiError } from '../../../shared/api/client';

const CONNECTION_MESSAGE = 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.';

export type OrderCommandOutcome =
  | { kind: 'idle' }
  // The request may have been applied server-side: only the same key and content may be resent.
  | { kind: 'unconfirmed'; message: string }
  // The server refused for good, usually because the order changed: the admin needs a fresh view.
  | { kind: 'refused'; message: string };

type Perform = (idempotencyKey: string) => Promise<unknown>;

// One action on an order, by an admin or the customer: blocks a second send while one is in flight, and keeps the key and
// the exact request until the action is finished, so a resend can never apply a different command.
export function useOrderCommand(onFinished: () => void) {
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<OrderCommandOutcome>({ kind: 'idle' });
  const busy = useRef(false);
  const key = useRef(crypto.randomUUID());
  const sent = useRef<Perform | null>(null);

  function finish() {
    key.current = crypto.randomUUID();
    sent.current = null;
    setOutcome({ kind: 'idle' });
    onFinished();
  }

  function send(perform: Perform) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    sent.current = perform;
    perform(key.current)
      .then(() => finish())
      .catch((cause: unknown) => {
        const refused = cause instanceof ApiError && cause.status >= 400 && cause.status < 500;
        const message = cause instanceof ApiError ? cause.message : CONNECTION_MESSAGE;
        setOutcome({ kind: refused ? 'refused' : 'unconfirmed', message });
      })
      .finally(() => {
        busy.current = false;
        setPending(false);
      });
  }

  function resend() {
    if (sent.current) send(sent.current);
  }

  function leave(close: () => void) {
    if (busy.current) return;
    // After an unclear result the order may already have moved, so the page must not stay stale.
    if (outcome.kind === 'idle') close();
    else finish();
  }

  return { pending, outcome, send, resend, finish, leave };
}

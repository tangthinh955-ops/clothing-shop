import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack } from '@mui/material';
import { useRef, useState } from 'react';
import { ApiError } from '../../../../shared/api/client';
import { adminOrdersApi, type AdminOrderDetail } from '../api/admin-orders.api';

const CONNECTION_MESSAGE = 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.';

type Outcome =
  | { kind: 'idle' }
  // The request may have been applied server-side: only the same key and version may be resent.
  | { kind: 'unconfirmed'; message: string }
  // The server refused for good, usually because the order changed: the admin needs a fresh view.
  | { kind: 'refused'; message: string };

interface OrderActionsProps {
  order: AdminOrderDetail;
  onChanged: () => unknown;
}

// The status never goes back, so the action asks once more instead of firing on a mistaken tap.
export function OrderActions({ order, onChanged }: OrderActionsProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });
  const busy = useRef(false);
  const key = useRef(crypto.randomUUID());
  const sentVersion = useRef(order.version);

  if (order.status !== 'PENDING' || order.method !== 'COD') return null;

  function send(expectedVersion: number) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    sentVersion.current = expectedVersion;
    adminOrdersApi.confirm(order.id, expectedVersion, key.current)
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

  function finish() {
    key.current = crypto.randomUUID();
    setOutcome({ kind: 'idle' });
    setOpen(false);
    void onChanged();
  }

  function leave() {
    if (busy.current) return;
    // After an unclear result the order may already have moved, so the page must not stay stale.
    if (outcome.kind === 'idle') setOpen(false);
    else finish();
  }

  return <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
    <Button variant="contained" onClick={() => setOpen(true)}>Xác nhận đơn</Button>
    <Dialog open={open} onClose={leave} aria-labelledby="confirm-order-title" fullWidth maxWidth="xs">
      <DialogTitle id="confirm-order-title" sx={{ overflowWrap: 'anywhere' }}>Xác nhận đơn {order.code}?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Đơn chuyển sang “Đã xác nhận” và không quay lại được. Hàng vẫn đang được giữ, chưa ghi nhận tiền.
        </DialogContentText>
        {outcome.kind !== 'idle' && <Alert severity="error" sx={{ mt: 2 }}>{outcome.message}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={leave} disabled={pending}>Để sau</Button>
        {outcome.kind === 'idle' && <Button variant="contained" disabled={pending} onClick={() => send(order.version)}>Xác nhận</Button>}
        {outcome.kind === 'unconfirmed' && <Button variant="contained" disabled={pending} onClick={() => send(sentVersion.current)}>Gửi lại</Button>}
        {outcome.kind === 'refused' && <Button variant="contained" onClick={finish}>Tải lại đơn</Button>}
      </DialogActions>
    </Dialog>
  </Stack>;
}

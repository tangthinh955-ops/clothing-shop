import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';
import { useState } from 'react';
import { adminOrdersApi, type AdminOrderDetail } from '../api/admin-orders.api';
import { useOrderCommand } from '../hooks/useOrderCommand';

const MIN_REASON_LENGTH = 3;
const MAX_REASON_LENGTH = 500;

interface OrderCancelActionProps {
  order: AdminOrderDetail;
  onChanged: () => unknown;
}

// The reason is part of the command: after an unclear result the field locks so a resend carries the same text.
export function OrderCancelAction({ order, onChanged }: OrderCancelActionProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [fieldError, setFieldError] = useState('');
  const command = useOrderCommand(() => {
    setOpen(false);
    void onChanged();
  });
  const { outcome, pending } = command;

  const leave = () => command.leave(() => setOpen(false));

  function submit() {
    const reason = draft.trim();
    if (reason.length < MIN_REASON_LENGTH) {
      setFieldError(`Nhập lý do từ ${MIN_REASON_LENGTH} đến ${MAX_REASON_LENGTH} ký tự.`);
      return;
    }
    setFieldError('');
    command.send((key) => adminOrdersApi.cancel(order.id, order.version, reason, key));
  }

  return <>
    <Button variant="outlined" color="error" onClick={() => setOpen(true)}>Hủy đơn</Button>
    <Dialog open={open} onClose={leave} aria-labelledby="cancel-order-title" fullWidth maxWidth="xs">
      <DialogTitle id="cancel-order-title" sx={{ overflowWrap: 'anywhere' }}>Hủy đơn {order.code}?</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Hàng đang giữ được trả lại để bán tiếp. Đơn đã hủy không mở lại được.
          Khách sẽ thấy lý do này; nội dung chỉ dành cho shop hãy ghi vào ghi chú nội bộ.
        </DialogContentText>
        <TextField label="Lý do hủy" required fullWidth multiline minRows={2} value={draft}
          disabled={pending || outcome.kind !== 'idle'} onChange={(event) => setDraft(event.target.value)} error={fieldError !== ''}
          helperText={fieldError} slotProps={{ htmlInput: { maxLength: MAX_REASON_LENGTH } }} />
        {outcome.kind !== 'idle' && <Alert severity="error" sx={{ mt: 2 }}>{outcome.message}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={leave} disabled={pending}>Để sau</Button>
        {outcome.kind === 'idle' && <Button variant="contained" color="error" disabled={pending} onClick={submit}>Hủy đơn</Button>}
        {outcome.kind === 'unconfirmed' && <Button variant="contained" disabled={pending} onClick={command.resend}>Gửi lại</Button>}
        {outcome.kind === 'refused' && <Button variant="contained" onClick={command.finish}>Tải lại đơn</Button>}
      </DialogActions>
    </Dialog>
  </>;
}

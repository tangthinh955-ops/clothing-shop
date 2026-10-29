import { Alert, Box, Button, Dialog, DialogContent, DialogContentText, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../../../shared/api/client';
import type { AdjustmentInput, AdjustmentResult, InventoryItem } from '../api/inventory.api';

interface Props {
  stock: InventoryItem;
  onSave: (input: AdjustmentInput, idempotencyKey: string) => Promise<AdjustmentResult>;
  onReload: () => void;
  onClose: () => void;
}

// A lost response may still have been committed server-side, so locked states below only allow
// replaying the exact same key/body/version or closing and refetching stock — never editing content.
const MAX_DELTA = 1_000_000;

type Outcome =
  | { kind: 'editing' }
  | { kind: 'saved'; result: AdjustmentResult }
  | { kind: 'unconfirmed'; message: string }
  | { kind: 'conflict'; message: string };

export function AdjustmentDialog({ stock, onSave, onReload, onClose }: Props) {
  const key = useRef(crypto.randomUUID()).current;
  // Row snapshot frozen like the product editor: a background refetch must not rebase expectedVersion.
  const [snapshot] = useState(stock);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ delta?: string; reason?: string }>({});
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'editing' });
  const busy = useRef(false);
  const sentInput = useRef<AdjustmentInput | null>(null);

  function setBusy(value: boolean) {
    busy.current = value;
    setPending(value);
  }

  function close() {
    if (busy.current) return;
    // Escape/backdrop after an unconfirmed or conflicting save must not leave stale stock behind.
    if (outcome.kind === 'unconfirmed' || outcome.kind === 'conflict') onReload();
    else onClose();
  }

  function send(input: AdjustmentInput) {
    if (busy.current) return;
    setBusy(true);
    onSave(input, key)
      .then((result) => { setOutcome({ kind: 'saved', result }); setBusy(false); })
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.status === 409) setOutcome({ kind: 'conflict', message: cause.message });
        else setOutcome({ kind: 'unconfirmed',
          message: cause instanceof ApiError ? cause.message : 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.' });
        setBusy(false);
      });
  }

  function validate(): { input: AdjustmentInput | null; errors: { delta?: string; reason?: string } } {
    const trimmedDelta = delta.trim();
    const trimmedReason = reason.trim();
    const errors: { delta?: string; reason?: string } = {};
    const value = Number(trimmedDelta);
    if (!/^[+-]?\d+$/.test(trimmedDelta)) errors.delta = 'Nhập số nguyên khác 0, ví dụ 5 hoặc -3.';
    else if (value === 0) errors.delta = 'Số lượng thay đổi phải khác 0.';
    else if (Math.abs(value) > MAX_DELTA) errors.delta = 'Phạm vi thay đổi tối đa ±1.000.000.';
    if (trimmedReason.length < 3) errors.reason = 'Lý do cần ít nhất 3 ký tự.';
    else if (trimmedReason.length > 300) errors.reason = 'Lý do tối đa 300 ký tự.';
    if (errors.delta || errors.reason) return { input: null, errors };
    return {
      input: { variantId: snapshot.variantId, delta: value, reason: trimmedReason, expectedVersion: snapshot.version },
      errors: {},
    };
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || outcome.kind !== 'editing') return;
    const { input, errors } = validate();
    setFieldErrors(errors);
    if (!input) return;
    sentInput.current = input;
    send(input);
  }

  function resend() {
    if (busy.current || !sentInput.current) return;
    setFieldErrors({});
    send(sentInput.current);
  }

  const locked = pending || outcome.kind !== 'editing';
  const unconfirmed = outcome.kind === 'unconfirmed';

  return <Dialog open onClose={close} fullWidth maxWidth="sm" aria-labelledby="adjust-inventory-title">
    <DialogTitle id="adjust-inventory-title">Điều chỉnh {snapshot.sku}</DialogTitle>
    <DialogContent>
      <Box component="form" noValidate onSubmit={submit}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <DialogContentText>{snapshot.productName}</DialogContentText>
          <DialogContentText>{snapshot.size} · {snapshot.color}</DialogContentText>
          <DialogContentText>Còn bán: {snapshot.available}</DialogContentText>
          <DialogContentText>Tồn thực có {snapshot.onHand}, đang giữ {snapshot.reserved}</DialogContentText>
          <TextField label="Số lượng thay đổi" name="delta" value={delta} disabled={locked} autoComplete="off"
            onChange={(event) => setDelta(event.target.value)} error={Boolean(fieldErrors.delta)}
            helperText={fieldErrors.delta ?? 'Số âm để xuất kho, ví dụ -3. Khác 0.'}
            slotProps={{ htmlInput: { inputMode: 'numeric' as const, maxLength: 9 } }} />
          <TextField label="Lý do điều chỉnh" name="reason" value={reason} multiline minRows={2} disabled={locked}
            onChange={(event) => setReason(event.target.value)} error={Boolean(fieldErrors.reason)}
            helperText={fieldErrors.reason ?? '3–300 ký tự.'} slotProps={{ htmlInput: { maxLength: 300 } }} />
          {outcome.kind === 'conflict' && <Alert severity="error">{outcome.message}</Alert>}
          {unconfirmed && <Alert severity="error">
            {outcome.message} Không rõ máy chủ đã ghi điều chỉnh chưa — không sửa nội dung, hãy gửi lại đúng phần cũ hoặc tải lại tồn.
          </Alert>}
          {outcome.kind === 'saved' && <Stack spacing={1}>
            <Alert severity="success">Đã lưu điều chỉnh tồn kho.</Alert>
            <Typography role="status">Khả dụng: {outcome.result.available}</Typography>
          </Stack>}
          <Stack direction="row" useFlexGap sx={{ gap: 1.5, flexWrap: 'wrap' }}>
            {outcome.kind === 'saved' && <Button variant="contained" onClick={onClose}>Đóng</Button>}
            {outcome.kind === 'editing' && <>
              <Button type="submit" variant="contained" disabled={pending}>Lưu điều chỉnh</Button>
              <Button type="button" variant="text" disabled={pending} onClick={close}>Hủy</Button>
            </>}
            {(unconfirmed || outcome.kind === 'conflict') && <>
              {unconfirmed && <Button variant="contained" disabled={pending} onClick={resend}>Gửi lại</Button>}
              <Button variant="outlined" disabled={pending} onClick={onReload}>Đóng và tải lại tồn</Button>
            </>}
          </Stack>
        </Stack>
      </Box>
    </DialogContent>
  </Dialog>;
}

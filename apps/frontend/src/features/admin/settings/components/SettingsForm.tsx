import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Stack, TextField, Typography,
} from '@mui/material';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ApiError } from '../../../../shared/api/client';
import type { AdminSettings, SettingsUpdateInput } from '../api/settings.api';

interface Props {
  disabled?: boolean;
  // Configuration snapshot frozen by the component itself: a background refetch changes props only,
  // never the expectedVersion under an ongoing edit — only a save response or a confirmed reload does.
  snapshot: AdminSettings;
  onSave: (input: SettingsUpdateInput, idempotencyKey: string) => Promise<AdminSettings>;
  // Called only after the user confirms discarding the draft; the page refetches and remounts.
  onDiscardReload: () => void;
}

// A lost response may still have been committed server-side, so locked states below only allow
// replaying the exact same command or reloading the configuration — never editing content.
const FEE_MAX = 100_000_000;
const DEADLINE_MIN = 15;
const DEADLINE_MAX = 2880;

type Draft = Record<'shippingFeeVnd' | 'bankDeadlineMinutes' | 'bankName' | 'bankBin' | 'bankAccountNumber' | 'bankAccountName', string>;

type Outcome =
  | { kind: 'editing' }
  | { kind: 'saved'; result: AdminSettings }
  | { kind: 'unconfirmed'; message: string }
  | { kind: 'conflict'; message: string }
  // Definitive rejections (e.g. 400/401/403): nothing may have been written, so editing may go on.
  | { kind: 'rejected'; message: string };

const toDraft = (settings: AdminSettings): Draft => ({
  shippingFeeVnd: String(settings.shippingFeeVnd),
  bankDeadlineMinutes: String(settings.bankDeadlineMinutes),
  bankName: settings.bankName ?? '',
  bankBin: settings.bankBin ?? '',
  bankAccountNumber: settings.bankAccountNumber ?? '',
  bankAccountName: settings.bankAccountName ?? '',
});

/** A failure whose server outcome cannot be known (network, unreadable body, 5xx) must lock content. */
const isUnconfirmed = (error: ApiError): boolean =>
  error.status === 0 || error.status >= 500 || error.code === 'NETWORK_ERROR' ||
  error.code === 'INVALID_RESPONSE' || error.code === 'SERVICE_UNAVAILABLE';

const BANK_FIELDS = ['bankName', 'bankBin', 'bankAccountNumber', 'bankAccountName'] as const;

export function SettingsForm({ snapshot, onSave, onDiscardReload, disabled = false }: Props) {
  const [baseline, setBaseline] = useState(snapshot);
  const [draft, setDraft] = useState(() => toDraft(snapshot));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'editing' });
  const [confirmingReload, setConfirmingReload] = useState(false);
  const busy = useRef(false);
  // The key is created when a deliberate save starts; a resend must replay exactly this command.
  const sentCommand = useRef<{ input: SettingsUpdateInput; key: string } | null>(null);

  function setBusy(value: boolean) {
    busy.current = value;
    setPending(value);
  }

  function patch(name: keyof Draft) {
    return (event: ChangeEvent<HTMLInputElement>) =>
      setDraft((current) => ({ ...current, [name]: event.target.value }));
  }

  function validate(): { input: SettingsUpdateInput | null; errors: Partial<Record<keyof Draft, string>> } {
    const fee = draft.shippingFeeVnd.trim();
    const deadline = draft.bankDeadlineMinutes.trim();
    const bankName = draft.bankName.trim();
    const bankBin = draft.bankBin.trim();
    const bankAccountNumber = draft.bankAccountNumber.trim();
    const bankAccountName = draft.bankAccountName.trim();
    const bank = { bankName, bankBin, bankAccountNumber, bankAccountName };
    const errors: Partial<Record<keyof Draft, string>> = {};
    if (!/^\d+$/.test(fee)) errors.shippingFeeVnd = 'Phí giao hàng phải là số nguyên.';
    else if (Number(fee) > FEE_MAX) errors.shippingFeeVnd = 'Phí giao hàng từ 0 đến 100.000.000 VNĐ.';
    if (!/^\d+$/.test(deadline)) errors.bankDeadlineMinutes = 'Hạn chuyển khoản phải là số nguyên.';
    else if (Number(deadline) < DEADLINE_MIN || Number(deadline) > DEADLINE_MAX) errors.bankDeadlineMinutes = 'Hạn chuyển khoản từ 15 đến 2880 phút.';
    // The bank group is complete-or-empty as a whole, so a gap is flagged on every field of it.
    const emptyBankFields = BANK_FIELDS.filter((name) => bank[name] === '');
    if (emptyBankFields.length > 0 && emptyBankFields.length < BANK_FIELDS.length) {
      for (const name of emptyBankFields) errors[name] = 'Điền đủ 4 trường ngân hàng hoặc để trống toàn bộ.';
    }
    if (!errors.bankBin && bankBin && !/^\d{6}$/.test(bankBin)) errors.bankBin = 'Mã BIN phải gồm 6 chữ số.';
    if (!errors.bankAccountNumber && bankAccountNumber && !/^\d{1,32}$/.test(bankAccountNumber)) {
      errors.bankAccountNumber = 'Số tài khoản chỉ gồm chữ số.';
    }
    if (Object.keys(errors).length > 0) return { input: null, errors };
    return {
      input: { shippingFeeVnd: Number(fee), bankDeadlineMinutes: Number(deadline), ...bank, expectedVersion: baseline.version },
      errors: {},
    };
  }

  function send(command: { input: SettingsUpdateInput; key: string }) {
    if (busy.current || disabled) return;
    setBusy(true);
    onSave(command.input, command.key)
      .then((result) => {
        // The server response is the authority: adopt it as the new baseline (normalized values,
        // bumped version) so a following edit saves against the version that was really stored.
        setBaseline(result);
        setDraft(toDraft(result));
        setFieldErrors({});
        setOutcome({ kind: 'saved', result });
        setBusy(false);
      })
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.status === 409) setOutcome({ kind: 'conflict', message: cause.message });
        else if (cause instanceof ApiError && isUnconfirmed(cause)) setOutcome({ kind: 'unconfirmed', message: cause.message });
        else if (cause instanceof ApiError) setOutcome({ kind: 'rejected', message: cause.message });
        else setOutcome({ kind: 'unconfirmed', message: 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.' });
        setBusy(false);
      });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const editable = outcome.kind === 'editing' || outcome.kind === 'saved' || outcome.kind === 'rejected';
    if (busy.current || disabled || !editable) return;
    const { input, errors } = validate();
    setFieldErrors(errors);
    if (!input) return;
    setOutcome({ kind: 'editing' });
    const command = { input, key: crypto.randomUUID() };
    sentCommand.current = command;
    send(command);
  }

  function resend() {
    if (busy.current || disabled || !sentCommand.current) return;
    setFieldErrors({});
    send(sentCommand.current);
  }

  const busyNow = pending || disabled;
  const locked = busyNow || outcome.kind === 'unconfirmed' || outcome.kind === 'conflict';

  return <Box component="form" noValidate onSubmit={submit}>
    <Stack spacing={2}>
      <Typography component="h2" variant="h5">Bán hàng</Typography>
      <TextField label="Phí giao hàng" name="shippingFeeVnd" value={draft.shippingFeeVnd} disabled={locked}
        onChange={patch('shippingFeeVnd')} error={Boolean(fieldErrors.shippingFeeVnd)}
        helperText={fieldErrors.shippingFeeVnd ?? 'VNĐ, từ 0 đến 100.000.000. Áp dụng cho đơn mới.'}
        slotProps={{ htmlInput: { inputMode: 'numeric' as const, maxLength: 9 } }} />
      <TextField label="Hạn chuyển khoản" name="bankDeadlineMinutes" value={draft.bankDeadlineMinutes} disabled={locked}
        onChange={patch('bankDeadlineMinutes')} error={Boolean(fieldErrors.bankDeadlineMinutes)}
        helperText={fieldErrors.bankDeadlineMinutes ?? 'Phút, từ 15 đến 2880 (tối đa 48 giờ). Áp dụng cho đơn mới.'}
        slotProps={{ htmlInput: { inputMode: 'numeric' as const, maxLength: 4 } }} />
      <TextField label="Tên ngân hàng" name="bankName" value={draft.bankName} disabled={locked}
        onChange={patch('bankName')} error={Boolean(fieldErrors.bankName)}
        helperText={fieldErrors.bankName ?? 'Tối đa 120 ký tự. Để trống cả 4 trường ngân hàng nếu không dùng chuyển khoản.'}
        slotProps={{ htmlInput: { maxLength: 120 } }} />
      <TextField label="Mã BIN" name="bankBin" value={draft.bankBin} disabled={locked}
        onChange={patch('bankBin')} error={Boolean(fieldErrors.bankBin)}
        helperText={fieldErrors.bankBin ?? '6 chữ số, ví dụ 970422.'}
        slotProps={{ htmlInput: { inputMode: 'numeric' as const, maxLength: 6 } }} />
      <TextField label="Số tài khoản" name="bankAccountNumber" value={draft.bankAccountNumber} disabled={locked}
        onChange={patch('bankAccountNumber')} error={Boolean(fieldErrors.bankAccountNumber)}
        helperText={fieldErrors.bankAccountNumber ?? 'Chỉ chữ số, tối đa 32 ký tự. Số 0 đầu vẫn được giữ.'}
        slotProps={{ htmlInput: { inputMode: 'numeric' as const, maxLength: 32 } }} />
      <TextField label="Tên chủ tài khoản" name="bankAccountName" value={draft.bankAccountName} disabled={locked}
        onChange={patch('bankAccountName')} error={Boolean(fieldErrors.bankAccountName)}
        helperText={fieldErrors.bankAccountName ?? 'In hoa theo tài khoản ngân hàng, tối đa 120 ký tự.'}
        slotProps={{ htmlInput: { maxLength: 120 } }} />
      {pending && <Typography role="status">Đang lưu cài đặt…</Typography>}
      {outcome.kind === 'conflict' && <Alert severity="error">{outcome.message}</Alert>}
      {outcome.kind === 'unconfirmed' && <Alert severity="error">
        {outcome.message} Không rõ máy chủ đã lưu cài đặt chưa — không sửa nội dung, hãy gửi lại đúng phần cũ hoặc tải cấu hình mới.
      </Alert>}
      {outcome.kind === 'rejected' && <Alert severity="error">{outcome.message}</Alert>}
      {outcome.kind === 'saved' && <Alert severity="success">Đã lưu cài đặt. Cấu hình mới áp dụng cho các đơn mới.</Alert>}
      <Typography variant="body2" color="text.secondary">
        Cấu hình mới áp dụng cho các đơn mới; báo giá và đơn hàng đã tạo giữ nguyên theo cấu hình tại thời điểm tạo (phiên bản {baseline.version}).
      </Typography>
      <Stack direction="row" useFlexGap sx={{ gap: 1.5, flexWrap: 'wrap' }}>
        {(outcome.kind === 'editing' || outcome.kind === 'saved' || outcome.kind === 'rejected') &&
          <Button type="submit" variant="contained" disabled={busyNow}>Lưu cài đặt</Button>}
        {outcome.kind === 'unconfirmed' && <Button variant="contained" disabled={busyNow} onClick={resend}>Gửi lại</Button>}
        <Button variant="outlined" disabled={busyNow} onClick={() => setConfirmingReload(true)}>Tải cấu hình mới</Button>
      </Stack>
    </Stack>
    <Dialog open={confirmingReload} onClose={() => setConfirmingReload(false)} fullWidth maxWidth="xs"
      aria-labelledby="reload-settings-title">
      <DialogTitle id="reload-settings-title">Tải cấu hình mới?</DialogTitle>
      <DialogContent>
        <DialogContentText>Nội dung đang sửa chưa được lưu. Tải cấu hình mới sẽ xoá nội dung này và lấy phiên bản hiện tại từ máy chủ.</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button disabled={busyNow} onClick={() => setConfirmingReload(false)}>Tiếp tục chỉnh sửa</Button>
        <Button variant="contained" disabled={busyNow} onClick={() => {
          if (busy.current || disabled) return;
          setConfirmingReload(false); onDiscardReload();
        }}>Xoá và tải cấu hình mới</Button>
      </DialogActions>
    </Dialog>
  </Box>;
}

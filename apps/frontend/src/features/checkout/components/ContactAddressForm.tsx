import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useId } from 'react';
import type { ContactDraft } from '../hooks/useCreateOrder';

export interface ContactDraftErrors {
  name?: string;
  phone?: string;
  email?: string;
  province?: string;
  ward?: string;
  addressLine?: string;
}

const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
// The wire format is the backend's one normalization; the form only pre-checks obvious mistakes.
export const phoneIsPlausible = (raw: string) => /^(\+?84|0)[\d\s.\-()]{8,14}$/.test(raw);

/** Client-side mirror of the backend rules; the server re-validates everything at runtime. */
export function validateContactDraft(draft: ContactDraft): ContactDraftErrors {
  const errors: ContactDraftErrors = {};
  if (draft.name.trim().length < 2 || draft.name.trim().length > 120) errors.name = 'Họ tên từ 2 đến 120 ký tự.';
  if (!phoneIsPlausible(draft.phone)) errors.phone = 'Số điện thoại Việt Nam chưa hợp lệ.';
  if (draft.email.trim() && (draft.email.trim().length > 254 || !EMAIL_PATTERN.test(draft.email.trim()))) {
    errors.email = 'Email chưa hợp lệ.';
  }
  if (draft.province.trim().length < 2 || draft.province.trim().length > 100) errors.province = 'Tỉnh/thành từ 2 đến 100 ký tự.';
  if (draft.ward.trim().length < 2 || draft.ward.trim().length > 100) errors.ward = 'Phường/xã từ 2 đến 100 ký tự.';
  if (draft.addressLine.trim().length < 5 || draft.addressLine.trim().length > 255) errors.addressLine = 'Địa chỉ cụ thể từ 5 đến 255 ký tự.';
  return errors;
}

interface Props {
  value: ContactDraft;
  disabled: boolean;
  /** Server field errors keyed like `contact.name` / `address.province` from the API contract. */
  serverErrors: Record<string, string>;
  /** Live draft changes bubble up so the page keeps the draft across failed submissions. */
  onChange: (draft: ContactDraft) => void;
  onSubmit: (draft: ContactDraft) => void;
  /** The submit button lives INSIDE the form element: no form-attribute association quirks. */
  submitDisabled: boolean;
  submitLabel: string;
  showDraftErrors: boolean;
}

/** Controlled recipient form: the page owns the draft, the form owns layout and pre-validation. */
export function ContactAddressForm({ value, disabled, serverErrors, onChange, onSubmit,
  submitDisabled, submitLabel, showDraftErrors }: Props) {
  const id = useId();
  const errors = validateContactDraft(value);
  const showError = (field: keyof ContactDraftErrors, serverField: string): string | undefined =>
    serverErrors[serverField] ?? errors[field];

  const update = (field: keyof ContactDraft) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ ...value, [field]: event.target.value });

  return <Box component="form" id="checkout-contact-form" aria-label="Thông tin nhận hàng" aria-busy={disabled}
    sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
    onSubmit={(event) => {
      event.preventDefault();
      onSubmit(value);
    }}>
    <Typography component="h3" variant="h5">Thông tin nhận hàng</Typography>
    <TextField id={`${id}-name`} label="Họ tên" value={value.name} disabled={disabled}
      onChange={update('name')} error={Boolean(showError('name', 'contact.name'))}
      helperText={showError('name', 'contact.name') ?? 'Nhập họ tên người nhận.'}
      slotProps={{ htmlInput: { required: true, maxLength: 120, autoComplete: 'name' } }} />
    <TextField id={`${id}-phone`} label="Số điện thoại" value={value.phone} disabled={disabled}
      onChange={update('phone')} error={Boolean(showError('phone', 'contact.phone'))}
      helperText={showError('phone', 'contact.phone') ?? 'Ví dụ 0901234567 hoặc +84901234567.'}
      slotProps={{ htmlInput: { required: true, inputMode: 'tel', autoComplete: 'tel', maxLength: 20 } }} />
    <TextField id={`${id}-email`} label="Email (không bắt buộc)" value={value.email} disabled={disabled}
      onChange={update('email')} error={Boolean(showError('email', 'contact.email'))}
      helperText={showError('email', 'contact.email') ?? 'Để nhận thông tin đơn nếu muốn.'}
      slotProps={{ htmlInput: { type: 'email', autoComplete: 'email', maxLength: 254 } }} />
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <TextField id={`${id}-province`} label="Tỉnh/thành" value={value.province} disabled={disabled} sx={{ flex: 1 }}
        onChange={update('province')} error={Boolean(showError('province', 'address.province'))}
        helperText={showError('province', 'address.province')}
        slotProps={{ htmlInput: { required: true, maxLength: 100 } }} />
      <TextField id={`${id}-district`} label="Quận/huyện (không bắt buộc)" value={value.district} disabled={disabled} sx={{ flex: 1 }}
        onChange={update('district')} slotProps={{ htmlInput: { maxLength: 100 } }} />
    </Stack>
    <TextField id={`${id}-ward`} label="Phường/xã" value={value.ward} disabled={disabled}
      onChange={update('ward')} error={Boolean(showError('ward', 'address.ward'))}
      helperText={showError('ward', 'address.ward')}
      slotProps={{ htmlInput: { required: true, maxLength: 100 } }} />
    <TextField id={`${id}-addressLine`} label="Địa chỉ cụ thể" value={value.addressLine} disabled={disabled}
      onChange={update('addressLine')} error={Boolean(showError('addressLine', 'address.addressLine'))}
      helperText={showError('addressLine', 'address.addressLine') ?? 'Số nhà, tên đường…'}
      slotProps={{ htmlInput: { required: true, maxLength: 255, autoComplete: 'street-address' } }} />
    <TextField id={`${id}-note`} label="Ghi chú (không bắt buộc)" value={value.note} disabled={disabled} multiline minRows={2}
      onChange={update('note')} slotProps={{ htmlInput: { maxLength: 500 } }} />
    {showDraftErrors && <Alert severity="error">Thông tin nhận hàng chưa hợp lệ — hãy kiểm tra các ô được đánh dấu.</Alert>}
    <Button type="submit" variant="contained" size="large" disabled={submitDisabled}>{submitLabel}</Button>
    <Typography variant="body2" color="text.secondary">
      Đặt hàng không cần tài khoản. Thông tin chỉ dùng để giao hàng và liên hệ.
    </Typography>
  </Box>;
}

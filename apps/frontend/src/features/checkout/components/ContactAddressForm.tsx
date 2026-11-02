import { Alert, Autocomplete, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useId, useRef, useState } from 'react';
import { isProvinceName, PROVINCE_NAMES, searchableText } from '../vietnam-provinces';
import type { ContactDraft } from '../hooks/useCreateOrder';

export interface ContactDraftErrors {
  name?: string;
  phone?: string;
  email?: string;
  province?: string;
  ward?: string;
  addressLine?: string;
}

type ErrorField = keyof ContactDraftErrors;

/** Focus order for the first invalid field after a submit attempt. */
const FIELD_ORDER: readonly ErrorField[] = ['name', 'phone', 'email', 'province', 'ward', 'addressLine'];

const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
// The wire format is the backend's one normalization; the form only pre-checks obvious mistakes.
export const phoneIsPlausible = (raw: string) => /^(\+?84|0)[\d\s.\-()]{8,14}$/.test(raw);

/**
 * Client-side mirror of the backend rules; the server re-validates everything at runtime.
 * `provinceInput` is the visible search text: a committed option is not enough when the shopper
 * has typed something else over it.
 */
export function validateContactDraft(draft: ContactDraft,
  provinceInput: string = draft.provinceInput ?? draft.province): ContactDraftErrors {
  const errors: ContactDraftErrors = {};
  if (draft.name.trim().length < 2 || draft.name.trim().length > 120) errors.name = 'Họ tên từ 2 đến 120 ký tự.';
  if (!phoneIsPlausible(draft.phone)) errors.phone = 'Số điện thoại Việt Nam chưa hợp lệ.';
  if (draft.email.trim() && (draft.email.trim().length > 254 || !EMAIL_PATTERN.test(draft.email.trim()))) {
    errors.email = 'Email chưa hợp lệ.';
  }
  // Free text is no longer enough: the shopper must pick one of the 34 current provinces, and the
  // visible input must still be that pick rather than a half-typed search left behind.
  if (!isProvinceName(draft.province.trim()) || draft.province.trim() !== provinceInput.trim()) {
    errors.province = 'Chọn tỉnh/thành từ danh sách.';
  }
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
}

/**
 * Controlled recipient form: the page owns the draft, the form owns layout, pre-validation and the
 * timing of error messages. A field stays quiet until the shopper leaves it or submits; the submit
 * button is available on purpose so an incomplete draft can reveal what is missing.
 */
export function ContactAddressForm({ value, disabled, serverErrors, onChange, onSubmit,
  submitDisabled, submitLabel }: Props) {
  const id = useId();
  const [touched, setTouched] = useState<Partial<Record<ErrorField, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const provinceInput = value.provinceInput ?? value.province;
  // A server error stays visible only until the shopper edits the field it belongs to.
  const [editedFields, setEditedFields] = useState<Partial<Record<keyof ContactDraft, boolean>>>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const provinceRef = useRef<HTMLInputElement>(null);
  const wardRef = useRef<HTMLInputElement>(null);
  const addressLineRef = useRef<HTMLInputElement>(null);
  const fieldRefs: Record<ErrorField, React.RefObject<HTMLInputElement | null>> = {
    name: nameRef, phone: phoneRef, email: emailRef, province: provinceRef, ward: wardRef,
    addressLine: addressLineRef,
  };

  const errors = validateContactDraft(value, provinceInput);
  const hasErrors = Object.keys(errors).length > 0;
  const fieldError = (field: ErrorField, serverField: string): string | undefined => {
    const serverError = serverErrors[serverField];
    if (serverError && !editedFields[field]) return serverError;
    return touched[field] || submitAttempted ? errors[field] : undefined;
  };
  const touch = (field: ErrorField) => () =>
    setTouched((current) => (current[field] ? current : { ...current, [field]: true }));
  const markEdited = (field: keyof ContactDraft) =>
    setEditedFields((current) => (current[field] ? current : { ...current, [field]: true }));

  const update = (field: keyof ContactDraft) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      markEdited(field);
      onChange({ ...value, [field]: event.target.value });
    };

  /** Selecting another province always drops the previous district: a district belongs to exactly
   *  one province. The picker also commits the text it displays. */
  const chooseProvince = (province: string | null) => {
    const next = province ?? '';
    markEdited('province');
    setTouched((current) => ({ ...current, province: true }));
    onChange({ ...value, province: next, provinceInput: next,
      district: next === value.province ? value.district : '' });
  };

  const handleProvinceInput = (_event: React.SyntheticEvent, next: string, reason: string) => {
    // On blur MUI restores the last committed option. Keep what the shopper actually typed so the
    // form can explain why submit is blocked instead of silently sending the old province.
    if (reason === 'blur' || reason === 'reset') return;
    markEdited('province');
    onChange({ ...value, provinceInput: next });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateContactDraft(value, provinceInput);
    if (Object.keys(nextErrors).length > 0) {
      setSubmitAttempted(true);
      const first = FIELD_ORDER.find((field) => nextErrors[field]);
      if (first) fieldRefs[first].current?.focus();
      return;
    }
    // A new intent may produce new server field errors, so old edits must not hide them forever.
    setEditedFields({});
    onSubmit(value);
  };

  const provinceError = fieldError('province', 'address.province');

  return <Box component="form" id="checkout-contact-form" aria-label="Thông tin nhận hàng" aria-busy={disabled}
    noValidate
    sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
    onSubmit={handleSubmit}>
    <Typography component="h2" variant="h5">Thông tin nhận hàng</Typography>
    <TextField id={`${id}-name`} label="Họ tên" value={value.name} disabled={disabled}
      onChange={update('name')} error={Boolean(fieldError('name', 'contact.name'))}
      helperText={fieldError('name', 'contact.name') ?? 'Nhập họ tên người nhận.'}
      inputRef={nameRef}
      slotProps={{ htmlInput: { required: true, maxLength: 120, autoComplete: 'name', onBlur: touch('name') } }} />
    <TextField id={`${id}-phone`} label="Số điện thoại" value={value.phone} disabled={disabled}
      onChange={update('phone')} error={Boolean(fieldError('phone', 'contact.phone'))}
      helperText={fieldError('phone', 'contact.phone') ?? 'Ví dụ 0901234567 hoặc +84901234567.'}
      inputRef={phoneRef}
      slotProps={{ htmlInput: { required: true, inputMode: 'tel', autoComplete: 'tel', maxLength: 20,
        onBlur: touch('phone') } }} />
    <TextField id={`${id}-email`} label="Email (không bắt buộc)" value={value.email} disabled={disabled}
      onChange={update('email')} error={Boolean(fieldError('email', 'contact.email'))}
      helperText={fieldError('email', 'contact.email') ?? 'Để nhận thông tin đơn nếu muốn.'}
      inputRef={emailRef}
      slotProps={{ htmlInput: { type: 'email', autoComplete: 'email', maxLength: 254, onBlur: touch('email') } }} />
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <Autocomplete id={`${id}-province`} options={[...PROVINCE_NAMES]} value={value.province || null}
        inputValue={provinceInput} onInputChange={handleProvinceInput}
        onChange={(_, province) => chooseProvince(province)} autoHighlight fullWidth
        disabled={disabled} noOptionsText="Không tìm thấy tỉnh/thành" sx={{ flex: 1 }}
        filterOptions={(options, state) => {
          const query = searchableText(state.inputValue);
          return query ? options.filter((name) => searchableText(name).includes(query)) : options;
        }}
        renderInput={(params) => <TextField {...params} label="Tỉnh/thành"
          error={Boolean(provinceError)} helperText={provinceError ?? 'Chọn từ danh sách.'}
          inputRef={provinceRef} onBlur={touch('province')} />} />
      <TextField id={`${id}-district`} label="Quận/huyện (không bắt buộc)"
        value={value.district} disabled={disabled} sx={{ flex: 1 }}
        onChange={update('district')} slotProps={{ htmlInput: { maxLength: 100 } }} />
    </Stack>
    <TextField id={`${id}-ward`} label="Phường/xã" value={value.ward} disabled={disabled}
      onChange={update('ward')} error={Boolean(fieldError('ward', 'address.ward'))}
      helperText={fieldError('ward', 'address.ward')}
      inputRef={wardRef}
      slotProps={{ htmlInput: { required: true, maxLength: 100, onBlur: touch('ward') } }} />
    <TextField id={`${id}-addressLine`} label="Địa chỉ cụ thể" value={value.addressLine} disabled={disabled}
      onChange={update('addressLine')} error={Boolean(fieldError('addressLine', 'address.addressLine'))}
      helperText={fieldError('addressLine', 'address.addressLine') ?? 'Số nhà, tên đường…'}
      inputRef={addressLineRef}
      slotProps={{ htmlInput: { required: true, maxLength: 255, autoComplete: 'street-address',
        onBlur: touch('addressLine') } }} />
    <TextField id={`${id}-note`} label="Ghi chú (không bắt buộc)" value={value.note} disabled={disabled} multiline minRows={2}
      onChange={update('note')} slotProps={{ htmlInput: { maxLength: 500 } }} />
    {submitAttempted && hasErrors &&
      <Alert severity="error">Thông tin nhận hàng chưa hợp lệ — hãy kiểm tra các ô được đánh dấu.</Alert>}
    <Button type="submit" variant="contained" size="large" disabled={submitDisabled}>{submitLabel}</Button>
    <Typography variant="body2" color="text.secondary">
      Đặt hàng không cần tài khoản. Thông tin chỉ dùng để giao hàng và liên hệ.
    </Typography>
  </Box>;
}

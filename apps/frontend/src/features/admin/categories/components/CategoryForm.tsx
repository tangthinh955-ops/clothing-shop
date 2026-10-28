import { Alert, Box, Button, Checkbox, FormControlLabel, Stack, TextField } from '@mui/material';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../../../shared/api/client';
import type { CategoryInput } from '../api/categories.api';

interface Props {
  onSubmit: (input: CategoryInput) => Promise<void>;
  mode?: 'create' | 'edit';
  initialValues?: CategoryInput;
  disabled?: boolean;
  onCancel?: () => void;
  onPendingChange?: (pending: boolean) => void;
}

export function CategoryForm({ onSubmit, mode = 'create', initialValues, disabled = false, onCancel, onPendingChange }: Props) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [slug, setSlug] = useState(initialValues?.slug ?? '');
  const [active, setActive] = useState(initialValues?.active ?? true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const busy = useRef(false);
  const errorSummary = useRef<HTMLDivElement>(null);
  const formId = useId();
  const locked = pending || disabled;
  const label = mode === 'edit' ? 'Sửa danh mục' : 'Thêm danh mục';

  useEffect(() => {
    if (error) errorSummary.current?.focus();
  }, [error]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Prevent a second submit even before React paints the disabled button.
    if (busy.current || disabled) return;
    busy.current = true;
    onPendingChange?.(true);
    setPending(true);
    setError('');
    setFields({});
    try {
      await onSubmit({ name, slug, active });
      if (mode === 'create') {
        setName('');
        setSlug('');
        setActive(true);
      }
    } catch (cause: unknown) {
      if (cause instanceof ApiError) {
        setError(cause.code === 'CONFLICT'
          ? mode === 'edit' ? 'Danh mục đã thay đổi hoặc đường dẫn bị trùng. Hãy tải dữ liệu mới và kiểm tra lại.'
            : 'Đường dẫn danh mục đã được sử dụng.'
          : cause.message);
        setFields(Object.fromEntries(cause.fieldErrors.map((field) => [field.field, field.message])));
      } else {
        setError('Chưa lưu được danh mục. Vui lòng thử lại.');
      }
    } finally {
      busy.current = false;
      setPending(false);
      onPendingChange?.(false);
    }
  }

  return <Box component="form" aria-label={label} aria-busy={locked}
    onSubmit={(event) => { void submit(event); }}>
    <Stack spacing={2.5}>
      {error && <Alert severity="error" ref={errorSummary} tabIndex={-1}>{error}</Alert>}
      <TextField id={`${formId}-name`} name="name" label="Tên danh mục" value={name} disabled={locked}
        onChange={(event) => setName(event.target.value)} error={Boolean(fields['name'])} helperText={fields['name']}
        slotProps={{ htmlInput: { required: true, minLength: 2, maxLength: 80 } }} />
      <TextField id={`${formId}-slug`} name="slug" label="Đường dẫn danh mục" value={slug} disabled={locked}
        onChange={(event) => setSlug(event.target.value)} error={Boolean(fields['slug'])}
        helperText={fields['slug'] ?? 'Ví dụ: ao-thun. Dùng chữ thường không dấu, số và dấu gạch ngang.'}
        slotProps={{ htmlInput: { required: true, maxLength: 120, pattern: '[a-z0-9]+(-[a-z0-9]+)*' } }} />
      <FormControlLabel label={mode === 'edit' ? 'Bật danh mục' : 'Bật danh mục khi tạo'} control={<Checkbox name="active" checked={active}
        disabled={locked} onChange={(event) => setActive(event.target.checked)} />} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Button type="submit" variant="contained" disabled={locked} sx={{ flex: 1 }}>
          {pending ? 'Đang lưu…' : mode === 'edit' ? 'Lưu thay đổi' : 'Thêm danh mục'}
        </Button>
        {onCancel && <Button type="button" variant="outlined" onClick={onCancel} disabled={locked}>Hủy</Button>}
      </Stack>
    </Stack>
  </Box>;
}

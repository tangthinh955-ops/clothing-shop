import { Alert, Box, Button, Stack, TextField } from '@mui/material';
import { useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../../shared/api/client';

export type AuthMode = 'login' | 'register' | 'forgot' | 'reset';
export interface AuthValues { email: string; password: string; name: string }
interface Props { mode: AuthMode; onSubmit: (values: AuthValues) => Promise<void> }
const labels: Record<AuthMode, string> = { login: 'Đăng nhập', register: 'Tạo tài khoản', forgot: 'Gửi hướng dẫn', reset: 'Lưu mật khẩu mới' };

export function AuthForm({ mode, onSubmit }: Props) {
  const [pending, setPending] = useState(false);
  const busy = useRef(false); // Blocks same-tick submits before React has painted the disabled button.
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const passwordLabel = mode === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu';
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy.current) return;
    const data = new FormData(event.currentTarget);
    const value = (name: string): string => { const entry = data.get(name); return typeof entry === 'string' ? entry : ''; };
    busy.current = true; setPending(true); setError(''); setFields({});
    try { await onSubmit({ email: value('email'), password: value('password'), name: value('name') }); }
    catch (cause: unknown) {
      setError(cause instanceof ApiError ? cause.message : 'Chưa gửi được biểu mẫu. Vui lòng thử lại.');
      if (cause instanceof ApiError) setFields(Object.fromEntries(cause.fieldErrors.map((field) => [field.field, field.message])));
    } finally { busy.current = false; setPending(false); }
  }
  return <Box component="form" onSubmit={(event) => { void submit(event); }} aria-busy={pending}>
    <Stack spacing={2.5}>
      {error && <Alert severity="error">{error}</Alert>}
      {mode === 'register' && <TextField id="auth-name" name="name" label="Họ và tên" autoComplete="name"
        error={Boolean(fields['name'])} helperText={fields['name']}
        slotProps={{ htmlInput: { required: true, minLength: 2, maxLength: 80 } }} />}
      {mode !== 'reset' && <TextField id="auth-email" name="email" label="Email" type="email" autoComplete="email"
        error={Boolean(fields['email'])} helperText={fields['email']}
        slotProps={{ htmlInput: { required: true, maxLength: 254 } }} />}
      {mode !== 'forgot' && <TextField id="auth-password" name="password" label={passwordLabel} type="password"
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        error={Boolean(fields['password'])} helperText={fields['password'] ?? (mode !== 'login' ? 'Ít nhất 12 ký tự. Có thể dùng một câu dễ nhớ.' : undefined)}
        slotProps={{ htmlInput: { required: true, minLength: mode === 'login' ? 1 : 12, maxLength: 128 } }} />}
      <Button type="submit" variant="contained" size="large" disabled={pending} fullWidth>
        {pending ? 'Đang xử lý…' : labels[mode]}
      </Button>
    </Stack>
  </Box>;
}

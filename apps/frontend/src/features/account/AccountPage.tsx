import { Alert, Box, Button, Divider, Paper, Stack, TextField, Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { authApi, type User } from '../auth/api/auth.api';
import { currentUserKey } from '../auth/hooks/useCurrentUser';
import { ApiError } from '../../shared/api/client';
import { pageTitle } from '../../shared/shop';

export function AccountPage({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function action(task: () => Promise<void>): Promise<void> {
    if (pending) return;
    setPending(true); setError(''); setMessage('');
    try { await task(); }
    catch (cause: unknown) { setError(cause instanceof ApiError ? cause.message : 'Chưa thực hiện được. Vui lòng thử lại.'); }
    finally { setPending(false); }
  }
  async function update(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); const entry = new FormData(event.currentTarget).get('name');
    if (typeof entry !== 'string') return;
    await action(async () => { const updated = await authApi.profile(entry); queryClient.setQueryData(currentUserKey, updated); setMessage('Thông tin đã được cập nhật.'); });
  }
  return <Box sx={{ maxWidth: 680, mx: 'auto', py: 6 }}>
    <title>{pageTitle('Tài khoản')}</title>
    <Typography component="h1" variant="h3" sx={{ mb: 3 }}>Tài khoản của bạn</Typography>
    <Paper square elevation={0} sx={{ p: { xs: 3, md: 5 } }}><Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}{message && <Alert severity="success">{message}</Alert>}
      <Box><Typography variant="overline">ĐỊA CHỈ EMAIL</Typography><Typography>{user.email}</Typography></Box>
      <Alert severity={user.emailVerified ? 'success' : 'info'}>{user.emailVerified ? 'Email đã được xác minh.' : 'Hãy xác minh email trước khi đặt hàng.'}</Alert>
      {!user.emailVerified && <Button disabled={pending} onClick={() => { void action(async () => setMessage((await authApi.resend(user.email)).message)); }}>Gửi lại thư xác minh</Button>}
      <Box component="form" onSubmit={(event) => { void update(event); }}><Stack spacing={2}>
        <TextField key={user.name} name="name" label="Họ và tên" defaultValue={user.name} autoComplete="name"
          slotProps={{ htmlInput: { required: true, minLength: 2, maxLength: 80 } }} />
        <Button variant="contained" type="submit" disabled={pending}>{pending ? 'Đang xử lý…' : 'Lưu thay đổi'}</Button>
      </Stack></Box>
      <Divider />
      <Button disabled={pending} onClick={() => { void action(async () => { await authApi.logout(); queryClient.clear(); void navigate('/login', { replace: true }); }); }}>Đăng xuất</Button>
    </Stack></Paper>
  </Box>;
}

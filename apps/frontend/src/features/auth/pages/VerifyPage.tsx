import { Alert, Button, Link, Stack } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { AuthLayout } from '../../../layouts/AuthLayout';
import { ApiError } from '../../../shared/api/client';
import { authApi } from '../api/auth.api';
import { useLinkToken } from '../hooks/useLinkToken';
import { currentUserKey } from '../hooks/useCurrentUser';

export function VerifyPage() {
  const token = useLinkToken();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  async function verify(): Promise<void> {
    setPending(true); setError('');
    try { setResult((await authApi.verify(token)).message); await queryClient.invalidateQueries({ queryKey: currentUserKey }); }
    catch (cause: unknown) { setError(cause instanceof ApiError ? cause.message : 'Chưa xác minh được. Vui lòng thử lại.'); }
    finally { setPending(false); }
  }
  return <AuthLayout title="Xác minh email" description="Xác nhận địa chỉ email để hoàn tất tài khoản.">
    <Stack spacing={2}>
      {result ? <Alert severity="success">{result}</Alert> : <>
        {error && <Alert severity="error">{error}</Alert>}
        {!token && <Alert severity="warning">Vui lòng mở liên kết trong thư xác minh.</Alert>}
        <Button variant="contained" disabled={!token || pending} onClick={() => { void verify(); }}>{pending ? 'Đang xác minh…' : 'Xác minh email'}</Button>
      </>}
      <Link component={RouterLink} to="/account">Về tài khoản</Link>
      <Link component={RouterLink} to="/login">Đăng nhập</Link>
    </Stack>
  </AuthLayout>;
}

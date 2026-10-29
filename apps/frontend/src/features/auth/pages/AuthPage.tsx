import { Alert, Button, CircularProgress, Link, Stack } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink, Navigate, useNavigate } from 'react-router';
import { AuthLayout } from '../../../layouts/AuthLayout';
import { authApi } from '../api/auth.api';
import { AuthForm, type AuthMode, type AuthValues } from '../components/AuthForm';
import { currentUserKey, useCurrentUser } from '../hooks/useCurrentUser';
import { useLinkToken } from '../hooks/useLinkToken';

const copy = {
  login: ['Chào bạn trở lại', 'Đăng nhập để quản lý tài khoản và theo dõi đơn hàng.'],
  register: ['Tạo tài khoản', 'Lưu lựa chọn của bạn và theo dõi hành trình đơn hàng.'],
  forgot: ['Quên mật khẩu?', 'Nhập email tài khoản. Chúng tôi sẽ gửi hướng dẫn đặt lại.'],
  reset: ['Mật khẩu mới', 'Chọn mật khẩu riêng cho tài khoản của bạn.'],
} as const;

export function AuthPage({ mode }: { mode: AuthMode }) {
  const token = useLinkToken();
  if (mode === 'login' || mode === 'register') return <EntryAuthPage mode={mode} />;
  return <AuthContent key={mode === 'reset' ? token : mode} mode={mode} token={token} />;
}

// Only login/register require a guest; password and email recovery stay accessible.
function EntryAuthPage({ mode }: { mode: 'login' | 'register' }) {
  const user = useCurrentUser();
  if (user.isPending || user.isError) {
    return <AuthLayout title="Kiểm tra phiên đăng nhập" description="Vui lòng chờ xác nhận trạng thái tài khoản.">
      {user.isPending ? <CircularProgress aria-label="Đang kiểm tra phiên" />
        : <Stack spacing={2}>
          <Alert severity="error">Chưa kiểm tra được phiên đăng nhập.</Alert>
          <Button variant="outlined" disabled={user.isFetching} onClick={() => { void user.refetch(); }}>
            Kiểm tra lại phiên
          </Button>
        </Stack>}
    </AuthLayout>;
  }
  if (user.data) return <Navigate to={user.data.role === 'ADMIN' ? '/admin' : '/account'} replace />;
  return <AuthContent key={mode} mode={mode} token="" />;
}

function AuthContent({ mode, token }: { mode: AuthMode; token: string }) {
  const [notice, setNotice] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  async function submit(values: AuthValues): Promise<void> {
    if (mode === 'login') {
      const user = await authApi.login(values.email, values.password);
      queryClient.setQueryData(currentUserKey, user);
      void navigate(user.role === 'ADMIN' ? '/admin' : '/account', { replace: true });
    } else if (mode === 'register') setNotice((await authApi.register(values.name, values.email, values.password)).message);
    else if (mode === 'forgot') setNotice((await authApi.forgot(values.email)).message);
    else {
      setNotice((await authApi.reset(token, values.password)).message);
      queryClient.setQueryData(currentUserKey, null);
    }
  }
  return <AuthLayout title={copy[mode][0]} description={copy[mode][1]}>
    {notice ? <Alert severity="success">{notice}</Alert>
      : mode === 'reset' && !token ? <Alert severity="warning">Liên kết chưa có mã hợp lệ. Hãy yêu cầu một liên kết mới.</Alert>
      : <AuthForm mode={mode} onSubmit={submit} />}
    <Stack spacing={1.5}>
      {/* Shoppers order without an account, so the login page no longer advertises sign-up; /register stays reachable. */}
      {mode === 'login' && <Link component={RouterLink} to="/forgot-password">Quên mật khẩu?</Link>}
      {mode !== 'login' && <Link component={RouterLink} to="/login">Trở lại đăng nhập</Link>}
      {(mode === 'register' || mode === 'reset') && <Link component={RouterLink} to="/forgot-password">Yêu cầu liên kết đặt lại mật khẩu</Link>}
    </Stack>
  </AuthLayout>;
}

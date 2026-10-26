import { Alert, Link, Stack, Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { AuthLayout } from '../../../layouts/AuthLayout';
import { authApi } from '../api/auth.api';
import { AuthForm, type AuthMode, type AuthValues } from '../components/AuthForm';
import { currentUserKey } from '../hooks/useCurrentUser';
import { useLinkToken } from '../hooks/useLinkToken';

const copy = {
  login: ['Chào bạn trở lại', 'Đăng nhập để quản lý tài khoản và theo dõi đơn hàng.'],
  register: ['Tạo tài khoản', 'Lưu lựa chọn của bạn và theo dõi hành trình đơn hàng.'],
  forgot: ['Quên mật khẩu?', 'Nhập email tài khoản. Chúng tôi sẽ gửi hướng dẫn đặt lại.'],
  reset: ['Mật khẩu mới', 'Chọn mật khẩu riêng cho tài khoản của bạn.'],
} as const;

export function AuthPage({ mode }: { mode: AuthMode }) {
  const [notice, setNotice] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = useLinkToken();
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
      {mode === 'login' && <><Link component={RouterLink} to="/forgot-password">Quên mật khẩu?</Link>
        <Typography variant="body2">Chưa có tài khoản? <Link component={RouterLink} to="/register">Đăng ký</Link></Typography></>}
      {mode !== 'login' && <Link component={RouterLink} to="/login">Trở lại đăng nhập</Link>}
      {(mode === 'register' || mode === 'reset') && <Link component={RouterLink} to="/forgot-password">Yêu cầu liên kết đặt lại mật khẩu</Link>}
    </Stack>
  </AuthLayout>;
}

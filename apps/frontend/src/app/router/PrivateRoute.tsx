import { Alert, Box, Button, CircularProgress, Stack } from '@mui/material';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import type { User } from '../../features/auth/api/auth.api';
import { useCurrentUser } from '../../features/auth/hooks/useCurrentUser';

interface Props {
  admin?: boolean;
  children: (user: User) => ReactNode;
}

export function PrivateRoute({ admin = false, children }: Props) {
  const query = useCurrentUser();
  if (query.isPending) {
    return <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress aria-label="Đang tải tài khoản" /></Box>;
  }
  if (query.isError) {
    return <Stack spacing={2} sx={{ py: 6 }}>
      <Alert severity="error">Chưa tải được tài khoản.</Alert>
      <Button onClick={() => { void query.refetch(); }}>Thử lại</Button>
    </Stack>;
  }
  if (!query.data) return <Navigate to="/login" replace />;
  if (admin && query.data.role !== 'ADMIN') return <Navigate to="/account" replace />;
  return children(query.data);
}

import { Alert, Box, Button, Paper, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { request } from '../../shared/api/client';

export function AdminPage() {
  const access = useQuery({ queryKey: ['admin-access'], queryFn: () => request<{ allowed: boolean }>('/admin/access'), retry: false });
  return <Box sx={{ py: 6, maxWidth: 760, mx: 'auto' }}>
    <title>Quản trị | Clothing Shop</title>
    <Typography variant="overline">CLOTHING SHOP / QUẢN TRỊ</Typography>
    <Typography variant="h3" component="h1" sx={{ my: 2 }}>Quản trị cửa hàng</Typography>
    <Paper square elevation={0} sx={{ p: 4, my: 3 }}>
      {access.isPending ? <Typography>Đang kiểm tra phiên…</Typography>
        : access.isError ? <Alert severity="error">Không thể truy cập trang quản trị. Vui lòng đăng nhập lại.</Alert>
        : <Typography>Chào bạn. Tài khoản quản trị đã sẵn sàng.</Typography>}
    </Paper>
    <Button component={Link} to="/account" variant="outlined">Quản lý tài khoản / đăng xuất</Button>
  </Box>;
}

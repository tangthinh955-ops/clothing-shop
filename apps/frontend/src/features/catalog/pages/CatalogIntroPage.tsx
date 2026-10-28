import { Box, Button, Typography } from '@mui/material';
import { Link } from 'react-router';
import { useCurrentUser } from '../../auth/hooks/useCurrentUser';

// Introductory empty state until the M3 public catalog UI is implemented.
export function CatalogIntroPage() {
  const user = useCurrentUser();
  const admin = user.data?.role === 'ADMIN';
  return <Box sx={{ py: { xs: 6, md: 10 } }}>
    <title>Bộ sưu tập | Clothing Shop</title>
    <Typography variant="overline" sx={{ letterSpacing: '.2em' }}>EVERYDAY ESSENTIALS</Typography>
    <Typography variant="h2" component="h1" sx={{ fontFamily: 'Georgia, serif', maxWidth: 700, my: 3, fontSize: { xs: 42, md: 64 } }}>
      Những lựa chọn<br />cho mỗi ngày.
    </Typography>
    <Box sx={{ mt: 6, p: { xs: 4, md: 7 }, border: '1px solid #d6d2c9', textAlign: 'center' }}>
      <Typography variant="h5" component="h2" sx={{ mb: 2 }}>Bộ sưu tập đang được cập nhật</Typography>
      <Typography color="text.secondary">Hãy quay lại để khám phá các sản phẩm mới.</Typography>
      {user.isPending ? <Typography role="status" sx={{ mt: 3 }}>Đang kiểm tra phiên…</Typography>
        : user.isError ? <Box sx={{ mt: 3 }}>
          <Typography role="alert">Chưa kiểm tra được phiên đăng nhập.</Typography>
          <Button variant="outlined" disabled={user.isFetching} onClick={() => { void user.refetch(); }} sx={{ mt: 2 }}>
            Kiểm tra lại phiên
          </Button>
        </Box>
        : <Button component={Link} to={user.data ? (admin ? '/admin' : '/account') : '/register'} variant="outlined" sx={{ mt: 3 }}>
          {user.data ? (admin ? 'Quản trị' : 'Tài khoản') : 'Tạo tài khoản'}
        </Button>}
    </Box>
  </Box>;
}

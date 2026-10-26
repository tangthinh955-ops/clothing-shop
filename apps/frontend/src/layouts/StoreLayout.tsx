import { Box, Container, Divider, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink, Outlet } from 'react-router';
import { useCurrentUser } from '../features/auth/hooks/useCurrentUser';

export function StoreLayout() {
  const user = useCurrentUser();
  return <>
    <a className="skip-link" href="#main-content">Đến nội dung chính</a>
    <Box sx={{ bgcolor: '#171717', color: '#fff', textAlign: 'center', py: 0.8 }}><Typography sx={{ fontSize: 11, letterSpacing: '.18em' }}>BẢN DEMO · DỮ LIỆU GIẢ</Typography></Box>
    <Box component="header" sx={{ bgcolor: '#fff', borderBottom: '1px solid #dedbd5' }}>
      <Container maxWidth="lg"><Stack direction="row" useFlexGap sx={{ alignItems: 'center', justifyContent: 'space-between', minHeight: 88, gap: 2, py: 2, flexWrap: 'wrap' }}>
        <Link component={RouterLink} to="/shop" sx={{ fontSize: { xs: 20, sm: 24 }, fontWeight: 700, letterSpacing: '.08em', textDecoration: 'none' }}>CLOTHING SHOP</Link>
        <Stack component="nav" aria-label="Điều hướng chính" direction="row" spacing={{ xs: 2, sm: 3 }} sx={{ alignItems: 'center' }}>
          <Link component={RouterLink} to="/shop">Bộ sưu tập</Link>
          <Link component={RouterLink} to="/size-guide" sx={{ display: { xs: 'none', sm: 'inline' } }}>Bảng size</Link>
          <Link component={RouterLink} to={user.data ? '/account' : '/login'}>{user.data ? 'Tài khoản' : 'Đăng nhập'}</Link>
          {user.data?.role === 'ADMIN' && <Link component={RouterLink} to="/admin">Quản trị</Link>}
        </Stack>
      </Stack></Container>
    </Box>
    <Container component="main" id="main-content" maxWidth="lg" sx={{ minHeight: '65vh' }}><Outlet /></Container>
    <Box component="footer" sx={{ mt: 5, bgcolor: '#fff', borderTop: '1px solid #dedbd5', py: 5 }}>
      <Container maxWidth="lg"><Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', gap: 3 }}>
        <Box><Typography sx={{ fontWeight: 700, letterSpacing: '.1em', mb: 1 }}>CLOTHING SHOP</Typography><Typography variant="body2" color="text.secondary">Trang phục cho mỗi ngày của bạn.</Typography></Box>
        <Stack component="nav" aria-label="Thông tin cửa hàng" direction="row" useFlexGap sx={{ gap: 3, flexWrap: 'wrap' }}>
          <Link component={RouterLink} to="/contact">Liên hệ</Link><Link component={RouterLink} to="/shipping">Giao hàng</Link><Link component={RouterLink} to="/returns-policy">Đổi & trả</Link>
        </Stack>
      </Stack><Divider sx={{ my: 3 }} /><Typography variant="caption" color="text.secondary">Thông tin và chính sách trong bản demo đang được dùng để thử nghiệm.</Typography></Container>
    </Box>
  </>;
}

import { Box, Container, Divider, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink, Outlet } from 'react-router';
import { useCurrentUser } from '../features/auth/hooks/useCurrentUser';
import { SHOP_NAME, seller } from '../shared/shop';

const footerLinks = [
  { to: '/contact', label: 'Liên hệ' },
  { to: '/shipping', label: 'Giao hàng' },
  { to: '/returns-policy', label: 'Đổi & trả' },
  { to: '/payment', label: 'Thanh toán' },
  { to: '/privacy', label: 'Bảo mật' },
];

export function StoreLayout() {
  // Shoppers order without an account, so only a signed-in admin gets a header link (into the admin area).
  const user = useCurrentUser();
  return <>
    <a className="skip-link" href="#main-content">Đến nội dung chính</a>
    <Box component="header" sx={{ bgcolor: '#fff', borderBottom: '1px solid #dedbd5' }}>
      <Container maxWidth="lg">
        <Stack direction="row" useFlexGap sx={{ alignItems: 'center', justifyContent: 'space-between', minHeight: 88, gap: 2, py: 2, flexWrap: 'wrap' }}>
          <Link component={RouterLink} to="/shop" sx={{ fontSize: { xs: 20, sm: 24 }, fontWeight: 700, letterSpacing: '.08em', textDecoration: 'none' }}>
            {SHOP_NAME.toUpperCase()}
          </Link>
          <Stack component="nav" aria-label="Điều hướng chính" direction="row" spacing={{ xs: 2, sm: 3 }} sx={{ alignItems: 'center' }}>
            <Link component={RouterLink} to="/shop">Bộ sưu tập</Link>
            <Link component={RouterLink} to="/size-guide" sx={{ display: { xs: 'none', sm: 'inline' } }}>Bảng size</Link>
            {user.data?.role === 'ADMIN' && <Link component={RouterLink} to="/admin">Quản trị</Link>}
          </Stack>
        </Stack>
      </Container>
    </Box>
    <Container component="main" id="main-content" maxWidth="lg" sx={{ minHeight: '65vh' }}>
      <Outlet />
    </Container>
    <Box component="footer" sx={{ mt: 5, bgcolor: '#fff', borderTop: '1px solid #dedbd5', py: 5 }}>
      <Container maxWidth="lg">
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', gap: 3 }}>
          <Box>
            <Typography sx={{ fontWeight: 700, letterSpacing: '.1em', mb: 1 }}>{SHOP_NAME.toUpperCase()}</Typography>
            <Typography variant="body2" color="text.secondary">{seller.owner} · {seller.city}</Typography>
            <Link href={seller.instagram.url} target="_blank" rel="noopener noreferrer" variant="body2">
              Instagram @{seller.instagram.handle}
            </Link>
          </Box>
          <Stack component="nav" aria-label="Thông tin cửa hàng" direction="row" useFlexGap sx={{ gap: 3, flexWrap: 'wrap' }}>
            {footerLinks.map((item) => <Link key={item.to} component={RouterLink} to={item.to}>{item.label}</Link>)}
          </Stack>
        </Stack>
        <Divider sx={{ my: 3 }} />
        <Typography variant="caption" color="text.secondary">© {SHOP_NAME}. Đặt hàng không cần tài khoản, giao hàng toàn quốc.</Typography>
      </Container>
    </Box>
  </>;
}

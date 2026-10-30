import { Box, Container, Divider, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { SHOP_NAME, seller } from '../../shared/shop';
import { allProductsLabel, supportLinks } from './storeLinks';
import { categoryHref, useCatalogCategories } from '../../features/catalog/hooks/useCatalogCategories';

function ColumnTitle({ children }: { children: string }) {
  return <Typography component="h2" sx={{ fontWeight: 700, fontSize: 14, mb: 1.5 }}>{children}</Typography>;
}

function FooterLink({ to, label }: { to: string; label: string }) {
  return <Link component={RouterLink} to={to} variant="body2" color="text.secondary">{label}</Link>;
}

export function StoreFooter() {
  const categories = useCatalogCategories();
  return <Box component="footer" sx={{ mt: { xs: 6, md: 10 }, bgcolor: '#f5f5f5', py: { xs: 5, md: 7 } }}>
    <Container maxWidth="lg">
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr 1fr' }, gap: { xs: 4, md: 6 } }}>
        <Box>
          <Typography sx={{ fontWeight: 700, letterSpacing: '.1em', mb: 1.5 }}>{SHOP_NAME.toUpperCase()}</Typography>
          <Typography variant="body2" color="text.secondary">{seller.owner} · {seller.city}</Typography>
          <Link href={seller.instagram.url} target="_blank" rel="noopener noreferrer" variant="body2">
            Instagram @{seller.instagram.handle}
          </Link>
        </Box>
        <Box>
          <ColumnTitle>Hỗ trợ khách hàng</ColumnTitle>
          <Stack component="nav" aria-label="Thông tin cửa hàng" spacing={1}>
            {supportLinks.map((item) => <FooterLink key={item.to} to={item.to} label={item.label} />)}
          </Stack>
        </Box>
        <Box>
          <ColumnTitle>Mua sắm</ColumnTitle>
          <Stack component="nav" aria-label="Mua sắm" spacing={1}>
            <FooterLink to="/shop" label={allProductsLabel} />
            {categories.map((category) => <FooterLink key={category.id} to={categoryHref(category.id)} label={category.name} />)}
          </Stack>
        </Box>
      </Box>
      <Divider sx={{ my: 4 }} />
      <Typography variant="caption" color="text.secondary">© {SHOP_NAME}. Đặt hàng không cần tài khoản, giao hàng toàn quốc.</Typography>
    </Container>
  </Box>;
}

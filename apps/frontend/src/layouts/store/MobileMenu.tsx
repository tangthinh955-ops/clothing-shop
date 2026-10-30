import { Box, Divider, Drawer, IconButton, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { SHOP_NAME } from '../../shared/shop';
import { CloseIcon } from '../../shared/ui/icons';
import { allProductsLabel, supportLinks } from './storeLinks';
import { categoryHref, useCatalogCategories } from '../../features/catalog/hooks/useCatalogCategories';

function MenuLink({ to, label, onClose }: { to: string; label: string; onClose: () => void }) {
  return <Link component={RouterLink} to={to} onClick={onClose} underline="none"
    sx={{ display: 'block', py: 1.5, fontSize: 16, fontWeight: 500 }}>
    {label}
  </Link>;
}

function SectionTitle({ children }: { children: string }) {
  return <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 2, letterSpacing: '.1em' }}>
    {children}
  </Typography>;
}

export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const categories = useCatalogCategories();
  return <Drawer open={open} onClose={onClose} slotProps={{ paper: { sx: { width: 'min(320px, 85vw)' } } }}>
    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, minHeight: 56 }}>
      <Typography sx={{ fontWeight: 700, letterSpacing: '.08em' }}>{SHOP_NAME.toUpperCase()}</Typography>
      <IconButton aria-label="Đóng menu" edge="end" color="inherit" onClick={onClose}><CloseIcon /></IconButton>
    </Stack>
    <Divider />
    <Box component="nav" aria-label="Menu cửa hàng" sx={{ px: 2, pb: 4 }}>
      <SectionTitle>Mua sắm</SectionTitle>
      <MenuLink to="/shop" label={allProductsLabel} onClose={onClose} />
      {categories.map((category) =>
        <MenuLink key={category.id} to={categoryHref(category.id)} label={category.name} onClose={onClose} />)}
      <SectionTitle>Hỗ trợ khách hàng</SectionTitle>
      {supportLinks.map((item) => <MenuLink key={item.to} to={item.to} label={item.label} onClose={onClose} />)}
    </Box>
  </Drawer>;
}

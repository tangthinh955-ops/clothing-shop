import { Badge, Box, Container, IconButton, Link, Stack } from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router';
import { useCurrentUser } from '../../features/auth/hooks/useCurrentUser';
import { useCart } from '../../features/cart/CartProvider';
import { SHOP_NAME } from '../../shared/shop';
import { CartIcon, MenuIcon, SearchIcon } from '../../shared/ui/icons';
import { HeaderSearch } from './HeaderSearch';
import { MobileMenu } from './MobileMenu';
import { allProductsLabel } from './storeLinks';
import { categoryHref, useCatalogCategories } from '../../features/catalog/hooks/useCatalogCategories';

const SEARCH_PANEL_ID = 'store-search';

function NavLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return <Link component={RouterLink} to={to} aria-current={active ? 'page' : undefined} underline="none"
    sx={{
      py: 1, whiteSpace: 'nowrap', fontWeight: 500, borderBottom: '2px solid',
      borderColor: active ? 'text.primary' : 'transparent', '&:hover': { borderColor: 'text.primary' },
    }}>
    {label}
  </Link>;
}

export function StoreHeader() {
  // Shoppers order without an account, so only a signed-in admin gets an extra link (into the admin area).
  const user = useCurrentUser();
  const cart = useCart();
  const categories = useCatalogCategories();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // null off the collection page, '' for "all products", otherwise the filtered category id.
  const activeCategory = location.pathname === '/shop' ? new URLSearchParams(location.search).get('categoryId') ?? '' : null;

  return <Box component="header" sx={{
    position: 'sticky', top: 0, zIndex: 'appBar', bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider',
  }}>
    <Container maxWidth="lg">
      <Stack direction="row" sx={{ alignItems: 'center', minHeight: { xs: 56, md: 72 }, gap: { xs: 1, md: 4 } }}>
        <IconButton aria-label="Mở menu" edge="start" color="inherit" onClick={() => setMenuOpen(true)} sx={{ display: { md: 'none' } }}>
          <MenuIcon />
        </IconButton>
        <Link component={RouterLink} to="/" underline="none"
          sx={{ fontSize: { xs: 18, md: 22 }, fontWeight: 700, letterSpacing: '.08em', whiteSpace: 'nowrap' }}>
          {SHOP_NAME.toUpperCase()}
        </Link>
        <Stack component="nav" aria-label="Điều hướng chính" direction="row" sx={{
          display: { xs: 'none', md: 'flex' }, gap: 3, flex: 1, minWidth: 0, overflowX: 'auto', alignItems: 'center',
        }}>
          <NavLink to="/shop" label={allProductsLabel} active={activeCategory === ''} />
          {categories.map((category) =>
            <NavLink key={category.id} to={categoryHref(category.id)} label={category.name} active={activeCategory === category.id} />)}
        </Stack>
        <Stack direction="row" sx={{ alignItems: 'center', gap: { xs: 0.5, md: 2 }, ml: 'auto' }}>
          <IconButton aria-label="Mở ô tìm kiếm" color="inherit" aria-expanded={searchOpen} aria-controls={searchOpen ? SEARCH_PANEL_ID : undefined}
            onClick={() => setSearchOpen((open) => !open)}>
            <SearchIcon />
          </IconButton>
          {/* The badge is only rendered when there is something in the cart; the button always opens the drawer. */}
          <IconButton aria-label={cart.totalQuantity > 0 ? `Giỏ hàng: ${cart.totalQuantity} sản phẩm` : 'Mở giỏ hàng'}
            color="inherit" onClick={cart.openDrawer}>
            <Badge badgeContent={cart.totalQuantity > 0 ? cart.totalQuantity : undefined} color="primary">
              <CartIcon />
            </Badge>
          </IconButton>
          {user.data?.role === 'ADMIN' && <Link component={RouterLink} to="/admin" sx={{ fontWeight: 500 }}>Quản trị</Link>}
        </Stack>
      </Stack>
    </Container>
    {searchOpen && <HeaderSearch id={SEARCH_PANEL_ID} onClose={() => setSearchOpen(false)} />}
    <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
  </Box>;
}

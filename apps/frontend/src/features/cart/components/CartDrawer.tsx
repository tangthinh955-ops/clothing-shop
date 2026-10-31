import { Alert, Box, Button, Divider, Drawer, IconButton, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { CloseIcon } from '../../../shared/ui/icons';
import { formatMoney } from '../../catalog/catalogFormat';
import { useCart } from '../CartProvider';
import { useCartResolve } from '../hooks/useCartResolve';
import type { CartAvailableResolvedItem, CartResolvedItem } from '../api/cart.api';

/** Stock notes for rows the server still counts, so the shopper can react before checkout. */
function statusLabel(item: CartAvailableResolvedItem): string | undefined {
  if (item.status === 'OUT_OF_STOCK') return 'Hết hàng';
  if (item.status === 'EXCEEDS_STOCK') return `Chỉ còn ${item.available} chiếc`;
  return undefined;
}

/** Drawer rows stay compact and read-only — editing lives on the full cart page. */
function DrawerRow({ line, item, highlighted }: {
  line: { variantId: string; quantity: number };
  item: CartResolvedItem | undefined;
  highlighted: boolean;
}) {
  const { closeDrawer } = useCart();
  // Narrow once: unavailable rows carry nothing but the id by contract, so they render without product data.
  const available = item && item.status !== 'UNAVAILABLE' ? item : undefined;
  const status = available ? statusLabel(available) : undefined;
  return <Stack direction="row" spacing={2} sx={{
    p: 1.5, border: 2, borderColor: highlighted ? 'primary.main' : 'transparent', borderRadius: 2, alignItems: 'flex-start', minWidth: 0,
  }}>
    {available?.image
      ? <Box component="img" src={available.image.url} alt="" loading="lazy"
        sx={{ width: 56, height: 72, flex: 'none', borderRadius: 1, objectFit: 'cover', bgcolor: 'grey.200' }} />
      // Blank box keeps the layout stable while a row loads and for rows without an image.
      : <Box sx={{ width: 56, height: 72, flex: 'none', borderRadius: 1, bgcolor: 'grey.200' }} aria-hidden />}
    <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
      {available
        ? <Link component={RouterLink} to={`/products/${available.product.slug}`} onClick={closeDrawer} underline="hover"
          sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{available.product.name}</Link>
        : <Typography sx={{ fontWeight: 700, color: 'text.disabled' }}>{item ? 'Sản phẩm không truy cập được' : 'Chưa có thông tin sản phẩm'}</Typography>}
      {available && <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {available.color} · size {available.size} · {available.sku}
      </Typography>}
      <Typography>
        {available
          ? `${formatMoney(available.price)} × ${line.quantity} = ${formatMoney(available.price * line.quantity)}`
          : `${line.quantity} chiếc`}
      </Typography>
      {status && <Typography variant="caption" role="status" sx={{ fontWeight: 700, color: 'warning.dark' }}>
        {status}
      </Typography>}
    </Stack>
  </Stack>;
}

function StorageWarning({ kind }: { kind: 'unavailable' | 'corrupt' }) {
  return <Alert severity={kind === 'corrupt' ? 'warning' : 'info'}>
    {kind === 'corrupt'
      ? 'Giỏ hàng đã lưu trên thiết bị không đọc được nên đã được đặt lại trống.'
      : 'Thiết bị đang chặn lưu trữ nên giỏ chỉ còn trong tab mở này, sẽ mất khi đóng trang.'}
  </Alert>;
}

/** Slide-in cart from the right: rows, warnings and a go-to-cart action; editing happens on /cart. */
export function CartDrawer() {
  const cart = useCart();
  // The drawer is invisible most of the time, so it only resolves while it is open; /cart resolves itself.
  const resolve = useCartResolve(cart.drawerOpen ? cart.items : []);
  // One lookup per requested id: the reply follows the cart's own row order, so pairing stays aligned.
  const rows = new Map((resolve.isError || resolve.isFetching ? [] : resolve.data ?? []).map((item) => [item.variantId, item]));

  return <Drawer anchor="right" open={cart.drawerOpen} onClose={cart.closeDrawer}
    slotProps={{ paper: { 'aria-labelledby': 'cart-title', sx: { width: { xs: '100vw', sm: 'min(420px, 92vw)' }, display: 'flex', flexDirection: 'column' } } }}>
    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, minHeight: 56 }}>
      <Typography id="cart-title" sx={{ fontWeight: 700, letterSpacing: '.04em' }}>GIỎ HÀNG</Typography>
      <IconButton aria-label="Đóng giỏ hàng" edge="end" color="inherit" onClick={cart.closeDrawer}><CloseIcon /></IconButton>
    </Stack>
    <Divider />
    {cart.storageWarning && <Box sx={{ px: 2, pt: 2 }}><StorageWarning kind={cart.storageWarning} /></Box>}
    <Box sx={{
      flex: 1, overflowY: 'auto', px: 2, pt: 2, pb: 3, display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      {cart.items.length === 0
        ? <>
          <Typography>Giỏ hàng trống. Hãy chọn một sản phẩm để bắt đầu.</Typography>
          <Button component={RouterLink} to="/shop" onClick={cart.closeDrawer} variant="outlined" sx={{ maxWidth: 240 }}>
            Xem sản phẩm
          </Button>
        </>
        : <>
          {(resolve.isPending || resolve.isFetching) && <Typography role="status">Đang tải giá sản phẩm…</Typography>}
          {/* Priced rows are the only thing that can fail here; the cart items themselves stay untouched. */}
          {resolve.isError && <Alert severity="error" sx={{ my: 1 }}>
            Chưa đọc được giá và tình trạng hàng. Giỏ của bạn vẫn giữ nguyên.
            <Button size="small" variant="contained" sx={{ mt: 1 }} disabled={resolve.isFetching}
              onClick={() => { void resolve.refetch({ cancelRefetch: false }); }}>Thử lại</Button>
          </Alert>}
          {cart.items.map((line) =>
            <DrawerRow key={line.variantId} line={line} item={rows.get(line.variantId)}
              highlighted={cart.highlight?.variantId === line.variantId} />)}
        </>}
    </Box>
    <Box sx={{ px: 2, py: 2, borderTop: 1, borderColor: 'divider' }}>
      <Button component={RouterLink} to="/cart" onClick={cart.closeDrawer} variant="contained" fullWidth sx={{ minHeight: 52 }}>
        Đi tới giỏ hàng
      </Button>
    </Box>
  </Drawer>;
}

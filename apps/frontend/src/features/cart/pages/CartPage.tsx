import { Alert, Box, Button, IconButton, Link, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { ApiError } from '../../../shared/api/client';
import { CloseIcon } from '../../../shared/ui/icons';
import { formatMoney } from '../../catalog/catalogFormat';
import { useCart } from '../CartProvider';
import { useCartResolve } from '../hooks/useCartResolve';
import type { CartAvailableResolvedItem, CartResolvedItem } from '../api/cart.api';
import type { CartLine } from '../cart-store';

/** The committed quantity of one row: local text while typing, applied only once it parses. */
function QuantityEditor({ line, name, soldOut }: {
  line: CartLine;
  /** Spoken field name of the row, so multiple quantity fields are distinguishable. */
  name?: string | undefined;
  soldOut: boolean;
}) {
  const cart = useCart();
  const [text, setText] = useState(String(line.quantity));
  const parsed = /^\d+$/.test(text) ? Number(text) : NaN;
  const invalid = !Number.isInteger(parsed) || parsed < 1 || parsed > 99;
  // Quantity 0 is always an error, never a hidden removal; removal stays an explicit button.
  return <TextField
    label="Số lượng" size="small" value={text} disabled={soldOut}
    error={invalid}
    helperText={invalid ? 'Số lượng từ 1 đến 99.' : 'Nhấn Enter hoặc rời ô để cập nhật.'}
    sx={{ width: 104 }}
    slotProps={{ htmlInput: {
      inputMode: 'numeric', min: 1, max: 99, step: 1, enterKeyHint: 'enter',
      'aria-label': name ? `Số lượng của ${name}` : 'Số lượng của dòng',
    } }}
    onChange={(event) => setText(event.target.value)}
    onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
    onBlur={() => {
      // Leaving the field with an unusable value restores the committed quantity of the row.
      if (!invalid) {
        if (parsed !== line.quantity) cart.updateQuantity(line.variantId, parsed);
        setText(String(parsed));
      } else setText(String(line.quantity));
    }}
  />;
}

function CartRow({ line, item, verified }: { line: CartLine; item: CartResolvedItem | undefined; verified: boolean }) {
  const cart = useCart();
  // Narrow once: unavailable rows carry nothing but the id by contract, so they render without product data.
  const available = item && item.status !== 'UNAVAILABLE' ? item : undefined;
  const status = verified && available && available.status !== 'AVAILABLE'
    ? (available.status === 'OUT_OF_STOCK' ? 'Hết hàng' : `Chỉ còn ${available.available} chiếc`)
    : undefined;
  return <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 2 }} sx={{
    p: 2, border: 1, borderColor: 'divider', borderRadius: 2, alignItems: { sm: 'center' }, minWidth: 0,
  }}>
    {verified && available?.image && <Box component="img" src={available.image.url} alt="" loading="lazy"
      sx={{ width: 64, height: 80, flex: 'none', borderRadius: 1, objectFit: 'cover', bgcolor: 'grey.200' }} />}
    <Stack sx={{ flex: 1, minWidth: 0 }}>
      {verified && available
        ? <Link component={RouterLink} to={`/products/${available.product.slug}`} underline="hover"
          sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{available.product.name}</Link>
        : <Typography sx={{ fontWeight: 700, color: 'text.disabled' }}>{verified && item ? 'Sản phẩm không truy cập được' : 'Chưa có thông tin sản phẩm'}</Typography>}
      {!available && <Typography>{line.quantity} chiếc</Typography>}
      {verified && available && <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {available.color} · size {available.size} · {available.sku}
      </Typography>}
      {verified && available && <Typography>{formatMoney(available.price)} / chiếc</Typography>}
      {status && <Typography variant="caption" role="status" sx={{ fontWeight: 700, color: 'error.dark' }}>
        {status}
      </Typography>}
    </Stack>
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
      {available && <QuantityEditor line={line} soldOut={available.status === 'OUT_OF_STOCK'} name={available.product.name} />}
      {verified && available && available.status !== 'OUT_OF_STOCK' && available.available < line.quantity &&
        <Typography variant="caption" sx={{ color: 'error.dark', maxWidth: 180 }}>
          {`Giỏ có ${line.quantity} nhưng chỉ còn ${available.available} chiếc`}
        </Typography>}
      <IconButton aria-label={available ? `Xóa ${available.product.name} khỏi giỏ` : `Xóa dòng này khỏi giỏ`}
        onClick={() => cart.removeItem(line.variantId)}>
        <CloseIcon />
      </IconButton>
    </Stack>
  </Stack>;
}

/** Full cart view: editable rows, statuses of what is still buyable and a subtotal of live prices. */
export function CartPage() {
  const cart = useCart();
  const resolve = useCartResolve(cart.items);
  const rows = resolve.data ?? [];
  const verified = !resolve.isError && !resolve.isFetching;

  if (cart.items.length === 0) {
    return <Stack spacing={2} sx={{ py: 6, textAlign: 'center' }}>
      {cart.storageWarning && <Alert severity="warning">{cart.storageWarning === 'corrupt'
        ? 'Giỏ hàng đã lưu trên thiết bị không đọc được nên đã được đặt lại trống.'
        : 'Thiết bị đang chặn lưu trữ nên giỏ chỉ còn trong tab mở này, sẽ mất khi đóng trang.'}</Alert>}
      <Typography variant="h4" component="h1">Giỏ hàng trống</Typography>
      <Typography sx={{ color: 'text.secondary' }}>Hãy chọn một sản phẩm để bắt đầu mua sắm.</Typography>
      <Box><Button component={RouterLink} to="/shop" variant="outlined">Xem sản phẩm</Button></Box>
    </Stack>;
  }

  // Only live rows count toward the subtotal: unavailable ones keep their place without a price.
  const subtotal = rows.reduce((total, item) => {
    if (item.status === 'UNAVAILABLE') return total;
    const line = cart.items.find((entry) => entry.variantId === item.variantId);
    return line ? total + item.price * line.quantity : total;
  }, 0);

  return <Box sx={{ py: { xs: 2, md: 4 }, display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 820 }}>
    <Typography variant="h4" component="h1">Giỏ hàng của bạn</Typography>
    {cart.storageWarning && <Alert severity={cart.storageWarning === 'corrupt' ? 'warning' : 'info'}>
      {cart.storageWarning === 'corrupt'
        ? 'Giỏ hàng đã lưu trên thiết bị không đọc được nên đã được đặt lại trống.'
        : 'Thiết bị đang chặn lưu trữ nên giỏ chỉ còn trong tab mở này, sẽ mất khi đóng trang.'}
    </Alert>}
    {resolve.isPending && <Typography role="status">Đang tải giá sản phẩm…</Typography>}
    {/* Priced rows are the only thing that can fail here; the cart items themselves stay untouched. */}
    {resolve.isError && <Alert severity="error">
      {(resolve.error instanceof ApiError && resolve.error.code === 'VALIDATION_ERROR' && resolve.error.message) ||
        'Chưa đọc được giá và tình trạng của giỏ. Giỏ của bạn vẫn giữ nguyên.'}
      <Box><Button size="small" variant="contained" sx={{ mt: 1 }} disabled={resolve.isFetching}
        onClick={() => { void resolve.refetch({ cancelRefetch: false }); }}>Thử lại</Button></Box>
    </Alert>}
    {cart.items.map((line) => <CartRow key={line.variantId} line={line}
      item={rows.find((item) => item.variantId === line.variantId)} verified={verified} />)}
    <Stack sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }} spacing={1}>
      {/* Only a live quote may print a number: a failed lookup never shows 0 or a stale total. */}
      {resolve.isError
        ? <Typography>Tạm tính sẽ hiện sau khi đọc được giá mới.</Typography>
        : resolve.isPending || resolve.isFetching
          ? <Typography role="status">Đang cập nhật giá…</Typography>
          : rows.some((item) => item.status === 'UNAVAILABLE')
            ? <Typography>Chưa thể tính đủ giỏ vì có sản phẩm không còn bán.</Typography>
            : <Typography>Tạm tính: <strong>{formatMoney(subtotal)}</strong></Typography>}
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Tạm tính dựa trên giá hiện tại, chưa gồm phí giao hàng. Báo giá chính thức bạn sẽ nhận được trên bước đặt đơn.
      </Typography>
      <Stack direction="row" spacing={2} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Button component={RouterLink} to="/checkout" variant="contained">Xem phí và tổng tiền</Button>
        <Button component={RouterLink} to="/shop" variant="outlined">Tiếp tục mua</Button>
      </Stack>
    </Stack>
  </Box>;
}

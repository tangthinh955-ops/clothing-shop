import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { useCart } from '../../cart/CartProvider';
import { describeQuoteChanges, QuoteSummary } from '../components/QuoteSummary';
import { useCheckoutQuote } from '../hooks/useCheckoutQuote';

function expiryLine(remainingMs: number | null): string {
  if (remainingMs === null) return 'Đang xác định thời hạn báo giá.';
  const minutes = Math.max(0, Math.ceil(remainingMs / 60000));
  return `Báo giá có hiệu lực khoảng ${minutes} phút nữa.`;
}

export function CheckoutPage() {
  const cart = useCart();
  const { phase, quote, pendingQuote, error, remainingMs, fetchQuote, acceptPending } = useCheckoutQuote(cart.items);

  if (cart.items.length === 0) {
    return <Stack spacing={2} sx={{ py: 6, textAlign: 'center' }}>
      <Typography variant="h4" component="h1">Giỏ hàng trống</Typography>
      <Typography sx={{ color: 'text.secondary' }}>Hãy chọn một sản phẩm trước khi xem phí và tổng tiền.</Typography>
      <Box><Button component={RouterLink} to="/shop" variant="outlined">Quay lại mua hàng</Button></Box>
    </Stack>;
  }

  const busy = phase === 'pending';
  const actionLabel = phase === 'expired' ? 'Cập nhật báo giá' : phase === 'error' ? 'Thử lại' : 'Lấy báo giá';
  const showAction = phase !== 'accepted' && phase !== 'confirm';

  return <Box sx={{ py: { xs: 2, md: 4 }, maxWidth: 820, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
    <title>Xem phí và tổng tiền | Clothing Shop</title>
    <Typography variant="h4" component="h1">Xem phí và tổng tiền</Typography>
    <Typography sx={{ color: 'text.secondary' }}>
      Bước xem báo giá. Phương thức hiện tại: thanh toán khi nhận hàng (COD). Chưa có bước đặt đơn ở đây.
    </Typography>
    <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
      {showAction && <Button variant="contained" disabled={busy} onClick={() => { void fetchQuote(); }}>
        {busy ? 'Đang lấy báo giá…' : actionLabel}
      </Button>}
      <Button component={RouterLink} to="/cart" variant="outlined">Quay lại sửa giỏ</Button>
    </Stack>
    {busy && <Typography role="status">Đang lấy báo giá…</Typography>}
    {phase === 'error' && <Alert severity="error">
      {error ?? 'Chưa lấy được báo giá. Vui lòng thử lại.'}
      {quote && <Typography variant="body2" sx={{ mt: 1 }}>
        Báo giá đã xem trước đó bên dưới chỉ để tham khảo, không còn giá trị áp dụng.
      </Typography>}
    </Alert>}
    {phase === 'stale' && <Alert severity="info">
      Giỏ đã thay đổi nên báo giá trước đây không còn áp dụng. Hãy lấy báo giá mới cho giỏ hiện tại.
    </Alert>}
    {phase === 'expired' && <Alert severity="warning">Báo giá đã hết hạn. Hãy cập nhật để xem mức giá hiện tại.</Alert>}
    {phase === 'confirm' && pendingQuote && quote && <Alert severity="info">
      Giá hoặc phí đã thay đổi so với báo giá bạn đã xem. Hãy so sánh và bấm “Dùng báo giá mới” để xác nhận.
      <Stack spacing={0.5} sx={{ mt: 1 }}>
        {describeQuoteChanges(quote, pendingQuote).map((change) => <Typography key={change} variant="body2">{change}</Typography>)}
      </Stack>
    </Alert>}
    {phase === 'accepted' && quote && <Typography role="status">
      {expiryLine(remainingMs)} Báo giá chưa giữ hàng. Giá và tồn sẽ được kiểm tra lại khi đặt đơn.
    </Typography>}
    {phase === 'confirm' && quote && <Box>
      <Typography variant="overline">BÁO GIÁ ĐÃ XEM — KHÔNG CÒN ÁP DỤNG</Typography>
      <QuoteSummary quote={quote} tone="old" />
    </Box>}
    {phase === 'confirm' && pendingQuote && <Box>
      <Typography variant="overline">BÁO GIÁ MỚI</Typography>
      <QuoteSummary quote={pendingQuote} tone="new" />
      <Box sx={{ mt: 2 }}><Button variant="contained" onClick={acceptPending}>Dùng báo giá mới</Button></Box>
    </Box>}
    {(phase === 'stale' || phase === 'error' || phase === 'expired') && quote &&
      <Box>
        <Typography variant="overline">BÁO GIÁ CŨ — KHÔNG CÒN ÁP DỤNG</Typography>
        <QuoteSummary quote={quote} tone="old" />
      </Box>}
    {phase === 'accepted' && quote && <QuoteSummary quote={quote} tone="active" />}
    {phase === 'idle' && <Paper square elevation={0} sx={{ p: 3 }}>
      <Typography>Bấm “Lấy báo giá” để máy chủ tính tiền hàng, phí giao và tổng tiền cho giỏ hiện tại.</Typography>
    </Paper>}
  </Box>;
}

import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { useCart } from '../../cart/CartProvider';
import { ContactAddressForm, validateContactDraft } from '../components/ContactAddressForm';
import { OrderConfirmation } from '../components/OrderConfirmation';
import { describeQuoteChanges, QuoteSummary } from '../components/QuoteSummary';
import { cartMatchesQuote, useCreateOrder, type ContactDraft } from '../hooks/useCreateOrder';
import { useCheckoutQuote } from '../hooks/useCheckoutQuote';

function expiryLine(remainingMs: number | null): string {
  if (remainingMs === null) return 'Đang xác định thời hạn báo giá.';
  const minutes = Math.max(0, Math.ceil(remainingMs / 60000));
  return `Báo giá có hiệu lực khoảng ${minutes} phút nữa.`;
}

const EMPTY_DRAFT: ContactDraft = { name: '', phone: '', email: '', province: '', district: '', ward: '', addressLine: '', note: '' };

export function CheckoutPage() {
  const cart = useCart();
  const navigate = useNavigate();
  const { phase, quote, pendingQuote, error: quoteError, remainingMs, fetchQuote, acceptPending } = useCheckoutQuote(cart.items);
  const { phase: submitPhase, result, error: submitError, fieldErrors, body, submit, retry, dismiss, markCartHandled, cartHandled } = useCreateOrder(quote);
  const [draft, setDraft] = useState<ContactDraft>(EMPTY_DRAFT);
  const [showDraftErrors, setShowDraftErrors] = useState(false);

  // On success: clear the cart only when the live cart is still the one that was submitted. The
  // once-per-command guard lives in the provider (review fix 6) so a page remount cannot re-run it
  // against a brand-new cart.
  const confirmed = submitPhase === 'confirmed' && result;
  const clearedNow = confirmed ? cartMatchesQuote(cart.items, result!.order.items) : false;
  useEffect(() => {
    if (submitPhase !== 'confirmed' || !result || cartHandled) return;
    if (cartMatchesQuote(cart.items, result.order.items)) {
      cart.clear();
    }
    markCartHandled();
  }, [submitPhase, result, cartHandled, markCartHandled, cart]);

  // An unclear outcome (review fix 4) survives quote expiry, cart edits and an empty cart: the
  // shopper must resolve it through Gửi lại before anything else happens on this page.
  if (submitPhase === 'unknown') {
    return <Box sx={{ py: { xs: 2, md: 4 }, maxWidth: 820, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <title>Đặt hàng COD | Clothing Shop</title>
      <Typography variant="h4" component="h1">Đặt hàng — thanh toán khi nhận hàng</Typography>
      <Alert severity="warning">
        {submitError ?? 'Không nhận được kết quả đặt hàng.'}
        <Box sx={{ mt: 1 }}>
          <Button variant="contained" onClick={() => { void retry(); }}>Gửi lại</Button>
        </Box>
        <Typography variant="body2" sx={{ mt: 1 }}>
          Đơn có thể đã được tạo từ lần gửi trước — “Gửi lại” dùng đúng nội dung và mã thao tác cũ để
          kiểm tra an toàn, không tạo trùng đơn và không tạo báo giá mới.
        </Typography>
      </Alert>
    </Box>;
  }

  if (cart.items.length === 0 && submitPhase !== 'confirmed') {
    return <Stack spacing={2} sx={{ py: 6, textAlign: 'center' }}>
      <Typography variant="h4" component="h1">Giỏ hàng trống</Typography>
      <Typography sx={{ color: 'text.secondary' }}>Hãy chọn một sản phẩm trước khi xem phí và tổng tiền.</Typography>
      <Box><Button component={RouterLink} to="/shop" variant="outlined">Quay lại mua hàng</Button></Box>
    </Stack>;
  }

  const quoteBusy = phase === 'pending';
  const quoteAction = phase === 'expired' ? 'Cập nhật báo giá' : phase === 'error' ? 'Thử lại' : 'Lấy báo giá';
  // After a definite order failure (e.g. QUOTE_CHANGED) the shopper must be able to re-quote even
  // though the quote hook still holds the accepted snapshot.
  const showQuoteAction = (phase !== 'accepted' && phase !== 'confirm') || submitPhase === 'failed';
  const quoteAccepted = phase === 'accepted' && quote;
  // 'unknown' never reaches here: the early return above owns that state exclusively.
  const formLocked = submitPhase === 'pending';
  const draftErrors = validateContactDraft(draft);
  const formUsable = quoteAccepted && !formLocked && Object.keys(draftErrors).length === 0;
  const serverFieldErrors = submitPhase === 'failed' ? fieldErrors : {};

  return <Box sx={{ py: { xs: 2, md: 4 }, maxWidth: 820, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
    <title>Đặt hàng COD | Clothing Shop</title>
    <Typography variant="h4" component="h1">Đặt hàng — thanh toán khi nhận hàng</Typography>
    <Typography sx={{ color: 'text.secondary' }}>
      Bước xem báo giá và nhập thông tin nhận hàng. Phương thức hiện tại: thanh toán khi nhận hàng (COD).
      Chưa có bước thanh toán trực tuyến.
    </Typography>
    <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
      {showQuoteAction && <Button variant="contained" disabled={quoteBusy || formLocked} onClick={() => { void fetchQuote(); }}>
        {quoteBusy ? 'Đang lấy báo giá…' : quoteAction}
      </Button>}
      <Button component={RouterLink} to="/cart" variant="outlined" disabled={formLocked}>Quay lại sửa giỏ</Button>
    </Stack>
    {quoteBusy && <Typography role="status">Đang lấy báo giá…</Typography>}
    {phase === 'error' && <Alert severity="error">
      {quoteError ?? 'Chưa lấy được báo giá. Vui lòng thử lại.'}
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

    {quoteAccepted && quote && submitPhase !== 'confirmed' && <>
      <ContactAddressForm value={draft} disabled={formLocked} serverErrors={serverFieldErrors}
        onChange={setDraft} onSubmit={(values) => { setDraft(values); void submit(values); }}
        submitDisabled={!formUsable}
        submitLabel={submitPhase === 'pending' ? 'Đang đặt hàng…' : 'Đặt hàng COD'}
        showDraftErrors={showDraftErrors} />
      {submitPhase === 'failed' && submitError && <Alert severity="error" role="alert">{submitError}</Alert>}
    </>}

    {confirmed && result &&
      <OrderConfirmation result={result} cartCleared={clearedNow}
        onContinue={() => { dismiss(); navigate('/shop'); }} />}
  </Box>;
}

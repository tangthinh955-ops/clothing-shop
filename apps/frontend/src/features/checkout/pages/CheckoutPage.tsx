import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { useCart } from '../../cart/CartProvider';
import { ContactAddressForm } from '../components/ContactAddressForm';
import { OrderConfirmation } from '../components/OrderConfirmation';
import { describeQuoteChanges, QuoteSummary } from '../components/QuoteSummary';
import { cartMatchesQuote, useCreateOrder } from '../hooks/useCreateOrder';
import { useCheckoutQuote } from '../hooks/useCheckoutQuote';
import { pageTitle } from '../../../shared/shop';

function expiryLine(remainingMs: number | null): string {
  if (remainingMs === null) return 'Đang xác định thời hạn báo giá.';
  const minutes = Math.max(0, Math.ceil(remainingMs / 60000));
  return `Báo giá có hiệu lực khoảng ${minutes} phút nữa.`;
}

export function CheckoutPage() {
  const cart = useCart();
  const navigate = useNavigate();
  const { phase, quote, pendingQuote, error: quoteError, remainingMs, fetchQuote, acceptPending } = useCheckoutQuote(cart.items);
  const { phase: submitPhase, result, error: submitError, fieldErrors, submit, retry, dismiss, markCartHandled, cartHandled,
    cartCleared, draft, setDraft } = useCreateOrder(quote);

  // On success: clear the cart only when the live cart is still the one that was submitted. The
  // once-per-command guard lives in the provider (review fix 6) so a page remount cannot re-run it
  // against a brand-new cart.
  // The outcome is recorded when the clear runs: comparing the cart afterwards would mistake the
  // emptied cart for a changed one.
  const confirmed = submitPhase === 'confirmed' && result;
  useEffect(() => {
    if (submitPhase !== 'confirmed' || !result || cartHandled) return;
    const matches = cartMatchesQuote(cart.items, result.order.items);
    if (matches) cart.clear();
    markCartHandled(matches);
  }, [submitPhase, result, cartHandled, markCartHandled, cart]);

  // The shopper came here to see the total: quote on arrival (and when a fresh cart appears) instead
  // of asking for an extra tap. A settled or unsettled order never triggers a new quote.
  const cartHasItems = cart.items.length > 0;
  useEffect(() => {
    if (phase !== 'idle' || !cartHasItems || submitPhase !== 'idle') return;
    void fetchQuote();
  }, [phase, cartHasItems, submitPhase, fetchQuote]);

  // An unclear outcome (review fix 4) survives quote expiry, cart edits and an empty cart: the
  // shopper must resolve it through Gửi lại before anything else happens on this page.
  if (submitPhase === 'unknown') {
    return <Box sx={{ py: { xs: 2, md: 4 }, maxWidth: 820, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <title>{pageTitle('Đặt hàng COD')}</title>
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

  // A placed order owns the page alone: nothing about quotes may sit above the success.
  if (confirmed && result) {
    return <Box sx={{ py: { xs: 2, md: 4 }, maxWidth: 820, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <title>{pageTitle('Đặt hàng COD')}</title>
      <Typography variant="h4" component="h1">Đặt hàng thành công</Typography>
      <OrderConfirmation result={result} cartCleared={!cartHandled || cartCleared}
        onContinue={() => { dismiss(); navigate('/shop'); }} />
    </Box>;
  }

  if (cart.items.length === 0) {
    return <Stack spacing={2} sx={{ py: 6, textAlign: 'center' }}>
      <Typography variant="h4" component="h1">Giỏ hàng trống</Typography>
      <Typography sx={{ color: 'text.secondary' }}>Hãy chọn một sản phẩm trước khi xem phí và tổng tiền.</Typography>
      <Box><Button component={RouterLink} to="/shop" variant="outlined">Quay lại mua hàng</Button></Box>
    </Stack>;
  }

  const quoteBusy = phase === 'pending';
  const quoteAction = phase === 'error' ? 'Thử lại' : 'Cập nhật báo giá';
  // The first quote comes on its own; the button only appears to refresh an expired, failed or
  // outdated one — including after a definite order failure (e.g. QUOTE_CHANGED), when the quote
  // hook still holds the accepted snapshot.
  const showQuoteAction = phase === 'expired' || phase === 'error' || phase === 'stale' || submitPhase === 'failed';
  const quoteAccepted = phase === 'accepted' && quote;
  // 'unknown' never reaches here: the early return above owns that state exclusively.
  const formLocked = submitPhase === 'pending';
  const serverFieldErrors = submitPhase === 'failed' ? fieldErrors : {};

  return <Box sx={{ py: { xs: 2, md: 4 }, maxWidth: 820, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
    <title>{pageTitle('Đặt hàng COD')}</title>
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

    {/* Once any quote has been seen the form stays, so an expired or outdated quote never wipes a
        half-typed address; only placing the order waits for a valid quote. */}
    {quote && <>
      <ContactAddressForm value={draft} disabled={formLocked} serverErrors={serverFieldErrors}
        onChange={setDraft} onSubmit={(values) => { setDraft(values); void submit(values); }}
        submitDisabled={!quoteAccepted || formLocked}
        submitLabel={submitPhase === 'pending' ? 'Đang đặt hàng…' : 'Đặt hàng COD'} />
      {submitPhase === 'failed' && submitError && <Alert severity="error" role="alert">{submitError}</Alert>}
    </>}
  </Box>;
}

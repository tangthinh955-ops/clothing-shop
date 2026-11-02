import { useState } from 'react';
import { Alert, Box, Button, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router';
import { formatMoney } from '../../catalog/catalogFormat';
import type { CreateOrderResult } from '../api/orders.api';

interface Props {
  result: CreateOrderResult;
  /** True when the live cart still matches the order's items (the cart was left untouched). */
  cartCleared: boolean;
  onContinue: () => void;
}

type CopyState = 'idle' | 'copied' | 'failed';

// In-app browsers (Instagram, Facebook) often block the clipboard; a failure must say so instead of
// leaving the shopper to believe the link was saved.
async function copyText(text: string): Promise<CopyState> {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** COD confirmation: order code, server snapshot, the explicit "chưa thu tiền" state and — exactly
 *  once, on the first committed create — the private access link for /orders/:code (M4.4.1). */
export function OrderConfirmation({ result, cartCleared, onContinue }: Props) {
  const navigate = useNavigate();
  const [codeCopy, setCodeCopy] = useState<CopyState>('idle');
  const [linkCopy, setLinkCopy] = useState<CopyState>('idle');
  const canShare = typeof navigator.share === 'function';
  // The token is never stored anywhere: it lives in the URL fragment of the private link only.
  const accessLink = result.lookupToken
    ? `${window.location.origin}/orders/${result.order.code}#t=${result.lookupToken}`
    : null;
  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <Alert severity="success">Đã tạo đơn hàng COD. Nhân viên sẽ gọi xác nhận trước khi giao.</Alert>
    <Paper square elevation={0} sx={{ p: { xs: 2.5, sm: 4 } }}>
      <Typography component="h2" variant="h5" sx={{ mb: 1 }}>Mã đơn của bạn</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} useFlexGap
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{result.order.code}</Typography>
        <Button variant="outlined" size="small" onClick={async () => setCodeCopy(await copyText(result.order.code))}>
          {codeCopy === 'copied' ? 'Đã sao chép' : 'Sao chép mã đơn'}
        </Button>
      </Stack>
      {codeCopy === 'failed' && <Typography variant="body2" role="status" sx={{ mb: 2 }}>
        Không sao chép được tự động. Hãy ghi lại mã đơn ở trên.
      </Typography>}
      <Typography sx={{ mb: 2 }}>
        Trạng thái: <strong>Chờ xác nhận</strong> · Thanh toán khi nhận hàng (COD) — <strong>chưa thu tiền</strong>.
      </Typography>
      {accessLink && <>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} useFlexGap sx={{ mb: 2, flexWrap: 'wrap' }}>
          <Button component={RouterLink} to={`/orders/${result.order.code}#t=${result.lookupToken}`}
            variant="contained">Xem đơn hàng</Button>
          <Button variant="outlined" onClick={async () => setLinkCopy(await copyText(accessLink))}>
            {linkCopy === 'copied' ? 'Đã sao chép link' : 'Sao chép link riêng'}
          </Button>
          {canShare && <Button variant="outlined" onClick={() => {
            // A dismissed share sheet rejects; the link stays on screen either way.
            navigator.share({ title: `Đơn hàng ${result.order.code}`, url: accessLink }).catch(() => undefined);
          }}>Chia sẻ link</Button>}
        </Stack>
        <TextField label="Link riêng của đơn" value={accessLink} size="small" fullWidth sx={{ mb: 1 }}
          slotProps={{ htmlInput: { readOnly: true, onFocus: (event: React.FocusEvent<HTMLInputElement>) => event.target.select() } }} />
        {linkCopy === 'failed' && <Typography variant="body2" role="status" sx={{ mb: 1 }}>
          Không sao chép được tự động. Hãy chạm vào ô link ở trên, chọn toàn bộ rồi sao chép.
        </Typography>}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Chỉ người có link riêng này mới xem được đơn — lưu lại hoặc gửi cho người nhận. Link giữ được
          giữa các lần mở lại trình duyệt và vẫn xem được sau khi làm mới trang.
        </Typography>
      </>}
      <Stack spacing={2}>
        {result.order.items.map((item) => <Stack key={item.variantId} direction="row" useFlexGap
          sx={{ justifyContent: 'space-between', gap: 2, alignItems: 'flex-start' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{item.productName}</Typography>
            <Typography variant="body2" color="text.secondary">{item.color} · size {item.size}</Typography>
            <Typography variant="body2">{formatMoney(item.unitPriceVnd)} × {item.quantity}</Typography>
          </Box>
          <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{formatMoney(item.lineTotalVnd)}</Typography>
        </Stack>)}
      </Stack>
      <Stack spacing={1} sx={{ borderTop: 1, borderColor: 'divider', mt: 2, pt: 2 }}>
        <Stack direction="row" useFlexGap sx={{ justifyContent: 'space-between' }}>
          <Typography>Tiền hàng</Typography>
          <Typography sx={{ fontWeight: 600 }}>{formatMoney(result.order.subtotal)}</Typography>
        </Stack>
        <Stack direction="row" useFlexGap sx={{ justifyContent: 'space-between' }}>
          <Typography>Phí giao hàng</Typography>
          <Typography sx={{ fontWeight: 600 }}>{formatMoney(result.order.shippingFee)}</Typography>
        </Stack>
        <Stack direction="row" useFlexGap sx={{ justifyContent: 'space-between' }}>
          <Typography sx={{ fontWeight: 700 }}>Tổng tiền</Typography>
          <Typography sx={{ fontWeight: 700 }}>{formatMoney(result.order.total)}</Typography>
        </Stack>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Hãy lưu lại mã đơn để tra cứu sau. Mất link riêng?{' '}
        {/* The lookup is the way back even when this answer was a replay without a fresh token. */}
        <Link component={RouterLink} to="/orders/lookup">Tra cứu bằng mã đơn và số điện thoại</Link>.
        {!cartCleared && ' Giỏ hàng của bạn vừa thay đổi nên vẫn được giữ nguyên.'}
      </Typography>
      <Stack direction="row" spacing={2} useFlexGap sx={{ mt: 2, flexWrap: 'wrap' }}>
        {/* Both actions end the confirmed intent first (m4.3.1 review fix 6): leaving it confirmed
            would re-show this order and could let a later cart-clear wipe a brand-new cart. */}
        <Button variant="contained" onClick={() => { onContinue(); navigate('/shop'); }}>Tiếp tục mua sắm</Button>
        <Button onClick={onContinue}>Đã lưu mã đơn</Button>
      </Stack>
    </Paper>
  </Box>;
}

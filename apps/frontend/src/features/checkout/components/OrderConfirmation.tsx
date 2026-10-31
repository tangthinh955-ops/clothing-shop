import { useState } from 'react';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router';
import { formatMoney } from '../../catalog/catalogFormat';
import type { CreateOrderResult } from '../api/orders.api';

interface Props {
  result: CreateOrderResult;
  /** True when the live cart still matches the order's items (the cart was left untouched). */
  cartCleared: boolean;
  onContinue: () => void;
}

/** COD confirmation: order code, server snapshot and the explicit "chưa thu tiền" state. */
export function OrderConfirmation({ result, cartCleared, onContinue }: Props) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <Alert severity="success">Đã tạo đơn hàng COD. Nhân viên sẽ gọi xác nhận trước khi giao.</Alert>
    <Paper square elevation={0} sx={{ p: { xs: 2.5, sm: 4 } }}>
      <Typography component="h2" variant="h5" sx={{ mb: 1 }}>Mã đơn của bạn</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} useFlexGap
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{result.order.code}</Typography>
        <Button variant="outlined" size="small" onClick={async () => {
          try {
            await navigator.clipboard.writeText(result.order.code);
            setCopied(true);
          } catch { /* the code stays visible for manual copying */ }
        }}>{copied ? 'Đã sao chép' : 'Sao chép mã đơn'}</Button>
      </Stack>
      <Typography sx={{ mb: 2 }}>
        Trạng thái: <strong>Chờ xác nhận</strong> · Thanh toán khi nhận hàng (COD) — <strong>chưa thu tiền</strong>.
      </Typography>
      <Stack spacing={2}>
        {result.order.items.map((item) => <Stack key={item.variantId} direction="row" useFlexGap
          sx={{ justifyContent: 'space-between', gap: 2, alignItems: 'flex-start' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{item.productName}</Typography>
            <Typography variant="body2" color="text.secondary">{item.color} · size {item.size} · {item.sku}</Typography>
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
        Hãy lưu lại mã đơn để tra cứu sau. {!cartCleared && 'Giỏ hàng của bạn vừa thay đổi nên vẫn được giữ nguyên.'}
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

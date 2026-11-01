import { Alert, Box, Button, Chip, Divider, Link, Paper, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link as RouterLink, useLocation, useParams } from 'react-router';
import { ApiError } from '../../../../shared/api/client';
import { pageTitle } from '../../../../shared/shop';
import { formatMoney } from '../../../catalog/catalogFormat';
import { ORDER_STATUS_LABELS } from '../../../orders/orderStatusLabels';
import { adminOrdersApi, adminOrdersKey, type AdminOrderDetail } from '../api/admin-orders.api';
import { OrderNotes } from '../components/OrderNotes';
import { formatOrderTime, METHOD_LABELS, SOURCE_LABELS } from '../orderLabels';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <Paper component="section" aria-labelledby={id} square elevation={0} sx={{ p: { xs: 2, sm: 3 }, overflowWrap: 'anywhere' }}>
    <Typography id={id} component="h2" variant="h6" sx={{ mb: 1.5 }}>{title}</Typography>
    {children}
  </Paper>;
}

function MoneyRow({ label, amount, strong = false }: { label: string; amount: number; strong?: boolean }) {
  return <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
    <Typography sx={{ fontWeight: strong ? 700 : 400 }}>{label}</Typography>
    <Typography sx={{ fontWeight: strong ? 700 : 400 }}>{formatMoney(amount)}</Typography>
  </Stack>;
}

function OrderView({ order, onNoteSaved }: { order: AdminOrderDetail; onNoteSaved: () => unknown }) {
  const { recipient, address } = order;
  const fullAddress = [address.addressLine, address.ward, address.district, address.province].filter(Boolean).join(', ');
  return <Stack spacing={2}>
    <Box>
      <Stack direction="row" useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 1 }}>
        <Typography component="h1" variant="h4" sx={{ overflowWrap: 'anywhere' }}>{order.code}</Typography>
        <Chip variant="outlined" label={ORDER_STATUS_LABELS[order.status]} />
      </Stack>
      <Typography color="text.secondary">
        {METHOD_LABELS[order.method]} · {SOURCE_LABELS[order.source]} · {formatOrderTime(order.createdAt)}
      </Typography>
      {order.trackingNumber && <Typography>Mã vận đơn: {order.trackingNumber}</Typography>}
      {order.cancelReason && <Typography>Lý do hủy: {order.cancelReason}</Typography>}
    </Box>
    <Section id="order-recipient-title" title="Người nhận">
      <Typography sx={{ fontWeight: 600 }}>{recipient.name}</Typography>
      <Link href={`tel:${recipient.phone}`} underline="always">{recipient.phone}</Link>
      {recipient.email && <Typography>{recipient.email}</Typography>}
      <Typography>{fullAddress}</Typography>
      {order.customerNote && <Box sx={{ mt: 1.5 }}>
        <Typography variant="body2" color="text.secondary">Ghi chú của khách</Typography>
        <Typography sx={{ whiteSpace: 'pre-line' }}>{order.customerNote}</Typography>
      </Box>}
    </Section>
    <Section id="order-items-title" title="Sản phẩm">
      <Stack component="ul" spacing={1.5} sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {order.items.map((item) => <Stack component="li" key={item.variantId} direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600 }}>{item.productName}</Typography>
            <Typography variant="body2" color="text.secondary">{item.sku} · {item.size} · {item.color}</Typography>
            <Typography variant="body2">{formatMoney(item.unitPriceVnd)} × {item.quantity}</Typography>
          </Box>
          <Typography sx={{ flexShrink: 0 }}>{formatMoney(item.lineTotalVnd)}</Typography>
        </Stack>)}
      </Stack>
      <Divider sx={{ my: 1.5 }} />
      <MoneyRow label="Tạm tính" amount={order.subtotalVnd} />
      <MoneyRow label="Phí giao" amount={order.shippingFeeVnd} />
      <MoneyRow label="Tổng cộng" amount={order.totalVnd} strong />
    </Section>
    <Section id="order-history-title" title="Lịch sử trạng thái">
      <Stack component="ul" spacing={1.5} sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {order.history.map((entry) => <Box component="li" key={entry.id}>
          <Typography sx={{ fontWeight: 500 }}>
            {entry.fromStatus ? `${ORDER_STATUS_LABELS[entry.fromStatus]} → ` : ''}{ORDER_STATUS_LABELS[entry.toStatus]}
          </Typography>
          <Typography variant="body2" color="text.secondary">{entry.actorName} · {formatOrderTime(entry.createdAt)}</Typography>
          {entry.reason && <Typography variant="body2">{entry.reason}</Typography>}
        </Box>)}
      </Stack>
    </Section>
    <Section id="order-notes-title" title="Ghi chú nội bộ">
      <OrderNotes orderId={order.id} notes={order.notes} onSaved={onNoteSaved} />
    </Section>
  </Stack>;
}

export function AdminOrderDetailPage() {
  const { orderId = '' } = useParams();
  const state: unknown = useLocation().state;
  // The list hands over its filters so the way back lands on the same view.
  const listSearch = state && typeof state === 'object' && 'listSearch' in state && typeof state.listSearch === 'string' ? state.listSearch : '';
  const order = useQuery({
    queryKey: [...adminOrdersKey, 'detail', orderId], queryFn: () => adminOrdersApi.detail(orderId), retry: false,
  });
  // A malformed id in the URL answers 400 and means the same thing to the admin as an unknown order.
  const notFound = order.error instanceof ApiError && (order.error.status === 404 || order.error.status === 400);

  return <Box sx={{ maxWidth: 760, mx: 'auto', py: { xs: 4, md: 6 } }}>
    <title>{pageTitle(order.data ? `Đơn ${order.data.code} | Quản trị` : 'Chi tiết đơn | Quản trị')}</title>
    <Button component={RouterLink} to={`/admin/orders${listSearch}`} sx={{ mb: 2 }}>Về danh sách đơn</Button>
    {order.isPending && <Typography role="status">Đang tải đơn hàng…</Typography>}
    {order.isError && <Stack spacing={2} sx={{ alignItems: 'flex-start', mb: 2 }}>
      <Alert severity="error" sx={{ width: '100%' }}>
        {notFound ? 'Không tìm thấy đơn hàng.' : order.error instanceof ApiError ? order.error.message : 'Chưa tải được đơn hàng. Vui lòng thử lại.'}
      </Alert>
      {!notFound && <Button variant="outlined" disabled={order.isFetching} onClick={() => { void order.refetch(); }}>Tải lại đơn hàng</Button>}
    </Stack>}
    {order.data && <OrderView order={order.data} onNoteSaved={() => order.refetch()} />}
  </Box>;
}

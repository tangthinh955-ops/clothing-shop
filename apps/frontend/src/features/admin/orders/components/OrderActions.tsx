import { Stack } from '@mui/material';
import type { OrderStatus } from '../../../orders/api/orders.api';
import { adminOrdersApi, type AdminOrderDetail } from '../api/admin-orders.api';
import { OrderCancelAction } from './OrderCancelAction';
import { OrderStepAction } from './OrderStepAction';

// Display only: the backend decides every transition again under the order lock.
const CANCELLABLE: readonly OrderStatus[] = ['PENDING', 'CONFIRMED', 'PACKING'];

interface OrderActionsProps {
  order: AdminOrderDetail;
  onChanged: () => unknown;
}

export function OrderActions({ order, onChanged }: OrderActionsProps) {
  const canConfirm = order.status === 'PENDING' && order.method === 'COD';
  const canPack = order.status === 'CONFIRMED';
  const canCancel = CANCELLABLE.includes(order.status);
  if (!canConfirm && !canPack && !canCancel) return null;

  return <Stack direction="row" useFlexGap sx={{ gap: 1, flexWrap: 'wrap' }}>
    {canConfirm && <OrderStepAction label="Xác nhận đơn" title={`Xác nhận đơn ${order.code}?`} submitLabel="Xác nhận"
      description="Đơn chuyển sang “Đã xác nhận” và không quay lại được. Hàng vẫn đang được giữ, chưa ghi nhận tiền."
      perform={(key) => adminOrdersApi.confirm(order.id, order.version, key)} onChanged={onChanged} />}
    {canPack && <OrderStepAction label="Đóng gói" title={`Đóng gói đơn ${order.code}?`} submitLabel="Đóng gói"
      description="Đơn chuyển sang “Đang đóng gói” và không quay lại được. Hàng vẫn đang được giữ; shop vẫn hủy được trước khi bàn giao."
      perform={(key) => adminOrdersApi.pack(order.id, order.version, key)} onChanged={onChanged} />}
    {canCancel && <OrderCancelAction order={order} onChanged={onChanged} />}
  </Stack>;
}

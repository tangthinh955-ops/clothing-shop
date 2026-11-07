import { Stack } from '@mui/material';
import type { OrderStatus } from '../../../orders/api/orders.api';
import { adminOrdersApi, type AdminOrderDetail } from '../api/admin-orders.api';
import { deliveryTimeProblem, fromVietnamInput, toVietnamInput } from '../deliveryTime';
import { OrderInputAction } from '../../../orders/components/OrderInputAction';
import { OrderStepAction } from './OrderStepAction';

// Display only: the backend decides every transition again under the order lock.
const CANCELLABLE: readonly OrderStatus[] = ['PENDING', 'CONFIRMED', 'PACKING'];
const TRACKING_PATTERN = /^[A-Za-z0-9._-]{3,100}$/;
const MIN_REASON_LENGTH = 3;
const MAX_REASON_LENGTH = 500;

interface OrderActionsProps {
  order: AdminOrderDetail;
  onChanged: () => unknown;
}

export function OrderActions({ order, onChanged }: OrderActionsProps) {
  const canConfirm = order.status === 'PENDING' && order.method === 'COD';
  const canPack = order.status === 'CONFIRMED';
  const canShip = order.status === 'PACKING';
  const canDeliver = order.status === 'SHIPPED';
  const canCancel = CANCELLABLE.includes(order.status);
  const customerWaiting = order.cancellationRequests.some((request) => request.status === 'PENDING');
  // Only a packing order with the exact waiting request can be refused (M4.5.8): the dialog carries
  // that request's id, so an ask opened after this page loaded can never be decided in its place.
  const waitingRequest = customerWaiting && canShip
    ? order.cancellationRequests.find((request) => request.status === 'PENDING')
    : undefined;
  if (!canConfirm && !canPack && !canShip && !canDeliver && !canCancel) return null;

  return <Stack direction="row" useFlexGap sx={{ gap: 1, flexWrap: 'wrap' }}>
    {canConfirm && <OrderStepAction label="Xác nhận đơn" title={`Xác nhận đơn ${order.code}?`} submitLabel="Xác nhận"
      description="Đơn chuyển sang “Đã xác nhận” và không quay lại được. Hàng vẫn đang được giữ, chưa ghi nhận tiền."
      perform={(key) => adminOrdersApi.confirm(order.id, order.version, key)} onChanged={onChanged} />}
    {canPack && <OrderStepAction label="Đóng gói" title={`Đóng gói đơn ${order.code}?`} submitLabel="Đóng gói"
      description="Đơn chuyển sang “Đang đóng gói” và không quay lại được. Hàng vẫn đang được giữ; shop vẫn hủy được trước khi bàn giao."
      perform={(key) => adminOrdersApi.pack(order.id, order.version, key)} onChanged={onChanged} />}
    {canShip && <OrderInputAction label="Bàn giao" title={`Bàn giao đơn ${order.code}?`} fieldLabel="Mã vận đơn" maxLength={100}
      description={`${customerWaiting ? 'Khách đang xin hủy đơn này: bàn giao nghĩa là không đồng ý yêu cầu hủy. ' : ''}Kho sẽ trừ số hàng của đơn này. Đơn đã bàn giao không hủy được và không quay lại được; mã vận đơn không sửa được sau khi lưu. Khách sẽ thấy mã này.`}
      validate={(value) => (TRACKING_PATTERN.test(value) ? '' : 'Chỉ gồm chữ, số, - _ . (3–100 ký tự).')}
      perform={(value, key) => adminOrdersApi.ship(order.id, order.version, value, key)} onChanged={onChanged} />}
    {waitingRequest && <OrderInputAction label="Từ chối yêu cầu hủy" title={`Từ chối yêu cầu hủy đơn ${order.code}?`} fieldLabel="Lý do từ chối" maxLength={MAX_REASON_LENGTH} multiline danger
      description="Đơn vẫn ở “Đang đóng gói”, kho và tiền không đổi, và khách sẽ thấy lý do này. Khách vẫn có thể gửi yêu cầu hủy mới. Không đồng ý mà hàng vẫn gửi đi thì dùng “Bàn giao”."
      validate={(value) => (value.length < MIN_REASON_LENGTH ? `Nhập lý do từ ${MIN_REASON_LENGTH} đến ${MAX_REASON_LENGTH} ký tự.` : '')}
      perform={(value, key) => adminOrdersApi.rejectCancellationRequest(order.id, waitingRequest.id, order.version, value, key)}
      onChanged={onChanged} />}
    {canDeliver && <OrderInputAction label="Giao thành công" title={`Ghi đơn ${order.code} đã giao?`} fieldLabel="Thời điểm giao (giờ Việt Nam)" inputType="datetime-local"
      description="Đơn chuyển sang “Đã giao” và không quay lại được. Kho không đổi; tiền COD vẫn chưa được ghi nhận. Thời hạn đổi trả tính từ thời điểm này, và khách sẽ thấy nó."
      initialValue={() => toVietnamInput(new Date())}
      validate={(value) => deliveryTimeProblem(value, order.history.findLast((entry) => entry.toStatus === 'SHIPPED')?.createdAt)}
      perform={(value, key) => adminOrdersApi.deliver(order.id, order.version, fromVietnamInput(value).toISOString(), key)} onChanged={onChanged} />}
    {canCancel && <OrderInputAction label="Hủy đơn" title={`Hủy đơn ${order.code}?`} fieldLabel="Lý do hủy" maxLength={MAX_REASON_LENGTH} multiline danger
      description="Hàng đang giữ được trả lại để bán tiếp. Đơn đã hủy không mở lại được. Khách sẽ thấy lý do này; nội dung chỉ dành cho shop hãy ghi vào ghi chú nội bộ."
      validate={(value) => (value.length < MIN_REASON_LENGTH ? `Nhập lý do từ ${MIN_REASON_LENGTH} đến ${MAX_REASON_LENGTH} ký tự.` : '')}
      perform={(value, key) => adminOrdersApi.cancel(order.id, order.version, value, key)} onChanged={onChanged} />}
  </Stack>;
}

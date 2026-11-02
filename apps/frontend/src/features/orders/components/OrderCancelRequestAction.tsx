import { ordersApi } from '../api/orders.api';
import { OrderInputAction } from './OrderInputAction';

const MIN_REASON_LENGTH = 3;
const MAX_REASON_LENGTH = 500;

interface OrderCancelRequestActionProps {
  code: string;
  token: string;
  onChanged: () => unknown;
}

export function OrderCancelRequestAction({ code, token, onChanged }: OrderCancelRequestActionProps) {
  return <OrderInputAction label="Xin hủy đơn" title={`Xin hủy đơn ${code}?`} fieldLabel="Lý do xin hủy" maxLength={MAX_REASON_LENGTH} multiline danger
    description="Đơn đang được đóng gói nên việc hủy cần shop đồng ý; đơn chưa bị hủy cho tới khi shop xử lý. Nếu hàng đã gửi đi thì đơn không hủy được nữa. Shop sẽ thấy lý do này."
    validate={(value) => (value.length < MIN_REASON_LENGTH ? `Nhập lý do từ ${MIN_REASON_LENGTH} đến ${MAX_REASON_LENGTH} ký tự.` : '')}
    perform={(value, key) => ordersApi.requestCancellation(code, token, value, key)} onChanged={onChanged} />;
}

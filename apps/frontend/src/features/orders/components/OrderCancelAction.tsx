import { ordersApi } from '../api/orders.api';
import { OrderInputAction } from './OrderInputAction';

const MIN_REASON_LENGTH = 3;
const MAX_REASON_LENGTH = 500;

interface OrderCancelActionProps {
  code: string;
  token: string;
  /** The version the customer is looking at: if the shop moved the order meanwhile, the server refuses. */
  version: number;
  onChanged: () => unknown;
}

export function OrderCancelAction({ code, token, version, onChanged }: OrderCancelActionProps) {
  return <OrderInputAction label="Hủy đơn" title={`Hủy đơn ${code}?`} fieldLabel="Lý do hủy" maxLength={MAX_REASON_LENGTH} multiline danger
    description="Đơn đã hủy không mở lại được; muốn mua lại bạn cần đặt đơn mới. Shop sẽ thấy lý do này."
    validate={(value) => (value.length < MIN_REASON_LENGTH ? `Nhập lý do từ ${MIN_REASON_LENGTH} đến ${MAX_REASON_LENGTH} ký tự.` : '')}
    perform={(value, key) => ordersApi.cancel(code, token, version, value, key)} onChanged={onChanged} />;
}

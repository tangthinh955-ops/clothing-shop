import type { OrderStatus } from './api/orders.api';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PACKING: 'Đang đóng gói',
  SHIPPED: 'Đã bàn giao vận chuyển',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
  DELIVERY_FAILED: 'Giao thất bại',
  RETURNED_TO_SHOP: 'Đã trả về cửa hàng',
};

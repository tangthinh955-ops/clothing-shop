import type { AdminOrderRow } from './api/admin-orders.api';

export const SOURCE_LABELS: Record<AdminOrderRow['source'], string> = { WEB: 'Website', INSTAGRAM: 'Instagram' };
export const METHOD_LABELS: Record<AdminOrderRow['method'], string> = { COD: 'COD', BANK_TRANSFER: 'Chuyển khoản' };

const ORDER_TIME = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });

export function formatOrderTime(value: string) {
  return ORDER_TIME.format(new Date(value));
}

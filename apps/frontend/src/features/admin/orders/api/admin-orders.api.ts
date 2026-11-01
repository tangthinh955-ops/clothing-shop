import { request } from '../../../../shared/api/client';
import type { OrderStatus } from '../../../orders/api/orders.api';

export interface AdminOrderRow {
  id: string;
  code: string;
  status: OrderStatus;
  source: 'WEB' | 'INSTAGRAM';
  method: 'COD' | 'BANK_TRANSFER';
  totalVnd: number;
  recipientName: string;
  phone: string;
  itemCount: number;
  createdAt: string;
}

export interface AdminOrderList {
  items: AdminOrderRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminOrderFilters {
  status: string;
  q: string;
  page: number;
}

export const ADMIN_ORDERS_PAGE_SIZE = 20;
export const adminOrdersKey = ['admin-orders'] as const;

export const adminOrdersApi = {
  // GET /api/v1/admin/orders — ADMIN only; newest first, filtered by delivery status and code/phone/name.
  list({ status, q, page }: AdminOrderFilters) {
    const search = new URLSearchParams();
    if (status) search.set('status', status);
    if (q) search.set('q', q);
    search.set('page', String(page));
    search.set('pageSize', String(ADMIN_ORDERS_PAGE_SIZE));
    return request<AdminOrderList>(`/admin/orders?${search.toString()}`);
  },
};

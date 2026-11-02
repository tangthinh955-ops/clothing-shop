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

export interface AdminOrderItem {
  variantId: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  unitPriceVnd: number;
  quantity: number;
  lineTotalVnd: number;
}

export interface AdminOrderHistoryEntry {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorName: string;
  reason: string | null;
  version: number;
  createdAt: string;
}

export interface AdminOrderNote {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
}

export interface AdminOrderDetail {
  id: string;
  code: string;
  status: OrderStatus;
  source: AdminOrderRow['source'];
  method: AdminOrderRow['method'];
  currency: string;
  version: number;
  createdAt: string;
  bankDeadlineAt: string | null;
  trackingNumber: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  recipient: { name: string; phone: string; email: string | null };
  address: { province: string; district: string; ward: string; addressLine: string };
  customerNote: string | null;
  subtotalVnd: number;
  shippingFeeVnd: number;
  totalVnd: number;
  items: AdminOrderItem[];
  history: AdminOrderHistoryEntry[];
  notes: AdminOrderNote[];
}

export interface AdminOrderTransition {
  id: string;
  code: string;
  status: OrderStatus;
  version: number;
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
  // GET /api/v1/admin/orders/:id — snapshot, status history and internal notes of one order.
  detail(id: string) {
    return request<AdminOrderDetail>(`/admin/orders/${encodeURIComponent(id)}`);
  },
  // POST /api/v1/admin/orders/:id/confirm — PENDING to CONFIRMED; a stale version or wrong status answers 409.
  confirm(id: string, expectedVersion: number, idempotencyKey: string) {
    return request<AdminOrderTransition>(`/admin/orders/${encodeURIComponent(id)}/confirm`,
      { method: 'POST', body: { expectedVersion }, idempotencyKey });
  },
  // POST /api/v1/admin/orders/:id/pack — CONFIRMED to PACKING; stock and money do not change.
  pack(id: string, expectedVersion: number, idempotencyKey: string) {
    return request<AdminOrderTransition>(`/admin/orders/${encodeURIComponent(id)}/pack`,
      { method: 'POST', body: { expectedVersion }, idempotencyKey });
  },
  // POST /api/v1/admin/orders/:id/ship — PACKING to SHIPPED; takes the goods out of stock once; the customer sees the number.
  ship(id: string, expectedVersion: number, trackingNumber: string, idempotencyKey: string) {
    return request<AdminOrderTransition>(`/admin/orders/${encodeURIComponent(id)}/ship`,
      { method: 'POST', body: { expectedVersion, trackingNumber }, idempotencyKey });
  },
  // POST /api/v1/admin/orders/:id/deliver — SHIPPED to DELIVERED at the real delivery time; stock and money do not change.
  deliver(id: string, expectedVersion: number, deliveredAt: string, idempotencyKey: string) {
    return request<AdminOrderTransition>(`/admin/orders/${encodeURIComponent(id)}/deliver`,
      { method: 'POST', body: { expectedVersion, deliveredAt }, idempotencyKey });
  },
  // POST /api/v1/admin/orders/:id/cancel — before handover only; releases held stock once; the customer sees the reason.
  cancel(id: string, expectedVersion: number, reason: string, idempotencyKey: string) {
    return request<AdminOrderTransition>(`/admin/orders/${encodeURIComponent(id)}/cancel`,
      { method: 'POST', body: { expectedVersion, reason }, idempotencyKey });
  },
  // POST /api/v1/admin/orders/:id/notes — append-only internal note; the key makes a resend safe.
  addNote(id: string, body: string, idempotencyKey: string) {
    return request<AdminOrderNote>(`/admin/orders/${encodeURIComponent(id)}/notes`, { method: 'POST', body: { body }, idempotencyKey });
  },
};

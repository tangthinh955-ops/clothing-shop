import { request } from '../../../../shared/api/client';

export interface InventoryItem {
  variantId: string;
  sku: string;
  size: string;
  color: string;
  productName: string;
  onHand: number;
  reserved: number;
  available: number;
  version: number;
}

export interface InventoryList {
  items: InventoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdjustmentInput {
  variantId: string;
  delta: number;
  reason: string;
  expectedVersion: number;
}

export interface AdjustmentResult {
  variantId: string;
  onHand: number;
  reserved: number;
  available: number;
  version: number;
}

export const inventoryKey = ['admin-inventory'] as const;

export const inventoryApi = {
  list: (q: string, page: number, variantId?: string) => {
    const search = new URLSearchParams();
    if (variantId) search.set('variantId', variantId);
    if (q) search.set('q', q);
    search.set('page', String(page));
    search.set('pageSize', '24');
    return request<InventoryList>(`/admin/inventory?${search.toString()}`);
  },
  adjust: (input: AdjustmentInput, idempotencyKey: string) =>
    request<AdjustmentResult>('/admin/inventory/adjustments', { method: 'POST', body: input, idempotencyKey }),
};

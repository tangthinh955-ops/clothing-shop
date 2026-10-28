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

export const inventoryKey = ['admin-inventory'] as const;

export const inventoryApi = {
  list: (q: string, page: number) => {
    const search = new URLSearchParams();
    if (q) search.set('q', q);
    search.set('page', String(page));
    search.set('pageSize', '24');
    return request<InventoryList>(`/admin/inventory?${search.toString()}`);
  },
};

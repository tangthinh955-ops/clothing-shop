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

export type MovementSource = 'ADMIN_ADJUSTMENT' | 'ORDER_RESERVE' | 'ORDER_RELEASE' | 'ORDER_SHIP';
export type MovementActorType = 'ADMIN' | 'GUEST' | 'SYSTEM';

export interface MovementRow {
  id: string;
  variantId: string;
  delta: number;
  reason: string;
  before: number;
  after: number;
  reserved: number;
  version: number;
  createdAt: string;
  actorType: MovementActorType;
  source: MovementSource;
  effectKey: string | null;
  actor: { name: string };
  variant: { sku: string };
}

export interface MovementList {
  items: MovementRow[];
  total: number;
  page: number;
  pageSize: number;
}

export const inventoryKey = ['admin-inventory'] as const;
export const MOVEMENT_PAGE_SIZE = 10;

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
  movements: (variantId: string, page: number) => {
    const search = new URLSearchParams();
    search.set('variantId', variantId);
    search.set('page', String(page));
    search.set('pageSize', String(MOVEMENT_PAGE_SIZE));
    return request<MovementList>(`/admin/inventory/movements?${search.toString()}`);
  },
};

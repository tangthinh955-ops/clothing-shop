import { request } from '../../../../shared/api/client';

export const productSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'FREESIZE'] as const;
export type ProductSize = typeof productSizes[number];
export interface VariantInput {
  sku: string;
  size: ProductSize;
  color: string;
  price: number;
  active: boolean;
}
export interface ProductInput {
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  variants: VariantInput[];
}
// Saved variants keep their id; a new variant omits it so the backend creates it with inventory 0.
export interface VariantUpdateInput extends VariantInput {
  id?: string;
}
export interface ProductUpdateInput {
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  variants: VariantUpdateInput[];
  expectedVersion: number;
}
// The backend VariantDto enforces the size allowlist on every write, so variants read back keep the ProductSize type.
export interface ProductVariant extends VariantInput {
  id: string;
  available: number;
}
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  category: { id: string; name: string; slug: string };
  priceFrom: number;
  status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
  version: number;
  images: { id: string; url: string }[];
  variants: ProductVariant[];
}
export interface ProductImagesInput {
  assetIds: string[];
  expectedVersion: number;
}
export interface ProductPage {
  items: Product[];
  page: number;
  pageSize: number;
  total: number;
}
export const productsKey = ['admin-products'] as const;
export const productsApi = {
  list: (page: number) => request<ProductPage>(`/admin/products?page=${page}&pageSize=24`),
  detail: (id: string) => request<Product>(`/admin/products/${encodeURIComponent(id)}`),
  create: (input: ProductInput) => request<Product>('/admin/products', { method: 'POST', body: input }),
  update: (id: string, input: ProductUpdateInput) => request<Product>(`/admin/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: input }),
  images: (id: string, input: ProductImagesInput) => request<Product>(`/admin/products/${encodeURIComponent(id)}/images`, { method: 'PUT', body: input }),
  // The backend rechecks category, images and active variants inside the transaction; a failed check is a 409.
  publish: (id: string, expectedVersion: number) => request<Product>(`/admin/products/${encodeURIComponent(id)}/publish`, { method: 'POST', body: { expectedVersion } }),
  hide: (id: string, expectedVersion: number) => request<Product>(`/admin/products/${encodeURIComponent(id)}/hide`, { method: 'POST', body: { expectedVersion } }),
};

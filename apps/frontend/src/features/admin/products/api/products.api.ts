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
export interface VariantUpdateInput extends VariantInput {
  id: string;
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
};

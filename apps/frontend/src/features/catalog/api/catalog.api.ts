import { request } from '../../../shared/api/client';

export interface CatalogCategory { id: string; name: string; slug: string }

export interface CatalogImage { id: string; url: string }

export interface CatalogVariant {
  id: string; sku: string; size: string; color: string; price: number; active: boolean; available: number;
}

export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  category: CatalogCategory;
  priceFrom: number;
  images: CatalogImage[];
  variants: CatalogVariant[];
}

export interface CatalogList { items: CatalogProduct[]; total: number; page: number; pageSize: number }

export interface CatalogFilters { q: string; page: number; sort: string; categoryId?: string }

export const CATALOG_PAGE_SIZE = 12;
export const catalogKey = ['shop-catalog'] as const;
export const catalogCategoriesKey = ['shop-catalog-categories'] as const;
export const catalogDetailKey = ['shop-catalog-detail'] as const;
export const catalogHomeKey = ['shop-home'] as const;

export const catalogApi = {
  // GET /api/v1/products — danh sách hàng công khai; chỉ trạng thái PUBLISHED (backend lọc).
  list({ q, page, sort, categoryId }: CatalogFilters) {
    const search = new URLSearchParams();
    if (categoryId) search.set('categoryId', categoryId);
    if (q) search.set('q', q);
    if (sort !== 'newest') search.set('sort', sort);
    search.set('page', String(page));
    search.set('pageSize', String(CATALOG_PAGE_SIZE));
    return request<CatalogList>(`/products?${search.toString()}`);
  },
  // GET /api/v1/categories — danh mục đang bật cho ô lọc.
  categories() {
    return request<CatalogCategory[]>('/categories');
  },
  // GET /api/v1/products/:slug — chi tiết hàng công khai; 404 khi hàng ẩn, danh mục tắt hoặc slug sai.
  detail(slug: string) {
    return request<CatalogProduct>(`/products/${encodeURIComponent(slug)}`);
  },
};

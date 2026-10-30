import { useQuery } from '@tanstack/react-query';
import { catalogApi, catalogCategoriesKey } from '../api/catalog.api';

// Same cache key as the collection page, so the store header, menu, footer and home page share one request.
export function useCatalogCategories() {
  const categories = useQuery({ queryKey: catalogCategoriesKey, queryFn: catalogApi.categories, retry: false });
  return categories.data ?? [];
}

export function categoryHref(categoryId: string) {
  return `/shop?categoryId=${encodeURIComponent(categoryId)}`;
}

import { useSearchParams } from 'react-router';

const CATEGORY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const SORTS = ['newest', 'price-asc', 'price-desc'] as const;
export type SortValue = (typeof SORTS)[number];
export const SORT_LABELS: Record<SortValue, string> = {
  newest: 'Mới nhất', 'price-asc': 'Giá thấp đến cao', 'price-desc': 'Giá cao đến thấp',
};

// The collection's filters live on the URL so a shared link, reload or Back shows the same list.
export function useCatalogFilters() {
  const [search, setSearch] = useSearchParams();
  const q = (search.get('q') ?? '').trim();
  const rawPage = search.get('page') ?? '1';
  const page = Number(rawPage);
  const validPage = /^\d+$/.test(rawPage) && Number.isInteger(page) && page >= 1 && page <= 100000;
  const validSearch = q.length <= 80;
  const rawSort = search.get('sort') ?? 'newest';
  const validSort = (SORTS as readonly string[]).includes(rawSort);
  const sort = rawSort as SortValue;
  const categoryId = search.get('categoryId') ?? '';
  const validCategory = categoryId === '' || CATEGORY_ID_PATTERN.test(categoryId);

  function updateSearch(mutate: (next: URLSearchParams) => void) {
    setSearch((previous) => {
      const next = new URLSearchParams(previous);
      mutate(next);
      return next;
    });
  }

  return {
    q, page, sort, rawSort, categoryId,
    validPage, validSearch, validSort, validCategory,
    hasFilters: q !== '' || categoryId !== '' || rawSort !== 'newest',
    usable: validPage && validSearch && validSort && validCategory,
    changeSearch(term: string, nextPage: number) {
      updateSearch((next) => {
        if (term) next.set('q', term); else next.delete('q');
        next.set('page', String(nextPage));
      });
    },
    changeSort(nextSort: string) {
      updateSearch((next) => {
        next.set('sort', nextSort);
        next.set('page', '1');
      });
    },
    changeCategory(nextCategory: string) {
      updateSearch((next) => {
        if (nextCategory) next.set('categoryId', nextCategory); else next.delete('categoryId');
        next.set('page', '1');
      });
    },
    clearFilters() {
      updateSearch((next) => {
        next.delete('q');
        next.delete('sort');
        next.delete('categoryId');
        next.delete('page');
      });
    },
  };
}

import { Alert, Box, Button, Pagination, Stack, Typography } from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ApiError } from '../../../shared/api/client';
import { pageTitle } from '../../../shared/shop';
import { CATALOG_PAGE_SIZE, catalogApi, catalogCategoriesKey, catalogKey } from '../api/catalog.api';
import { CatalogToolbar } from '../components/CatalogToolbar';
import { ProductCard } from '../components/ProductCard';
import { useCatalogFilters } from '../hooks/useCatalogFilters';

export function CatalogPage() {
  const filters = useCatalogFilters();
  const { q, page, sort, rawSort, categoryId, usable } = filters;

  const products = useQuery({
    queryKey: [...catalogKey, categoryId, q, rawSort, sort, page],
    queryFn: () => catalogApi.list({ q, page, sort, ...(categoryId ? { categoryId } : {}) }),
    enabled: usable, retry: false,
    // Keep the current cards while another page or filter loads instead of collapsing the grid.
    placeholderData: keepPreviousData,
  });
  const categories = useQuery({ queryKey: catalogCategoriesKey, queryFn: catalogApi.categories, retry: false, enabled: usable });
  const category = categories.data?.find((item) => item.id === categoryId);
  // An old link or breadcrumb can point at a category that was turned off; say so rather than show "all".
  const categoryGone = categoryId !== '' && categories.data !== undefined && category === undefined;
  const heading = q && filters.validSearch ? `Kết quả cho “${q}”`
    : categoryId ? category?.name ?? 'Danh mục' : 'Tất cả sản phẩm';

  return <Box sx={{ py: { xs: 3, md: 5 }, minWidth: 0 }}>
    <title>{pageTitle(heading)}</title>
    <Typography component="h1" variant="h3" sx={{ mb: { xs: 2, md: 3 }, overflowWrap: 'anywhere' }}>{heading}</Typography>

    {!usable ? <Stack spacing={2}>
      <Alert severity="error">{!filters.validPage ? 'Số trang không hợp lệ.'
        : !filters.validSearch ? 'Từ khóa tối đa 80 ký tự.' : 'Bộ lọc không hợp lệ.'}</Alert>
      {!filters.validPage && <Button variant="outlined" onClick={() => filters.changeSearch(q, 1)}>Về trang đầu</Button>}
      {!filters.validSearch && <Button variant="outlined" onClick={() => filters.changeSearch('', 1)}>Xóa tìm kiếm</Button>}
      {(!filters.validSort || !filters.validCategory)
        && <Button variant="outlined" onClick={filters.clearFilters}>Xóa lọc</Button>}
    </Stack> : <>
      <CatalogToolbar categories={categories.data} categoriesFailed={categories.isError} categoryId={categoryId} q={q} sort={sort}
        total={categoryGone ? undefined : products.data?.total} hasFilters={filters.hasFilters}
        onCategory={filters.changeCategory} onSort={filters.changeSort}
        onClearSearch={() => filters.changeSearch('', 1)} onClearFilters={filters.clearFilters} />
      {categoryGone ? <Alert severity="warning">Danh mục này không còn hiển thị.</Alert> : <Stack spacing={3}>
        {products.isPending && <Typography role="status">Đang tải bộ sưu tập…</Typography>}
        {products.isError && <Stack spacing={2}>
          <Alert severity="error">
            {products.error instanceof ApiError ? products.error.message : 'Chưa tải được bộ sưu tập. Vui lòng thử lại.'}
            {products.data && ' Số liệu bên dưới là lần tải trước, có thể đã thay đổi.'}
          </Alert>
          <Button variant="outlined" disabled={products.isFetching}
            onClick={() => { void products.refetch({ cancelRefetch: false }); }}>Tải lại bộ sưu tập</Button>
        </Stack>}
        {products.isFetching && !products.isPending && <Typography role="status">Đang cập nhật bộ sưu tập…</Typography>}
        {products.data && <>
          {products.data.items.length === 0 ? <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography>{page > 1 ? 'Trang này không có sản phẩm.'
              : filters.hasFilters ? 'Chưa có sản phẩm phù hợp bộ lọc hiện tại.' : 'Chưa có sản phẩm nào. Hãy quay lại sau.'}</Typography>
            {page > 1 && <Button onClick={() => filters.changeSearch(q, 1)} sx={{ mt: 1 }}>Về trang đầu</Button>}
          </Box> : <Box component="ul" aria-label="Danh sách sản phẩm" sx={{
            m: 0, p: 0, listStyle: 'none', display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
            columnGap: { xs: 1.5, md: 3 }, rowGap: { xs: 3, md: 5 },
          }}>
            {products.data.items.map((item) => <ProductCard key={item.id} item={item} />)}
          </Box>}
          {products.data.total > CATALOG_PAGE_SIZE && <Pagination
            count={Math.min(100000, Math.ceil(products.data.total / CATALOG_PAGE_SIZE))} page={page}
            disabled={products.isPlaceholderData} sx={{ alignSelf: 'center', mt: 2 }}
            siblingCount={0} aria-label="Phân trang bộ sưu tập" onChange={(_event, value) => filters.changeSearch(q, value)}
            getItemAriaLabel={(type, value, selected) => type === 'page' ? `${selected ? 'Đang ở trang' : 'Trang'} ${value}`
              : type === 'next' ? 'Trang sau' : type === 'previous' ? 'Trang trước' : type === 'first' ? 'Trang đầu' : 'Trang cuối'} />}
        </>}
      </Stack>}
    </>}
  </Box>;
}

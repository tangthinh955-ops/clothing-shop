import { Alert, Box, Button, Link, Pagination, Paper, Stack, TextField, Typography } from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { ApiError } from '../../../shared/api/client';
import { CATALOG_PAGE_SIZE, catalogApi, catalogCategoriesKey, catalogKey, type CatalogProduct } from '../api/catalog.api';
import { pageTitle } from '../../../shared/shop';

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const CATEGORY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SORTS = ['newest', 'price-asc', 'price-desc'] as const;
type SortValue = (typeof SORTS)[number];
const SORT_LABELS: Record<SortValue, string> = {
  newest: 'Mới nhất', 'price-asc': 'Giá thấp đến cao', 'price-desc': 'Giá cao đến thấp',
};

function ProductCard({ item }: { item: CatalogProduct }) {
  const cover = item.images[0];
  return <Box component="li" aria-label={item.name} sx={{ minWidth: 0, listStyle: 'none' }}>
    <Paper square elevation={0} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {cover ? <Box component="img" src={cover.url} alt={`Ảnh của ${item.name}`} loading="lazy"
          sx={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }} />
        : <Box sx={{ aspectRatio: '3/4', display: 'grid', placeItems: 'center', bgcolor: '#f3efe7' }}>
            <Typography color="text.secondary">Chưa có ảnh</Typography>
          </Box>}
      <Stack sx={{ p: 2, gap: 0.5, flex: 1 }}>
        <Typography variant="body2" color="text.secondary">{item.category.name}</Typography>
        <Link component={RouterLink} to={`/products/${item.slug}`} sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
          {item.name}
        </Link>
        <Typography>Giá từ {money.format(item.priceFrom)}</Typography>
      </Stack>
    </Paper>
  </Box>;
}

export function CatalogPage() {
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
  const hasFilters = q !== '' || categoryId !== '' || rawSort !== 'newest';
  const filtersUsable = validPage && validSearch && validSort && validCategory;

  const products = useQuery({
    queryKey: [...catalogKey, categoryId, q, rawSort, sort, page],
    queryFn: () => catalogApi.list({ q, page, sort, ...(validCategory && categoryId ? { categoryId } : {}) }),
    enabled: validPage && validSearch && validSort && validCategory, retry: false,
    // Keep the current cards while another page or filter loads instead of collapsing the grid.
    placeholderData: keepPreviousData,
  });
  const categories = useQuery({
    queryKey: catalogCategoriesKey, queryFn: catalogApi.categories, retry: false,
    enabled: filtersUsable,
  });
  // An old link or breadcrumb can point at a category that was turned off; say so rather than show "all".
  const categoryGone = categoryId !== '' && categories.data !== undefined
    && !categories.data.some((category) => category.id === categoryId);

  function updateSearch(mutate: (next: URLSearchParams) => void) {
    setSearch((previous) => {
      const next = new URLSearchParams(previous);
      mutate(next);
      return next;
    });
  }

  function changeSearch(term: string, nextPage: number) {
    updateSearch((next) => {
      if (term) next.set('q', term); else next.delete('q');
      next.set('page', String(nextPage));
    });
  }

  function changeSort(nextSort: string) {
    updateSearch((next) => {
      next.set('sort', nextSort);
      next.set('page', '1');
    });
  }

  function changeCategory(nextCategory: string) {
    updateSearch((next) => {
      if (nextCategory) next.set('categoryId', nextCategory); else next.delete('categoryId');
      next.set('page', '1');
    });
  }

  function clearFilters() {
    updateSearch((next) => {
      next.delete('q');
      next.delete('sort');
      next.delete('categoryId');
      next.delete('page');
    });
  }

  return <Box sx={{ py: { xs: 3, md: 5 }, minWidth: 0 }}>
    <title>{pageTitle('Bộ sưu tập')}</title>
    <Typography variant="overline" sx={{ letterSpacing: '.2em' }}>EVERYDAY ESSENTIALS</Typography>
    <Typography component="h1" variant="h2" sx={{ fontFamily: 'Georgia, serif', fontSize: { xs: 36, md: 52 }, my: 2 }}>
      Bộ sưu tập
    </Typography>
    <Typography color="text.secondary" sx={{ mb: 4, maxWidth: 640 }}>
      Xem hàng đã đăng, lọc theo danh mục, sắp theo giá rồi chia trang. Bộ lọc nằm trên đường dẫn nên quay lại vẫn giữ.
    </Typography>

    <Stack spacing={2} sx={{ mb: 4, maxWidth: 760 }}>
      <Box component="form" key={q} role="search" aria-label="Tìm kiếm bộ sưu tập" onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const term = data.get('q');
        if (typeof term === 'string') changeSearch(term.trim(), 1);
      }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} useFlexGap>
          <TextField name="q" label="Tìm theo tên hoặc SKU" defaultValue={q} fullWidth sx={{ minWidth: 0 }}
            slotProps={{ htmlInput: { maxLength: 80 } }} helperText="Tối đa 80 ký tự. Nhấn Enter hoặc Tìm kiếm để áp dụng." />
          <Button type="submit" variant="contained">Tìm kiếm</Button>
        </Stack>
      </Box>
      {q && filtersUsable
        && <Button variant="outlined" onClick={() => changeSearch('', 1)} sx={{ alignSelf: 'flex-start' }}>Xóa tìm kiếm</Button>}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} useFlexGap>
        <TextField select label="Thứ tự sắp xếp" value={sort} onChange={(event) => changeSort(event.target.value)}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }} fullWidth>
          {(SORTS as readonly string[]).map((value) => <option key={value} value={value}>{SORT_LABELS[value as SortValue]}</option>)}
        </TextField>
        <TextField select label="Danh mục" value={categoryId} disabled={categories.isPending}
          onChange={(event) => changeCategory(event.target.value)}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }} fullWidth
          helperText={categories.isError ? 'Không tải được danh mục. Danh sách hàng vẫn dùng được.' : undefined}>
          <option value="">Tất cả danh mục</option>
          {categoryGone && <option value={categoryId} disabled>Danh mục không còn hiển thị</option>}
          {(categories.data ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </TextField>
        {hasFilters && filtersUsable
          && <Button variant="outlined" onClick={clearFilters} sx={{ alignSelf: { sm: 'center' } }}>Xóa lọc</Button>}
      </Stack>
    </Stack>

    {!filtersUsable ? <Stack spacing={2}>
      <Alert severity="error">{!validPage ? 'Số trang không hợp lệ.'
        : !validSearch ? 'Từ khóa tối đa 80 ký tự.' : 'Bộ lọc không hợp lệ.'}</Alert>
      {!validPage && <Button variant="outlined" onClick={() => changeSearch(q, 1)}>Về trang đầu</Button>}
      {!validSearch && <Button variant="outlined" onClick={() => changeSearch('', 1)}>Xóa tìm kiếm</Button>}
      {(!validSort || !validCategory) && <Button variant="outlined" onClick={clearFilters}>Xóa lọc</Button>}
    </Stack> : categoryGone ? <Alert severity="warning">Danh mục này không còn hiển thị.</Alert> : <Stack spacing={3}>
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
        <Typography role="status">Tìm thấy {products.data.total} sản phẩm.</Typography>
        {products.data.items.length === 0 ? <Paper square elevation={0} sx={{ p: 3 }}>
          <Typography>{page > 1 ? 'Trang này không có sản phẩm.'
            : hasFilters ? 'Chưa có sản phẩm phù hợp bộ lọc hiện tại.' : 'Chưa có sản phẩm nào. Hãy quay lại sau.'}</Typography>
          {page > 1 && <Button onClick={() => changeSearch(q, 1)} sx={{ mt: 1 }}>Về trang đầu</Button>}
        </Paper> : <Box component="ul" aria-label="Danh sách sản phẩm" sx={{
          m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 2.5,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
        }}>
          {products.data.items.map((item) => <ProductCard key={item.id} item={item} />)}
        </Box>}
        {products.data.total > CATALOG_PAGE_SIZE && <Pagination
          count={Math.min(100000, Math.ceil(products.data.total / CATALOG_PAGE_SIZE))} page={page} size="small"
          disabled={products.isPlaceholderData}
          siblingCount={0} aria-label="Phân trang bộ sưu tập" onChange={(_event, value) => changeSearch(q, value)}
          getItemAriaLabel={(type, value, selected) => type === 'page' ? `${selected ? 'Đang ở trang' : 'Trang'} ${value}`
            : type === 'next' ? 'Trang sau' : type === 'previous' ? 'Trang trước' : type === 'first' ? 'Trang đầu' : 'Trang cuối'} />}
      </>}
    </Stack>}
  </Box>;
}

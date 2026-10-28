import { Alert, Box, Button, Chip, Pagination, Paper, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useSearchParams } from 'react-router';
import { ApiError } from '../../../../shared/api/client';
import { productsApi, productsKey } from '../api/products.api';

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const statusLabels = { DRAFT: 'Nháp', PUBLISHED: 'Đã xuất bản', HIDDEN: 'Đã ẩn' } as const;

export function ProductsPage() {
  const [search, setSearch] = useSearchParams();
  const rawPage = search.get('page') ?? '1';
  const page = Number(rawPage);
  const validPage = /^\d+$/.test(rawPage) && Number.isInteger(page) && page >= 1 && page <= 100000;
  const products = useQuery({ queryKey: [...productsKey, page], queryFn: () => productsApi.list(page), enabled: validPage, retry: false });
  const state: unknown = useLocation().state;
  const createdName = state && typeof state === 'object' && 'createdName' in state && typeof state.createdName === 'string' ? state.createdName : '';
  const updatedName = state && typeof state === 'object' && 'updatedName' in state && typeof state.updatedName === 'string' ? state.updatedName : '';

  function changePage(value: number) {
    setSearch((previous) => {
      const next = new URLSearchParams(previous);
      next.set('page', String(value));
      return next;
    });
  }

  return <Box sx={{ maxWidth: 1080, mx: 'auto', py: { xs: 4, md: 6 } }}>
    <title>Sản phẩm | Quản trị Clothing Shop</title>
    <Button component={Link} to="/admin" sx={{ mb: 2 }}>Về quản trị</Button>
    <Typography component="h1" variant="h3" sx={{ mb: 2 }}>Sản phẩm</Typography>
    <Button component={Link} to="/admin/products/new" variant="contained" sx={{ mb: 3 }}>Thêm sản phẩm</Button>
    {createdName && <Alert severity="success" sx={{ mb: 3, overflowWrap: 'anywhere' }}>Đã tạo sản phẩm nháp “{createdName}”.</Alert>}
    {updatedName && <Alert severity="success" sx={{ mb: 3, overflowWrap: 'anywhere' }}>Đã cập nhật sản phẩm nháp “{updatedName}”.</Alert>}
    {!validPage ? <Stack spacing={2}>
      <Alert severity="error">Số trang không hợp lệ.</Alert>
      <Button variant="outlined" onClick={() => changePage(1)}>Về trang đầu</Button>
    </Stack>
      : products.isPending ? <Typography role="status">Đang tải sản phẩm…</Typography>
      : products.isError ? <Stack spacing={2}>
        <Alert severity="error">{products.error instanceof ApiError ? products.error.message : 'Chưa tải được sản phẩm. Vui lòng thử lại.'}</Alert>
        <Button variant="outlined" disabled={products.isFetching} onClick={() => { void products.refetch(); }}>Tải lại sản phẩm</Button>
      </Stack>
      : <Stack spacing={3}>
        {products.data.items.length === 0 ? <Paper square elevation={0} sx={{ p: 3 }}>
          <Typography>{products.data.total === 0 ? 'Chưa có sản phẩm nào. Hãy tạo sản phẩm nháp đầu tiên.' : 'Trang này không có sản phẩm.'}</Typography>
          {page !== 1 && <Button onClick={() => changePage(1)}>Về trang đầu</Button>}
        </Paper>
          : <Stack component="ul" spacing={2} sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {products.data.items.map((product) => <Paper component="li" key={product.id} square elevation={0} sx={{ p: { xs: 2.5, sm: 4 }, overflowWrap: 'anywhere' }}>
              <Typography component="h2" variant="h5" sx={{ mb: 1 }}>{product.name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{product.category.name} · {product.slug}</Typography>
              <Chip size="small" label={statusLabels[product.status]} variant="outlined" sx={{ mb: 2 }} />
              <Typography sx={{ mb: 1 }}>Từ {money.format(product.priceFrom)}</Typography>
              <Stack component="ul" spacing={1} sx={{ pl: 2.5 }}>
                {product.variants.map((variant) => <Box component="li" key={variant.id}>
                  <Typography component="span" sx={{ fontWeight: 600 }}>{variant.sku}</Typography>
                  <Typography variant="body2">{variant.size} · {variant.color} · {money.format(variant.price)} · Khả dụng: {variant.available}</Typography>
                </Box>)}
              </Stack>
              {product.status === 'DRAFT' && <Button component={Link} to={`/admin/products/${product.id}`} aria-label={`Sửa ${product.name}`}
                variant="outlined" size="small" sx={{ mt: 2 }}>Sửa</Button>}
            </Paper>)}
          </Stack>}
        {products.data.total > 24 && <Pagination count={Math.ceil(products.data.total / 24)} page={page}
          onChange={(_event, value) => changePage(value)} size="small" siblingCount={0} aria-label="Phân trang sản phẩm"
          getItemAriaLabel={(type, value, selected) => type === 'page' ? `${selected ? 'Đang ở trang' : 'Trang'} ${value}`
            : type === 'next' ? 'Trang sau' : type === 'previous' ? 'Trang trước' : type === 'first' ? 'Trang đầu' : 'Trang cuối'} />}
      </Stack>}
  </Box>;
}

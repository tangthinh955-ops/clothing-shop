import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { ApiError } from '../../../../shared/api/client';
import { categoriesApi } from '../../categories/api/categories.api';
import { productsApi, productsKey, type ProductInput } from '../api/products.api';
import { ProductCreateForm } from '../components/ProductCreateForm';

export function ProductCreatePage() {
  const categories = useQuery({ queryKey: ['admin-categories'], queryFn: categoriesApi.list, retry: false });
  const create = useMutation({ mutationFn: productsApi.create, retry: false });
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function addProduct(input: ProductInput) {
    const saved = await create.mutateAsync(input);
    await queryClient.invalidateQueries({ queryKey: productsKey });
    void navigate('/admin/products', { replace: true, state: { createdName: saved.name } });
  }

  return <Box sx={{ maxWidth: 760, mx: 'auto', py: { xs: 4, md: 6 } }}>
    <title>Thêm sản phẩm | Quản trị Clothing Shop</title>
    <Button component={Link} to="/admin/products" sx={{ mb: 2 }}>Về danh sách sản phẩm</Button>
    <Typography component="h1" variant="h3" sx={{ mb: 3 }}>Thêm sản phẩm nháp</Typography>
    {categories.isPending && <Typography role="status">Đang tải danh mục…</Typography>}
    {categories.isError && <Stack spacing={2} sx={{ mb: 3 }}>
        <Alert severity="error">{categories.error instanceof ApiError ? categories.error.message : 'Chưa tải được danh mục. Vui lòng thử lại.'}</Alert>
        <Button variant="outlined" disabled={categories.isFetching} onClick={() => { void categories.refetch(); }}>Tải lại danh mục</Button>
    </Stack>}
    {categories.data && (categories.data.length === 0 ? <Stack spacing={2}>
        <Alert severity="info">Cần có danh mục trước khi tạo sản phẩm.</Alert>
        <Button component={Link} to="/admin/categories" variant="outlined">Quản lý danh mục</Button>
      </Stack>
      : <Paper square elevation={0} sx={{ p: { xs: 2.5, sm: 4 } }}><ProductCreateForm categories={categories.data} onSubmit={addProduct} /></Paper>)}
  </Box>;
}

import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../../../shared/api/client';
import { categoriesApi, type Category, type CategoryInput, type CategoryUpdateInput } from '../api/categories.api';
import { CategoryForm } from '../components/CategoryForm';
import { CategoryEditDialog } from '../components/CategoryEditDialog';
import { SHOP_NAME, pageTitle } from '../../../../shared/shop';

const categoriesKey = ['admin-categories'] as const;

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: categoriesKey, queryFn: categoriesApi.list, retry: false });
  const create = useMutation({ mutationFn: categoriesApi.create, retry: false });
  const update = useMutation({ mutationFn: ({ id, input }: { id: string; input: CategoryUpdateInput }) => categoriesApi.update(id, input), retry: false });
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Category | null>(null);

  async function addCategory(input: CategoryInput) {
    setNotice('');
    const saved = await create.mutateAsync(input);
    setNotice(`Đã lưu danh mục “${saved.name}”.`);
    await queryClient.invalidateQueries({ queryKey: categoriesKey });
  }

  async function updateCategory(id: string, input: CategoryUpdateInput) {
    setNotice('');
    const saved = await update.mutateAsync({ id, input });
    queryClient.setQueryData<Category[]>(categoriesKey, (rows) => rows?.map((row) => row.id === saved.id ? saved : row));
    setNotice(`Đã cập nhật danh mục “${saved.name}”.`);
    setEditing(null);
    await queryClient.invalidateQueries({ queryKey: categoriesKey });
  }

  async function reloadCategory(id: string) {
    const result = await categories.refetch();
    if (result.error) throw result.error;
    const latest = result.data?.find((row) => row.id === id);
    if (!latest) throw new ApiError('NOT_FOUND', 'Danh mục không còn trong danh sách. Hãy đóng cửa sổ và kiểm tra lại.', 404);
    return latest;
  }

  return <Box sx={{ maxWidth: 1080, mx: 'auto', py: { xs: 4, md: 6 } }}>
    <title>{pageTitle('Danh mục | Quản trị')}</title>
    <Button component={Link} to="/admin" variant="text" sx={{ mb: 2 }}>Về quản trị</Button>
    <Typography variant="overline">{SHOP_NAME.toUpperCase()} / QUẢN TRỊ</Typography>
    <Typography component="h1" variant="h3" sx={{ mt: 1, mb: 2 }}>Danh mục sản phẩm</Typography>
    <Typography color="text.secondary" sx={{ mb: 3 }}>Nhóm sản phẩm theo loại để khách dễ tìm và lọc.</Typography>
    {notice && <Alert severity="success" sx={{ mb: 3, overflowWrap: 'anywhere' }}>{notice}</Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 3, alignItems: 'start' }}>
      <Paper component="section" aria-labelledby="create-category-title" square elevation={0} sx={{ p: { xs: 2.5, sm: 4 } }}>
        <Typography id="create-category-title" component="h2" variant="h5" sx={{ mb: 3 }}>Thêm danh mục mới</Typography>
        <CategoryForm onSubmit={addCategory} />
      </Paper>
      <Paper component="section" aria-labelledby="category-list-title" square elevation={0} sx={{ p: { xs: 2.5, sm: 4 }, minWidth: 0 }}>
        <Typography id="category-list-title" component="h2" variant="h5" sx={{ mb: 3 }}>Danh sách danh mục</Typography>
        {categories.isPending && <Typography role="status">Đang tải danh mục…</Typography>}
        {categories.isError && <Stack spacing={2} sx={{ mb: 2 }}>
          <Alert severity="error">{categories.error instanceof ApiError ? categories.error.message : 'Chưa tải được danh mục. Vui lòng thử lại.'}</Alert>
          <Button variant="outlined" disabled={categories.isFetching} onClick={() => { void categories.refetch(); }}>
            Tải lại danh mục
          </Button>
        </Stack>}
        {categories.data?.length === 0 && <Typography color="text.secondary">Chưa có danh mục nào. Hãy thêm danh mục đầu tiên.</Typography>}
        {categories.data && categories.data.length > 0 && <Stack component="ul" spacing={2} sx={{ p: 0, m: 0, listStyle: 'none' }}>
          {categories.data.map((category) => <Box component="li" key={category.id} sx={{ borderBottom: 1, borderColor: 'divider', pb: 2, overflowWrap: 'anywhere' }}>
            <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 600 }}>{category.name}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>{category.slug}</Typography>
            <Chip size="small" label={category.active ? 'Đang bật' : 'Đang tắt'} color={category.active ? 'success' : 'default'} variant="outlined" />
            <Button variant="text" aria-label={`Sửa ${category.name}`} sx={{ ml: 1 }} onClick={() => { setNotice(''); setEditing(category); }}>Sửa</Button>
          </Box>)}
        </Stack>}
      </Paper>
    </Box>
    {editing && <CategoryEditDialog category={editing} onSave={(input) => updateCategory(editing.id, input)}
      onReload={() => reloadCategory(editing.id)} onClose={() => setEditing(null)} />}
  </Box>;
}

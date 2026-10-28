import { Alert, Box, Button, Pagination, Paper, Stack, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { ApiError } from '../../../../shared/api/client';
import { inventoryApi, inventoryKey } from '../api/inventory.api';

export function InventoryPage() {
  const [search, setSearch] = useSearchParams();
  const q = (search.get('q') ?? '').trim();
  const rawPage = search.get('page') ?? '1';
  const page = Number(rawPage);
  const validPage = /^\d+$/.test(rawPage) && Number.isInteger(page) && page >= 1 && page <= 100000;
  const validSearch = q.length <= 80;
  const inventory = useQuery({
    queryKey: [...inventoryKey, q, page], queryFn: () => inventoryApi.list(q, page),
    enabled: validPage && validSearch, retry: false,
  });

  function changeSearch(term: string, nextPage: number) {
    setSearch((previous) => {
      const next = new URLSearchParams(previous);
      if (term) next.set('q', term);
      else next.delete('q');
      next.set('page', String(nextPage));
      return next;
    });
  }

  return <Box sx={{ maxWidth: 1080, mx: 'auto', py: { xs: 4, md: 6 }, minWidth: 0 }}>
    <title>Kho | Quản trị Clothing Shop</title>
    <Button component={Link} to="/admin" sx={{ mb: 2 }}>Về quản trị</Button>
    <Typography component="h1" variant="h3" sx={{ mb: 2 }}>Kho</Typography>
    <Typography color="text.secondary" sx={{ mb: 3 }}>Xem tồn theo từng SKU. Còn bán = tồn thực có − đang giữ.</Typography>
    <Box component="form" key={q} role="search" aria-label="Tìm kiếm tồn kho" sx={{ mb: 3 }} onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const term = data.get('q');
      if (typeof term === 'string') changeSearch(term.trim(), 1);
    }}>
      <Stack spacing={2}>
        <TextField name="q" label="Tìm theo SKU hoặc tên sản phẩm" defaultValue={q} fullWidth
          slotProps={{ htmlInput: { maxLength: 80 } }} helperText="Tối đa 80 ký tự. Nhấn Enter hoặc Tìm kiếm để áp dụng." />
        <Stack direction="row" useFlexGap sx={{ gap: 1.5, flexWrap: 'wrap' }}>
          <Button type="submit" variant="contained">Tìm kiếm</Button>
          {q && <Button type="button" variant="outlined" onClick={() => changeSearch('', 1)}>Xóa tìm kiếm</Button>}
        </Stack>
      </Stack>
    </Box>
    {!validPage || !validSearch ? <Stack spacing={2}>
      <Alert severity="error">{!validPage ? 'Số trang không hợp lệ.' : 'Từ khóa tối đa 80 ký tự.'}</Alert>
      {!validPage && <Button variant="outlined" onClick={() => changeSearch(q, 1)}>Về trang đầu</Button>}
    </Stack> : <Stack spacing={3}>
      {inventory.isPending && <Typography role="status">Đang tải tồn kho…</Typography>}
      {inventory.isError && <Stack spacing={2}>
        <Alert severity="error">
          {inventory.error instanceof ApiError ? inventory.error.message : 'Chưa tải được tồn kho. Vui lòng thử lại.'}
          {inventory.data && ' Số liệu bên dưới là lần tải trước, có thể đã thay đổi.'}
        </Alert>
        <Button variant="outlined" disabled={inventory.isFetching}
          onClick={() => { void inventory.refetch({ cancelRefetch: false }); }}>Tải lại tồn kho</Button>
      </Stack>}
      {inventory.isFetching && !inventory.isPending && <Typography role="status">Đang cập nhật tồn kho…</Typography>}
      {inventory.data && <>
        <Typography role="status">Tìm thấy {inventory.data.total} SKU.</Typography>
        {inventory.data.items.length === 0 ? <Paper square elevation={0} sx={{ p: 3 }}>
          <Typography>{page > 1 ? 'Trang này không có SKU.'
            : q ? 'Không có SKU khớp từ khóa tìm kiếm.' : 'Chưa có SKU nào. Hãy tạo sản phẩm và biến thể trước.'}</Typography>
          {page > 1 && <Button onClick={() => changeSearch(q, 1)}>Về trang đầu</Button>}
        </Paper> : <Stack component="ul" aria-label="Danh sách tồn kho" spacing={2} sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {inventory.data.items.map((item) => <Paper component="li" key={item.variantId} aria-label={item.sku} square elevation={0}
            sx={{ p: { xs: 2.5, sm: 4 }, minWidth: 0, overflowWrap: 'anywhere' }}>
            <Typography component="h2" variant="h5" sx={{ mb: 1 }}>{item.productName}</Typography>
            <Typography sx={{ fontWeight: 600 }}>{item.sku}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{item.size} · {item.color}</Typography>
            <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 2, mb: 0 }}>
              {[['Tồn thực có', item.onHand], ['Đang giữ', item.reserved], ['Còn bán', item.available]].map(([label, value]) => <Box key={label}>
                <Typography component="dt" variant="body2" color="text.secondary">{label}</Typography>
                <Typography component="dd" variant="h6" sx={{ m: 0 }}>{value}</Typography>
              </Box>)}
            </Box>
          </Paper>)}
        </Stack>}
        {inventory.data.total > 24 && <Pagination count={Math.min(100000, Math.ceil(inventory.data.total / 24))} page={page}
          onChange={(_event, value) => changeSearch(q, value)} size="small" siblingCount={0} aria-label="Phân trang tồn kho"
          getItemAriaLabel={(type, value, selected) => type === 'page' ? `${selected ? 'Đang ở trang' : 'Trang'} ${value}`
            : type === 'next' ? 'Trang sau' : type === 'previous' ? 'Trang trước' : type === 'first' ? 'Trang đầu' : 'Trang cuối'} />}
      </>}
    </Stack>}
  </Box>;
}

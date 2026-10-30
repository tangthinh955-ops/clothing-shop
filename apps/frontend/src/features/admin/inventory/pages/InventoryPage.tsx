import { Alert, Box, Button, Pagination, Paper, Stack, TextField, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ApiError } from '../../../../shared/api/client';
import { inventoryApi, inventoryKey, type AdjustmentInput, type AdjustmentResult, type InventoryItem, type InventoryList } from '../api/inventory.api';
import { AdjustmentDialog } from '../components/AdjustmentDialog';
import { MovementHistory } from '../components/MovementHistory';
import { pageTitle } from '../../../../shared/shop';

const VARIANT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Apply a saved adjustment to every cached inventory page so the row stays correct without a refetch.
function applyStockUpdate(cache: { setQueriesData: ReturnType<typeof useQueryClient>['setQueriesData'] }, updated: AdjustmentResult) {
  cache.setQueriesData<InventoryList>({ queryKey: inventoryKey }, (list) => list ? {
    ...list,
    items: list.items.map((item) => item.variantId === updated.variantId ? {
      ...item, onHand: updated.onHand, reserved: updated.reserved, available: updated.available, version: updated.version,
    } : item),
  } : list);
}

export function InventoryPage() {
  const cache = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [history, setHistory] = useState<InventoryItem | null>(null);
  const variantId = search.get('variantId') ?? '';
  const q = (search.get('q') ?? '').trim();
  const rawPage = search.get('page') ?? '1';
  const page = Number(rawPage);
  const validPage = /^\d+$/.test(rawPage) && Number.isInteger(page) && page >= 1 && page <= 100000;
  const validSearch = q.length <= 80;
  const validVariant = variantId === '' || VARIANT_ID_PATTERN.test(variantId);
  const inventory = useQuery({
    queryKey: [...inventoryKey, variantId, q, page],
    queryFn: () => inventoryApi.list(q, page, validVariant ? variantId : undefined),
    enabled: validPage && validSearch && validVariant, retry: false,
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

  function saveAdjustment(input: Parameters<typeof inventoryApi.adjust>[0], key: string) {
    return inventoryApi.adjust(input, key).then((updated) => {
      applyStockUpdate(cache, updated);
      return updated;
    });
  }

  function reloadInventory() {
    void cache.invalidateQueries({ queryKey: inventoryKey });
    setAdjusting(null);
  }

  return <Box sx={{ maxWidth: 1080, mx: 'auto', py: { xs: 4, md: 6 }, minWidth: 0 }}>
    <title>{pageTitle('Kho | Quản trị')}</title>
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
    {!validPage || !validSearch || !validVariant ? <Stack spacing={2}>
      <Alert severity="error">{!validPage ? 'Số trang không hợp lệ.' : !validSearch ? 'Từ khóa tối đa 80 ký tự.'
        : 'Lọc biến thể không hợp lệ.'}</Alert>
      {!validPage && <Button variant="outlined" onClick={() => changeSearch(q, 1)}>Về trang đầu</Button>}
      {!validVariant && <Button variant="outlined" onClick={() => setSearch((previous) => {
        const next = new URLSearchParams(previous);
        next.delete('variantId');
        return next;
      })}>Xóa lọc sản phẩm</Button>}
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
            <Stack direction="row" useFlexGap sx={{ gap: 1.5, mt: 2, flexWrap: 'wrap' }}>
              <Button variant="outlined" aria-label={`Điều chỉnh ${item.sku}`} onClick={() => setAdjusting(item)}>Điều chỉnh</Button>
              <Button variant="outlined" aria-label={`Lịch sử ${item.sku}`} onClick={() => setHistory(item)}>Lịch sử</Button>
            </Stack>
          </Paper>)}
        </Stack>}
        {inventory.data.total > 24 && <Pagination count={Math.min(100000, Math.ceil(inventory.data.total / 24))} page={page}
          onChange={(_event, value) => changeSearch(q, value)} size="small" siblingCount={0} aria-label="Phân trang tồn kho"
          getItemAriaLabel={(type, value, selected) => type === 'page' ? `${selected ? 'Đang ở trang' : 'Trang'} ${value}`
            : type === 'next' ? 'Trang sau' : type === 'previous' ? 'Trang trước' : type === 'first' ? 'Trang đầu' : 'Trang cuối'} />}
      </>}
    </Stack>}
    {adjusting && <AdjustmentDialog stock={adjusting} onSave={saveAdjustment} onReload={reloadInventory}
      onClose={() => setAdjusting(null)} />}
    {history && <MovementHistory item={history} onClose={() => setHistory(null)} />}
  </Box>;
}

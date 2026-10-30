import { Alert, Box, Button, Dialog, DialogContent, DialogContentText, DialogTitle, Pagination, Paper, Stack, Typography } from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '../../../../shared/api/client';
import { MOVEMENT_PAGE_SIZE, inventoryApi, type InventoryItem, type MovementRow } from '../api/inventory.api';

// Fixed VN timezone so the same transaction shows the same wall clock on every admin machine.
const timeFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });

// The ISO string stays in the <time> element; only the visible text is a local clock time.
function formatTime(value: string) {
  const stamp = new Date(value);
  return Number.isNaN(stamp.getTime()) ? value : timeFormat.format(stamp);
}

// Positive deltas stock up, negative ones ship out; the sign is the cheapest honest marker.
function deltaText(delta: number) {
  return delta >= 0 ? `+${delta}` : String(delta);
}

// Reserve/release leave onHand untouched, so a ±0 marker and an equal before → after would hide what
// actually changed; those rows are labeled by source and show reserved/available after the operation.
const effectLabels = { ADMIN_ADJUSTMENT: 'Điều chỉnh kho', ORDER_RESERVE: 'Giữ hàng cho đơn',
  ORDER_RELEASE: 'Nhả giữ đơn', ORDER_SHIP: 'Xuất hàng giao' } as const;
const orderEffects = new Set<MovementRow['source']>(['ORDER_RESERVE', 'ORDER_RELEASE']);

export function MovementHistory({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: ['admin-inventory-movements', item.variantId, page],
    queryFn: () => inventoryApi.movements(item.variantId, page),
    retry: false,
    // Drop closed history at once so a reopen after an adjustment never flashes the old rows.
    gcTime: 0,
    // Keep the current page visible while the next one loads instead of collapsing the dialog.
    placeholderData: keepPreviousData,
  });
  const list = history.data;

  return <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="movement-history-title">
    <DialogTitle id="movement-history-title">Lịch sử {item.sku}</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ pt: 1, pb: 1 }}>
        <DialogContentText>{item.productName} · {item.size} · {item.color}. Sắp theo thời gian mới nhất.</DialogContentText>
        {history.isPending && <Typography role="status">Đang tải lịch sử…</Typography>}
        {history.isError && <Stack spacing={1.5}>
          <Alert severity="error">
            {history.error instanceof ApiError ? history.error.message : 'Chưa tải được lịch sử. Vui lòng thử lại.'}
          </Alert>
          <Box>
            <Button variant="outlined" disabled={history.isFetching} onClick={() => { void history.refetch({ cancelRefetch: false }); }}>
              Tải lại lịch sử
            </Button>
          </Box>
        </Stack>}
        {list && <>
          <Typography role="status">Tìm thấy {list.total} giao dịch.</Typography>
          {list.items.length === 0 ? <Paper square elevation={0} sx={{ p: 3 }}>
            <Typography>Chưa có giao dịch cho SKU này.</Typography>
          </Paper> : <>
            <Stack component="ul" aria-label={`Lịch sử ${item.sku}`} spacing={1.5} sx={{ m: 0, p: 0, listStyle: 'none' }}>
              {list.items.map((row) => <Paper component="li" key={row.id} sx={{ p: 2, minWidth: 0, overflowWrap: 'anywhere' }}>
                <Stack direction="row" useFlexGap sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <Typography component="time" dateTime={row.createdAt} sx={{ color: 'text.secondary' }}>
                    {formatTime(row.createdAt)}
                  </Typography>
                  {orderEffects.has(row.source)
                    ? <Typography variant="h6">{effectLabels[row.source]}</Typography>
                    : <Typography variant="h6" color={row.delta >= 0 ? 'success.main' : 'error.main'}>{deltaText(row.delta)}</Typography>}
                </Stack>
                {orderEffects.has(row.source)
                  ? <Typography sx={{ fontWeight: 600 }}>Đang giữ: {row.reserved} · Còn bán: {row.after - row.reserved}</Typography>
                  : <Typography sx={{ fontWeight: 600 }}>{row.before} → {row.after}</Typography>}
                <Typography variant="body2" color="text.secondary">Lý do: {row.reason}</Typography>
                <Typography variant="body2">Người thực hiện: {row.actor.name}</Typography>
              </Paper>)}
            </Stack>
            {list.total > MOVEMENT_PAGE_SIZE && <Pagination
              count={Math.min(100000, Math.ceil(list.total / MOVEMENT_PAGE_SIZE))} page={page} disabled={history.isFetching}
              onChange={(_event, value) => setPage(value)} size="small" siblingCount={0} aria-label="Phân trang lịch sử"
              getItemAriaLabel={(type, value, selected) => type === 'page' ? `${selected ? 'Đang ở trang' : 'Trang'} ${value}`
                : type === 'next' ? 'Trang sau' : type === 'previous' ? 'Trang trước' : type === 'first' ? 'Trang đầu' : 'Trang cuối'} />}
          </>}
        </>}
        <Box>
          <Button variant="contained" onClick={onClose}>Đóng</Button>
        </Box>
      </Stack>
    </DialogContent>
  </Dialog>;
}

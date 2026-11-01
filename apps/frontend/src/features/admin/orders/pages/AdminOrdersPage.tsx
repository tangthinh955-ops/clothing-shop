import { Alert, Box, Button, Chip, Pagination, Paper, Stack, TextField, Typography } from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { ApiError } from '../../../../shared/api/client';
import { pageTitle } from '../../../../shared/shop';
import { formatMoney } from '../../../catalog/catalogFormat';
import type { OrderStatus } from '../../../orders/api/orders.api';
import { ORDER_STATUS_LABELS } from '../../../orders/orderStatusLabels';
import { ADMIN_ORDERS_PAGE_SIZE, adminOrdersApi, adminOrdersKey, type AdminOrderRow } from '../api/admin-orders.api';

const MAX_TERM_LENGTH = 80;
const STATUSES = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];
const SOURCE_LABELS: Record<AdminOrderRow['source'], string> = { WEB: 'Website', INSTAGRAM: 'Instagram' };
const METHOD_LABELS: Record<AdminOrderRow['method'], string> = { COD: 'COD', BANK_TRANSFER: 'Chuyển khoản' };
const ORDER_TIME = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });

function OrderRow({ order }: { order: AdminOrderRow }) {
  return <Paper component="li" aria-label={order.code} square elevation={0} sx={{ p: { xs: 2, sm: 3 }, overflowWrap: 'anywhere' }}>
    <Stack direction="row" useFlexGap sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
      <Typography component="h2" sx={{ fontWeight: 700 }}>{order.code}</Typography>
      <Chip size="small" variant="outlined" label={ORDER_STATUS_LABELS[order.status]} />
    </Stack>
    <Typography>{order.recipientName} · {order.phone}</Typography>
    <Typography sx={{ fontWeight: 700 }}>{formatMoney(order.totalVnd)}</Typography>
    <Typography variant="body2" color="text.secondary">
      {METHOD_LABELS[order.method]} · {SOURCE_LABELS[order.source]} · {order.itemCount} sản phẩm · {ORDER_TIME.format(new Date(order.createdAt))}
    </Typography>
  </Paper>;
}

export function AdminOrdersPage() {
  const [search, setSearch] = useSearchParams();
  const status = search.get('status') ?? '';
  const q = (search.get('q') ?? '').trim();
  const rawPage = search.get('page') ?? '1';
  const page = Number(rawPage);
  const usable = /^\d+$/.test(rawPage) && page >= 1 && page <= 100000 && q.length <= MAX_TERM_LENGTH
    && (status === '' || (STATUSES as string[]).includes(status));
  const hasFilters = status !== '' || q !== '';

  const orders = useQuery({
    queryKey: [...adminOrdersKey, status, q, page],
    queryFn: () => adminOrdersApi.list({ status, q, page }),
    enabled: usable, retry: false,
    // Keep the current rows while another page or filter loads instead of collapsing the list.
    placeholderData: keepPreviousData,
  });

  // Any new filter starts again from the first page; changing page keeps the filters.
  function changeFilter(name: 'status' | 'q', value: string) {
    setSearch((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(name, value); else next.delete(name);
      next.set('page', '1');
      return next;
    });
  }

  function changePage(value: number) {
    setSearch((previous) => {
      const next = new URLSearchParams(previous);
      next.set('page', String(value));
      return next;
    });
  }

  function clearFilters() {
    setSearch(new URLSearchParams());
  }

  return <Box sx={{ maxWidth: 1080, mx: 'auto', py: { xs: 4, md: 6 } }}>
    <title>{pageTitle('Đơn hàng | Quản trị')}</title>
    <Button component={Link} to="/admin" sx={{ mb: 2 }}>Về quản trị</Button>
    <Typography component="h1" variant="h3" sx={{ mb: 3 }}>Đơn hàng</Typography>
    {!usable ? <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
      <Alert severity="error" sx={{ width: '100%' }}>Bộ lọc không hợp lệ.</Alert>
      <Button variant="outlined" onClick={clearFilters}>Xóa lọc</Button>
    </Stack> : <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} useFlexGap sx={{ gap: 2, alignItems: { sm: 'flex-start' } }}>
        <Box component="form" key={q} role="search" aria-label="Tìm đơn hàng" sx={{ flex: 1, minWidth: 0 }} onSubmit={(event) => {
          event.preventDefault();
          changeFilter('q', String(new FormData(event.currentTarget).get('q') ?? '').trim());
        }}>
          <TextField name="q" size="small" label="Tìm theo mã đơn, SĐT hoặc tên" defaultValue={q}
            slotProps={{ htmlInput: { maxLength: MAX_TERM_LENGTH, enterKeyHint: 'search' } }} />
        </Box>
        <TextField select size="small" label="Trạng thái" value={status} onChange={(event) => changeFilter('status', event.target.value)}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }} sx={{ width: { xs: '100%', sm: 240 } }}>
          <option value="">Tất cả trạng thái</option>
          {STATUSES.map((value) => <option key={value} value={value}>{ORDER_STATUS_LABELS[value]}</option>)}
        </TextField>
        {hasFilters && <Button variant="outlined" onClick={clearFilters} sx={{ minHeight: 40 }}>Xóa lọc</Button>}
      </Stack>
      {orders.isPending && <Typography role="status">Đang tải đơn hàng…</Typography>}
      {orders.isError && <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Alert severity="error" sx={{ width: '100%' }}>
          {orders.error instanceof ApiError ? orders.error.message : 'Chưa tải được đơn hàng. Vui lòng thử lại.'}
        </Alert>
        <Button variant="outlined" disabled={orders.isFetching} onClick={() => { void orders.refetch(); }}>Tải lại đơn hàng</Button>
      </Stack>}
      {orders.data && <>
        <Typography role="status" sx={{ fontWeight: 500 }}>{orders.data.total} đơn hàng</Typography>
        {orders.data.items.length === 0 ? <Stack spacing={1} sx={{ py: 4, alignItems: 'flex-start' }}>
          <Typography>{hasFilters ? 'Không có đơn phù hợp bộ lọc.' : page > 1 ? 'Trang này không có đơn.' : 'Chưa có đơn hàng nào.'}</Typography>
          {page > 1 && <Button onClick={() => changePage(1)}>Về trang đầu</Button>}
        </Stack> : <Stack component="ul" aria-label="Danh sách đơn hàng" spacing={2} sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {orders.data.items.map((order) => <OrderRow key={order.id} order={order} />)}
        </Stack>}
        {orders.data.total > ADMIN_ORDERS_PAGE_SIZE && <Pagination count={Math.ceil(orders.data.total / ADMIN_ORDERS_PAGE_SIZE)} page={page}
          disabled={orders.isPlaceholderData} onChange={(_event, value) => changePage(value)} size="small" siblingCount={0}
          aria-label="Phân trang đơn hàng" sx={{ alignSelf: 'center' }}
          getItemAriaLabel={(type, value, selected) => type === 'page' ? `${selected ? 'Đang ở trang' : 'Trang'} ${value}`
            : type === 'next' ? 'Trang sau' : type === 'previous' ? 'Trang trước' : type === 'first' ? 'Trang đầu' : 'Trang cuối'} />}
      </>}
    </Stack>}
  </Box>;
}

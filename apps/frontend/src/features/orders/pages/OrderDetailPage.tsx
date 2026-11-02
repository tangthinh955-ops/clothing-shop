import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { formatMoney } from '../../catalog/catalogFormat';
import { ApiError } from '../../../shared/api/client';
import { ordersApi } from '../api/orders.api';
import { ORDER_STATUS_LABELS } from '../orderStatusLabels';
import { sha256Hex } from '../token-tag';

const ENTRY_TIME = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/; // mirrors the server-side token envelope (order-access.guard.ts)

const UNIFORM_ACCESS_ERROR = 'Không tìm thấy đơn hàng. Kiểm tra lại mã đơn hoặc đường dẫn đã nhận từ shop.';
const NETWORK_ERROR = 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.';

function isRetryable(error: unknown): boolean {
  // A held 404 or a 429 never auto-retries and offers no pointless manual loop either.
  return !(error instanceof ApiError && (error.status === 404 || error.status === 429));
}

function safeMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return NETWORK_ERROR;
}

function AccessError({ message }: { message: string }) {
  return <Alert severity="error" role="alert">
    {message}
    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
      Nếu bạn vừa nhập lại đường dẫn, hãy mở lại link đã nhận từ shop.
    </Typography>
  </Alert>;
}

/**
 * Guest order detail (M4.4.1): reads the private link fragment `#t=`, sends it only as the
 * X-Order-Token header, and shows exactly the allowlisted server view. The fragment stays in the
 * address so a refresh keeps working, and the token never reaches storage or any URL query.
 */
export function OrderDetailPage() {
  const params = useParams();
  const code = typeof params['code'] === 'string' && params['code'].length > 0 ? params['code'] : '';
  const fragment = useLocation().hash;
  const tokenCandidate = new URLSearchParams(fragment.slice(1)).get('t');
  const token = tokenCandidate && TOKEN_PATTERN.test(tokenCandidate) ? tokenCandidate : null;
  const tokenHash = token ? sha256Hex(token) : 'none';

  // Security gate (M4.4.2 review fix): a cached snapshot may only paint after a successful GET for
  // the hash CURRENTLY on the page completed within THIS mount. `verifiedHash` records exactly
  // that — set only by a queryFn that resolved while its hash was still current, cleared before
  // paint whenever the hash changes. The SHA-256 key keeps entries isolated and gcTime 0 keeps them
  // short-lived, but neither the GC timer nor the cache itself is ever the permission check: an
  // immediate remount (before any GC timer fires) still waits for the fresh verification.
  const [verifiedHash, setVerifiedHash] = useState<string | null>(null);
  const currentHashRef = useRef(tokenHash);
  useLayoutEffect(() => {
    currentHashRef.current = tokenHash;
    setVerifiedHash(null);
  }, [tokenHash]);

  const query = useQuery({
    // SHA-256 of the token binds every cache entry to exactly one private access: the key space is
    // 2^256 instead of the removed FNV tag's 2^32, the token itself never enters the key or storage,
    // and the synchronous tag means a token change always rekeys in the same render — no stale
    // async tag can serve the old view while a different token is on the page.
    queryKey: ['orders', 'view', code, tokenHash],
    queryFn: async () => {
      const result = await ordersApi.view(code, token!);
      if (currentHashRef.current === tokenHash) setVerifiedHash(tokenHash);
      return result;
    },
    enabled: Boolean(code && token),
    retry: false,
    refetchOnWindowFocus: false,
    // Ordering data must not hide behind cached money; every mount re-verifies anyway.
    staleTime: 0,
    gcTime: 0,
  });
  const verified = query.isSuccess && verifiedHash === tokenHash;

  return <Box sx={{ py: { xs: 2, md: 4 }, maxWidth: 820, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
    <title>Đơn hàng | Clothing Shop</title>
    {!token && <AccessError message={UNIFORM_ACCESS_ERROR} />}
    {token && query.isError && <AccessError message={safeMessage(query.error)} />}
    {/* Every branch below requires a live token; without one nothing is ever sent. */}
    {token && verified && query.data && <>
      <Typography variant="overline">Xem đơn hàng riêng tư</Typography>
      <Typography component="h1" variant="h4" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
        {query.data.order.code}
      </Typography>
      <Typography>
        Trạng thái: <strong>{ORDER_STATUS_LABELS[query.data.order.status]}</strong> · {query.data.order.method === 'COD'
          ? 'Thanh toán khi nhận hàng (COD)' : query.data.order.method}
        {query.data.order.status === 'PENDING' && <> — <strong>chưa thu tiền</strong></>}
      </Typography>
      <Paper square elevation={0} sx={{ p: { xs: 2.5, sm: 4 } }}>
        <Typography component="h2" variant="h6" sx={{ mb: 2 }}>Sản phẩm đặt mua</Typography>
        <Stack spacing={2}>
          {query.data.order.items.map((item) => <Stack key={item.variantId} direction="row" useFlexGap
            sx={{ justifyContent: 'space-between', gap: 2, alignItems: 'flex-start' }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{item.productName}</Typography>
              <Typography variant="body2" color="text.secondary">{item.color} · size {item.size} · {item.sku}</Typography>
              <Typography variant="body2">{formatMoney(item.unitPriceVnd)} × {item.quantity}</Typography>
            </Box>
            <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{formatMoney(item.lineTotalVnd)}</Typography>
          </Stack>)}
        </Stack>
        <Stack spacing={1} sx={{ borderTop: 1, borderColor: 'divider', mt: 2, pt: 2 }}>
          <Stack direction="row" useFlexGap sx={{ justifyContent: 'space-between' }}>
            <Typography>Tiền hàng</Typography>
            <Typography sx={{ fontWeight: 600 }}>{formatMoney(query.data.order.subtotal)}</Typography>
          </Stack>
          <Stack direction="row" useFlexGap sx={{ justifyContent: 'space-between' }}>
            <Typography>Phí giao hàng</Typography>
            <Typography sx={{ fontWeight: 600 }}>{formatMoney(query.data.order.shippingFee)}</Typography>
          </Stack>
          <Stack direction="row" useFlexGap sx={{ justifyContent: 'space-between' }}>
            <Typography sx={{ fontWeight: 700 }}>Tổng tiền</Typography>
            <Typography sx={{ fontWeight: 700 }}>{formatMoney(query.data.order.total)}</Typography>
          </Stack>
        </Stack>
      </Paper>
      <Paper square elevation={0} sx={{ p: { xs: 2.5, sm: 4 } }}>
        <Typography component="h2" variant="h6" sx={{ mb: 2 }}>Thông tin nhận hàng</Typography>
        <Typography>Người nhận: {query.data.order.recipient.name}</Typography>
        <Typography>Số điện thoại: {query.data.order.recipient.phone}</Typography>
        {query.data.order.recipient.email && <Typography>Email: {query.data.order.recipient.email}</Typography>}
        <Typography sx={{ overflowWrap: 'anywhere' }}>
          {query.data.order.recipient.province}
          {query.data.order.recipient.district ? ` · ${query.data.order.recipient.district}` : ''}
          {' · '}{query.data.order.recipient.ward} · {query.data.order.recipient.addressLine}
        </Typography>
        {query.data.order.recipient.note
          && <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            Ghi chú: {query.data.order.recipient.note}
          </Typography>}
      </Paper>
      <Paper square elevation={0} sx={{ p: { xs: 2.5, sm: 4 } }}>
        <Typography component="h2" variant="h6" sx={{ mb: 2 }}>Lịch sử đơn</Typography>
        <Stack spacing={1.5}>
          {query.data.timeline.map((entry) => <Stack key={entry.version} spacing={0}>
            <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
              {entry.fromStatus ? `${ORDER_STATUS_LABELS[entry.fromStatus]} → ` : ''}
              {ORDER_STATUS_LABELS[entry.toStatus]}
              {entry.actorLabel ? ` · ${entry.actorLabel}` : ''}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {ENTRY_TIME.format(new Date(entry.at))}{entry.reason ? ` — ${entry.reason}` : ''}
            </Typography>
          </Stack>)}
        </Stack>
      </Paper>
      <Typography variant="body2" color="text.secondary">
        Link này cho phép xem đơn mà không cần đăng nhập. Đừng chia sẻ công khai; cứ dùng lại khi cần
        kiểm tra trạng thái.
      </Typography>
    </>}
    {token && !query.isError && !verified
      && <Typography role="status">Đang tải đơn hàng…</Typography>}
    {query.isError && isRetryable(query.error)
      && <Box><Button variant="outlined" onClick={() => { void query.refetch(); }}>Thử lại</Button></Box>}
  </Box>;
}

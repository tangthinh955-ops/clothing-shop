import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../../../shared/api/client';
import { ordersApi } from '../api/orders.api';

const NETWORK_ERROR = 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.';
const CODE_HINT = 'Mã đơn nhận được khi đặt hàng, ví dụ AB23456789CD.';
const PHONE_HINT = 'Ví dụ 0901234567 hoặc +84901234567.';

/**
 * Guest lookup (M4.4.2): mã đơn + số điện thoại đổi lấy link xem đơn mới. Dữ liệu form chỉ nằm ở
 * memory — không URL, không storage; token mới chỉ đi qua fragment của đường dẫn chuyển tới (mã đơn
 * được encode thành một segment), và mọi lỗi (400/404/429/mạng/payload) giữ nguyên form, không bao
 * giờ tự gửi lại. Khóa đồng bộ bằng ref chặn hai submit trong cùng một nhịp render; kết quả về sau
 * khi khách đã rời trang thì bị bỏ qua, không kéo người dùng trở lại.
 */
export function OrderLookupPage() {
  const navigate = useNavigate();
  const id = useId();
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  // Synchronous submit lock: `isPending` only flips on a rerender, so two submits in the same tick
  // would both slip past it. Set right before sending, released in onSettled — even on errors.
  const submittingRef = useRef(false);
  // Answers that land after the customer left this page must not navigate them back.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const lookup = useMutation({
    mutationFn: ordersApi.lookup,
    retry: false,
    onSettled: () => { submittingRef.current = false; },
    onSuccess: (result) => {
      if (!mountedRef.current) return;
      // The fresh token rides the URL fragment only: never a query string, never browser storage.
      navigate(`/orders/${encodeURIComponent(result.view.order.code)}#t=${result.lookupToken}`);
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        setFieldErrors(Object.fromEntries(error.fieldErrors.map((entry) => [entry.field, entry.message])));
        setFormError(error.fieldErrors.length === 0 ? error.message : null);
      } else {
        setFormError(NETWORK_ERROR);
      }
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (submittingRef.current || lookup.isPending) return; // one in-flight lookup at a time
    const trimmedCode = code.trim();
    const trimmedPhone = phone.trim();
    const local: Record<string, string> = {};
    if (!trimmedCode) local['code'] = 'Nhập mã đơn đã nhận khi đặt hàng.';
    if (!trimmedPhone) local['phone'] = 'Nhập số điện thoại đã dùng khi đặt hàng.';
    setFieldErrors(local);
    setFormError(null);
    if (Object.keys(local).length > 0) return;
    submittingRef.current = true;
    lookup.mutate({ code: trimmedCode, phone: trimmedPhone });
  };

  return <Box sx={{ py: { xs: 2, md: 4 }, maxWidth: 560, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
    <title>Tra cứu đơn hàng | Clothing Shop</title>
    <Typography component="h1" variant="h4" sx={{ fontWeight: 700 }}>Tra cứu đơn hàng</Typography>
    <Typography>
      Nhập mã đơn và số điện thoại đã dùng khi đặt hàng — shop sẽ cấp lại link xem đơn riêng tư.
    </Typography>
    <Paper square elevation={0} sx={{ p: { xs: 2.5, sm: 4 } }}>
      <Box component="form" aria-label="Tra cứu đơn hàng" aria-busy={lookup.isPending}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }} onSubmit={submit}>
        <TextField id={`${id}-code`} label="Mã đơn" value={code} disabled={lookup.isPending}
          onChange={(event) => setCode(event.target.value)} error={Boolean(fieldErrors['code'])}
          helperText={fieldErrors['code'] ?? CODE_HINT}
          slotProps={{ htmlInput: { maxLength: 24, autoComplete: 'off', autoCapitalize: 'characters' } }} />
        <TextField id={`${id}-phone`} label="Số điện thoại" value={phone} disabled={lookup.isPending}
          onChange={(event) => setPhone(event.target.value)} error={Boolean(fieldErrors['phone'])}
          helperText={fieldErrors['phone'] ?? PHONE_HINT}
          slotProps={{ htmlInput: { inputMode: 'tel', autoComplete: 'tel', maxLength: 20 } }} />
        {formError && <Alert severity="error">{formError}</Alert>}
        <Button type="submit" variant="contained" size="large" disabled={lookup.isPending}>
          {lookup.isPending ? 'Đang tra cứu…' : 'Tra cứu'}
        </Button>
        <Typography variant="body2" color="text.secondary">
          Tra cứu thành công sẽ cấp một link xem đơn mới và link cũ sẽ không còn dùng được.
        </Typography>
      </Box>
    </Paper>
  </Box>;
}

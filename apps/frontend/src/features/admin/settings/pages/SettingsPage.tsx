import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ApiError } from '../../../../shared/api/client';
import { settingsApi, settingsKey } from '../api/settings.api';

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <Box>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography sx={{ fontWeight: 600 }}>{children}</Typography>
  </Box>;
}

export function SettingsPage() {
  const settings = useQuery({ queryKey: settingsKey, queryFn: settingsApi.adminView, retry: false });
  const data = settings.data;
  return <Box sx={{ maxWidth: 760, mx: 'auto', py: { xs: 4, md: 6 } }}>
    <title>Cài đặt | Quản trị Clothing Shop</title>
    <Button component={Link} to="/admin" sx={{ mb: 2 }}>Về quản trị</Button>
    <Typography component="h1" variant="h3" sx={{ mb: 3 }}>Cài đặt cửa hàng</Typography>
    {settings.isPending && <Typography role="status">Đang tải cài đặt…</Typography>}
    {settings.isError && <Stack spacing={2} sx={{ mb: 3 }}>
      <Alert severity="error">{settings.error instanceof ApiError ? settings.error.message : 'Chưa tải được cài đặt. Vui lòng thử lại.'}</Alert>
      <Box><Button variant="outlined" disabled={settings.isFetching} onClick={() => { void settings.refetch(); }}>Tải lại cài đặt</Button></Box>
    </Stack>}
    {data && <Paper square elevation={0} sx={{ p: { xs: 2.5, sm: 4 } }}>
      <Typography component="h2" variant="h5" sx={{ mb: 2.5 }}>Bán hàng</Typography>
      <Stack spacing={2}>
        <Field label="Phí giao hàng">{money.format(data.shippingFeeVnd)}</Field>
        <Field label="Hạn chuyển khoản">{data.bankDeadlineMinutes} phút</Field>
        <Field label="Ngân hàng">{data.bankName ?? 'Chưa cấu hình'}</Field>
        <Field label="Mã BIN">{data.bankBin ?? 'Chưa cấu hình'}</Field>
        <Field label="Số tài khoản">{data.bankAccountNumber ?? 'Chưa cấu hình'}</Field>
        <Field label="Tên chủ tài khoản">{data.bankAccountName ?? 'Chưa cấu hình'}</Field>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5 }}>
        Trang chỉ đọc. Việc chỉnh sửa cài đặt sẽ có ở phần tiếp theo (phiên bản cấu hình: {data.version}).
      </Typography>
    </Paper>}
  </Box>;
}

import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { Link, Navigate, Route, Routes } from 'react-router';
import { StoreLayout } from '../layouts/StoreLayout';
import { AuthPage } from '../features/auth/pages/AuthPage';
import { VerifyPage } from '../features/auth/pages/VerifyPage';
import { useCurrentUser } from '../features/auth/hooks/useCurrentUser';
import { AccountPage } from '../features/account/AccountPage';
import { AdminPage } from '../features/admin/AdminPage';

function PrivatePage({ admin = false }: { admin?: boolean }) {
  const query = useCurrentUser();
  if (query.isPending) return <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress aria-label="Đang tải tài khoản" /></Box>;
  if (query.isError) return <Stack spacing={2} sx={{ py: 6 }}><Alert severity="error">Chưa tải được tài khoản.</Alert><Button onClick={() => { void query.refetch(); }}>Thử lại</Button></Stack>;
  if (!query.data) return <Navigate to="/login" replace />;
  if (admin && query.data.role !== 'ADMIN') return <Navigate to="/account" replace />;
  return admin ? <AdminPage /> : <AccountPage user={query.data} />;
}

function CatalogIntro() {
  return <Box sx={{ py: { xs: 6, md: 10 } }}><title>Bộ sưu tập | Clothing Shop</title>
    <Typography variant="overline" sx={{ letterSpacing: '.2em' }}>EVERYDAY ESSENTIALS</Typography>
    <Typography variant="h2" component="h1" sx={{ fontFamily: 'Georgia, serif', maxWidth: 700, my: 3, fontSize: { xs: 42, md: 64 } }}>Những lựa chọn<br />cho mỗi ngày.</Typography>
    <Box sx={{ mt: 6, p: { xs: 4, md: 7 }, border: '1px solid #d6d2c9', textAlign: 'center' }}>
      <Typography variant="h5" component="h2" sx={{ mb: 2 }}>Bộ sưu tập đang được cập nhật</Typography>
      <Typography color="text.secondary">Hãy quay lại để khám phá các sản phẩm mới.</Typography>
      <Button component={Link} to="/register" variant="outlined" sx={{ mt: 3 }}>Tạo tài khoản</Button>
    </Box>
  </Box>;
}

const policies: Record<string, { title: string; text: string }> = {
  'size-guide': { title: 'Hướng dẫn chọn size', text: 'Đối chiếu số đo với bảng size riêng của từng sản phẩm. Nếu chưa chắc chắn, hãy liên hệ cửa hàng trước khi chọn.' },
  contact: { title: 'Liên hệ', text: 'Thông tin liên hệ của cửa hàng sẽ được bổ sung khi nghiệm thu bản demo.' },
  shipping: { title: 'Giao hàng', text: 'Giả định demo: phí giao 30.000đ mỗi đơn, được hiển thị trước khi xác nhận. Chưa có cam kết thời gian vận chuyển cho bản demo.' },
  'returns-policy': { title: 'Đổi & trả', text: 'Giả định demo: gửi yêu cầu trong 7 ngày từ khi giao thành công. Đổi size cùng sản phẩm và màu, hàng được kiểm tra trước khi xử lý. Phí giao gốc mặc định không hoàn. Chính sách này chưa được shop duyệt để bán thật.' },
};

export function App() {
  return <Routes><Route element={<StoreLayout />}>
    <Route index element={<Navigate to="/shop" replace />} />
    <Route path="shop" element={<CatalogIntro />} />
    <Route path="login" element={<AuthPage key="login" mode="login" />} />
    <Route path="register" element={<AuthPage key="register" mode="register" />} />
    <Route path="forgot-password" element={<AuthPage key="forgot" mode="forgot" />} />
    <Route path="reset-password" element={<AuthPage key="reset" mode="reset" />} />
    <Route path="verify-email" element={<VerifyPage />} />
    <Route path="account" element={<PrivatePage />} />
    <Route path="admin" element={<PrivatePage admin />} />
    {Object.entries(policies).map(([path, copy]) => <Route key={path} path={path} element={<Box sx={{ maxWidth: 720, py: 7 }}>
      <title>{copy.title} | Clothing Shop</title><Typography variant="h3" component="h1" sx={{ mb: 3 }}>{copy.title}</Typography><Typography>{copy.text}</Typography>
    </Box>} />)}
    <Route path="*" element={<Box sx={{ py: 8 }}><Typography variant="h3" component="h1">Không tìm thấy trang</Typography><Button component={Link} to="/shop" sx={{ mt: 3 }}>Về bộ sưu tập</Button></Box>} />
  </Route></Routes>;
}

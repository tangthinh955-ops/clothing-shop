import { Box, Typography } from '@mui/material';

// One line of store-wide facts shoppers ask about first; the figures follow the shipping policy.
export function AnnouncementBar() {
  return <Box role="note" aria-label="Thông báo cửa hàng" sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', py: 1, px: 2 }}>
    <Typography variant="caption" component="p" sx={{ textAlign: 'center', letterSpacing: '.04em', fontWeight: 500 }}>
      Giao hàng toàn quốc · Phí 30.000đ · Kiểm hàng khi nhận
    </Typography>
  </Box>;
}

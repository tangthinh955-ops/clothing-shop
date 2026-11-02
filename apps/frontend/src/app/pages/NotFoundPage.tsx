import { Box, Button, Typography } from '@mui/material';
import { Link } from 'react-router';
import { pageTitle } from '../../shared/shop';

export function NotFoundPage() {
  return <Box sx={{ py: 8 }}>
    <title>{pageTitle('Không tìm thấy trang')}</title>
    <Typography variant="h3" component="h1">Không tìm thấy trang</Typography>
    <Button component={Link} to="/shop" sx={{ mt: 3 }}>Về bộ sưu tập</Button>
  </Box>;
}

import { Button, Stack, Typography } from '@mui/material';
import { seller } from '../../../shared/shop';
import type { CatalogVariant } from '../api/catalog.api';

// Until the cart arrives (M4), the real way to order is a message to the shop's Instagram.
export function OrderByMessage({ selected }: { selected: CatalogVariant | undefined }) {
  return <Stack spacing={1}>
    <Button component="a" href={seller.instagram.url} target="_blank" rel="noopener noreferrer" variant="contained" size="large"
      fullWidth sx={{ minHeight: 52 }}>
      Nhắn shop qua Instagram để đặt
    </Button>
    {selected && <Typography variant="body2" sx={{ fontWeight: 600 }}>Mã sản phẩm: {selected.sku}</Typography>}
    <Typography variant="body2" color="text.secondary">
      Gửi tên sản phẩm, màu và size (hoặc mã sản phẩm) cho shop qua Instagram để đặt hàng.
    </Typography>
  </Stack>;
}

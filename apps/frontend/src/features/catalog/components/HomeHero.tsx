import { Box, Button, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { SHOP_NAME } from '../../../shared/shop';
import type { CatalogProduct } from '../api/catalog.api';

// Product photos are shot on light backgrounds, so the text sits on its own dark panel instead of over the photo.
export function HomeHero({ product }: { product: CatalogProduct | undefined }) {
  const photo = product?.images[0];
  return <Box component="section" aria-labelledby="home-hero-title" sx={{
    display: 'grid', gridTemplateColumns: { xs: '1fr', md: photo ? '1fr 1fr' : '1fr' }, mx: { xs: -2, sm: 0 }, mt: { sm: 3 },
  }}>
    {product && photo && <Link component={RouterLink} to={`/products/${product.slug}`}
      sx={{ display: 'block', bgcolor: '#f5f5f5', aspectRatio: { xs: '4/5', md: 'auto' }, minHeight: { md: 560 }, order: { md: 2 } }}>
      <Box component="img" src={photo.url} alt={product.name} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </Link>}
    <Stack sx={{
      bgcolor: 'primary.main', color: 'primary.contrastText', justifyContent: 'flex-end', gap: 2,
      p: { xs: 3, md: 6 }, minHeight: { xs: photo ? 'auto' : 360, md: 560 },
    }}>
      <Typography variant="overline" sx={{ letterSpacing: '.2em' }}>{SHOP_NAME.toUpperCase()}</Typography>
      <Typography id="home-hero-title" variant="h3" component="h1">Bộ sưu tập mới</Typography>
      <Typography sx={{ maxWidth: 420, opacity: 0.85 }}>Những mẫu vừa lên kệ. Giao hàng toàn quốc, kiểm hàng khi nhận.</Typography>
      <Button component={RouterLink} to="/shop" variant="contained"
        sx={{ alignSelf: 'flex-start', bgcolor: 'common.white', color: 'common.black', '&:hover': { bgcolor: 'grey.200' } }}>
        Xem bộ sưu tập
      </Button>
    </Stack>
  </Box>;
}

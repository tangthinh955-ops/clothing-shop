import { Alert, Box, Button, Link, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';
import { ApiError } from '../../../shared/api/client';
import { SHOP_NAME, seller } from '../../../shared/shop';
import { catalogApi, catalogHomeKey } from '../api/catalog.api';
import { CategoryStrip } from '../components/CategoryStrip';
import { HomeHero } from '../components/HomeHero';
import { ProductCard } from '../components/ProductCard';
import { useCatalogCategories } from '../hooks/useCatalogCategories';

const NEW_ARRIVALS = 8;

export function HomePage() {
  const products = useQuery({
    queryKey: catalogHomeKey, queryFn: () => catalogApi.list({ q: '', page: 1, sort: 'newest' }), retry: false,
  });
  const categories = useCatalogCategories();
  const items = products.data?.items ?? [];
  // The banner shows the newest product that already has a photo.
  const featured = items.find((item) => item.images.length > 0);

  return <Box sx={{ pb: 2 }}>
    <title>{SHOP_NAME}</title>
    <HomeHero product={featured} />
    <CategoryStrip categories={categories} />
    <Box component="section" aria-labelledby="home-arrivals-title" sx={{ mt: { xs: 5, md: 8 } }}>
      <Typography id="home-arrivals-title" variant="h4" component="h2" sx={{ mb: 2.5 }}>Hàng mới về</Typography>
      {products.isPending && <Typography role="status">Đang tải hàng mới…</Typography>}
      {products.isError && <Alert severity="error" action={<Button color="inherit" size="small" disabled={products.isFetching}
          onClick={() => { void products.refetch(); }}>Tải lại</Button>}>
        {products.error instanceof ApiError ? products.error.message : 'Chưa tải được hàng mới. Vui lòng thử lại.'}
      </Alert>}
      {products.isSuccess && items.length === 0 && <Stack spacing={1} sx={{ py: 4 }}>
        <Typography>Shop đang chuẩn bị hàng mới.</Typography>
        <Link href={seller.instagram.url} target="_blank" rel="noopener noreferrer" sx={{ fontWeight: 600 }}>
          Theo dõi @{seller.instagram.handle}
        </Link>
      </Stack>}
      {items.length > 0 && <>
        <Box component="ul" aria-label="Hàng mới về" sx={{
          m: 0, p: 0, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          columnGap: { xs: 1.5, md: 3 }, rowGap: { xs: 3, md: 5 },
        }}>
          {items.slice(0, NEW_ARRIVALS).map((item) => <ProductCard key={item.id} item={item} />)}
        </Box>
        <Button component={RouterLink} to="/shop" variant="outlined" sx={{ mt: 4, display: 'flex', mx: 'auto', width: 'fit-content' }}>
          Xem tất cả sản phẩm
        </Button>
      </>}
    </Box>
  </Box>;
}

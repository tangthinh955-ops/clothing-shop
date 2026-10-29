import { Alert, Box, Breadcrumbs, Button, Link, Paper, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
import { ApiError } from '../../../shared/api/client';
import { catalogApi, catalogDetailKey, type CatalogImage } from '../api/catalog.api';
import { pageTitle } from '../../../shared/shop';

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

function Gallery({ name, images }: { name: string; images: CatalogImage[] }) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];
  if (!current) {
    return <Paper square elevation={0} sx={{ aspectRatio: '3/4', display: 'grid', placeItems: 'center', bgcolor: '#f3efe7' }}>
      <Typography color="text.secondary">Chưa có ảnh</Typography>
    </Paper>;
  }
  return <Box sx={{ minWidth: 0 }}>
    <Box component="img" src={current.url} alt={`Ảnh của ${name}`} loading="lazy"
      sx={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }} />
    {images.length > 1 && <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1.5, flexWrap: 'wrap' }}>
      {images.map((image, index) => (
        <Button key={image.id} variant={index === active ? 'contained' : 'outlined'}
          aria-pressed={index === active} aria-label={`Xem ảnh ${index + 1}`} disableRipple
          onClick={() => setActive(index)} sx={{ minWidth: 0, p: 0, ...(index === active ? { pointerEvents: 'none' } : {}) }}>
          <Box component="img" src={image.url} alt="" sx={{ width: 64, height: 64, objectFit: 'cover', display: 'block' }} />
        </Button>
      ))}
    </Stack>}
  </Box>;
}

export function ProductDetailPage() {
  const { slug = '' } = useParams();
  const [variantId, setVariantId] = useState('');
  const product = useQuery({
    queryKey: [...catalogDetailKey, slug], queryFn: () => catalogApi.detail(slug), retry: false,
  });
  const error = product.error;
  const isNotFound = error instanceof ApiError && error.status === 404;
  const selected = product.data?.variants.find((variant) => variant.id === variantId) ?? undefined;

  return <Box sx={{ py: { xs: 3, md: 5 }, minWidth: 0 }}>
    <title>{pageTitle(product.data ? product.data.name : 'Chi tiết sản phẩm')}</title>
    {product.isPending && <Typography role="status">Đang tải sản phẩm…</Typography>}
    {product.isError && <Stack spacing={2} sx={{ maxWidth: 560 }}>
      <AlertMessage error={error} />
      <Stack direction="row" spacing={2} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        {!isNotFound && <Button variant="contained" disabled={product.isFetching}
          onClick={() => { void product.refetch({ cancelRefetch: false }); }}>Tải lại sản phẩm</Button>}
        <Link component={RouterLink} to="/shop">Quay lại bộ sưu tập</Link>
      </Stack>
    </Stack>}
    {product.data && (() => {
      const item = product.data;
      return <Stack spacing={3} sx={{ maxWidth: 980 }}>
        <Breadcrumbs aria-label="Breadcrumb sản phẩm" sx={{ '& nav ol': { flexWrap: 'wrap' } }}>
          <Link component={RouterLink} to="/shop" underline="hover">Bộ sưu tập</Link>
          <Link component={RouterLink} to={`/shop?categoryId=${item.category.id}`} underline="hover">
            {item.category.name}
          </Link>
          <Typography color="text.primary" sx={{ overflowWrap: 'anywhere' }}>{item.name}</Typography>
        </Breadcrumbs>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 3, md: 5 }} useFlexGap
          sx={{ alignItems: 'flex-start' }}>
          <Box sx={{ width: { xs: '100%', md: 400 }, maxWidth: '100%', flexShrink: 0 }}>
            <Gallery name={item.name} images={item.images} />
          </Box>
          <Stack spacing={2} sx={{ minWidth: 0, flex: 1, width: '100%', maxWidth: 560 }}>
            <Typography component="h1" variant="h3" sx={{ fontFamily: 'Georgia, serif', overflowWrap: 'anywhere' }}>
              {item.name}
            </Typography>
            <Typography sx={{ fontWeight: 600, fontSize: 22 }}>
              {selected ? money.format(selected.price) : `Giá từ ${money.format(item.priceFrom)}`}
            </Typography>
            {selected && <Typography role="status"
              sx={{ color: selected.available > 0 ? 'success.dark' : 'error.dark' }}>
              {selected.available > 0 ? `Còn ${selected.available} sản phẩm` : 'Hết hàng'}
            </Typography>}
            <Box role="group" aria-label="Chọn biến thể" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {item.variants.map((variant) => (
                <Button key={variant.id} variant={variant.id === variantId ? 'contained' : 'outlined'}
                  aria-pressed={variant.id === variantId}
                  onClick={() => setVariantId(variant.id)}>{`${variant.size} · ${variant.color}`}</Button>
              ))}
            </Box>
            {item.description !== '' && <Paper square elevation={0} sx={{ p: 2, bgcolor: '#faf9f5' }}>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{item.description}</Typography>
            </Paper>}
          </Stack>
        </Stack>
      </Stack>;
    })()}
  </Box>;
}

function AlertMessage({ error }: { error: unknown }) {
  return <Alert severity="error">
    {error instanceof ApiError ? error.message : 'Chưa tải được sản phẩm. Vui lòng thử lại.'}
  </Alert>;
}

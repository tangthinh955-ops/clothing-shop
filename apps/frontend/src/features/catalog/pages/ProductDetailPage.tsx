import { Alert, Box, Breadcrumbs, Button, Link, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
import { ApiError } from '../../../shared/api/client';
import { pageTitle } from '../../../shared/shop';
import { AddToCartForm } from '../../cart/components/AddToCartForm';
import { catalogApi, catalogDetailKey, type CatalogProduct } from '../api/catalog.api';
import { formatMoney, priceLabel } from '../catalogFormat';
import { OrderByMessage } from '../components/OrderByMessage';
import { ProductGallery } from '../components/ProductGallery';
import { ProductPolicies } from '../components/ProductPolicies';
import { VariantPicker } from '../components/VariantPicker';
import { categoryHref } from '../hooks/useCatalogCategories';

function ProductView({ item }: { item: CatalogProduct }) {
  const variants = item.variants.filter((variant) => variant.active);
  const colors = [...new Set(variants.map((variant) => variant.color))];
  const [chosenColor, setChosenColor] = useState('');
  const [size, setSize] = useState('');
  // The first colour starts selected so its sizes are visible straight away.
  const color = chosenColor || colors[0] || '';
  const selected = size ? variants.find((variant) => variant.color === color && variant.size === size) : undefined;

  return <>
    <Breadcrumbs aria-label="Breadcrumb sản phẩm" sx={{ mb: 2, fontSize: 14, '& ol': { flexWrap: 'wrap' } }}>
      <Link component={RouterLink} to="/shop">Tất cả sản phẩm</Link>
      <Link component={RouterLink} to={categoryHref(item.category.id)}>{item.category.name}</Link>
      <Typography color="text.primary" sx={{ fontSize: 14, overflowWrap: 'anywhere' }}>{item.name}</Typography>
    </Breadcrumbs>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.4fr) minmax(0, 1fr)' }, gap: { xs: 3, md: 6 } }}>
      <ProductGallery name={item.name} images={item.images} />
      {/* On wide screens the details stay in view while the photos scroll past. */}
      <Stack spacing={3} sx={{ minWidth: 0, position: { md: 'sticky' }, top: { md: 96 }, alignSelf: 'start' }}>
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">{item.category.name}</Typography>
          <Typography component="h1" variant="h4" sx={{ overflowWrap: 'anywhere' }}>{item.name}</Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 24 }}>
            {selected ? formatMoney(selected.price) : priceLabel(item.priceFrom, variants)}
          </Typography>
          {selected && <Typography role="status" sx={{ fontWeight: 500, color: selected.available > 0 ? 'success.dark' : 'error.dark' }}>
            {selected.available > 0 ? `Còn ${selected.available} sản phẩm` : 'Hết hàng'}
          </Typography>}
        </Stack>
        <VariantPicker variants={variants} colors={colors} color={color} size={size}
          onColor={(next) => {
            setChosenColor(next);
            // A size picked for the old colour may not exist in the new one, so the shopper picks again.
            setSize('');
          }}
          onSize={setSize} />
        {/* Buying is the primary action once a variant is picked; messaging shop stays one option below. */}
        <AddToCartForm variant={selected} />
        <OrderByMessage selected={selected} />
        {item.description !== '' && <Typography sx={{ whiteSpace: 'pre-line' }}>{item.description}</Typography>}
        <ProductPolicies />
      </Stack>
    </Box>
  </>;
}

export function ProductDetailPage() {
  const { slug = '' } = useParams();
  const product = useQuery({
    queryKey: [...catalogDetailKey, slug], queryFn: () => catalogApi.detail(slug), retry: false,
  });
  const error = product.error;
  const isNotFound = error instanceof ApiError && error.status === 404;

  return <Box sx={{ py: { xs: 2, md: 4 }, minWidth: 0 }}>
    <title>{pageTitle(product.data ? product.data.name : 'Chi tiết sản phẩm')}</title>
    {product.isPending && <Typography role="status">Đang tải sản phẩm…</Typography>}
    {product.isError && <Stack spacing={2} sx={{ maxWidth: 560 }}>
      <Alert severity="error">
        {error instanceof ApiError ? error.message : 'Chưa tải được sản phẩm. Vui lòng thử lại.'}
      </Alert>
      <Stack direction="row" spacing={2} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        {!isNotFound && <Button variant="contained" disabled={product.isFetching}
          onClick={() => { void product.refetch({ cancelRefetch: false }); }}>Tải lại sản phẩm</Button>}
        <Link component={RouterLink} to="/shop">Quay lại bộ sưu tập</Link>
      </Stack>
    </Stack>}
    {product.data && <ProductView key={product.data.id} item={product.data} />}
  </Box>;
}

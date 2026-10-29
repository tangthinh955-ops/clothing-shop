import { Box, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import type { CatalogProduct, CatalogVariant } from '../api/catalog.api';
import { priceLabel, sortSizes } from '../catalogFormat';

// "S – XL · 2 màu" from the variants a shopper can actually pick.
function variantSummary(variants: CatalogVariant[]) {
  const sizes = sortSizes(variants.map((variant) => variant.size));
  const colors = new Set(variants.map((variant) => variant.color)).size;
  const sizeRange = sizes.length > 1 ? `${sizes[0]} – ${sizes[sizes.length - 1]}` : sizes[0] ?? '';
  return [sizeRange, colors > 1 ? `${colors} màu` : ''].filter(Boolean).join(' · ');
}

const photoStyle = { gridArea: '1 / 1', width: '100%', height: '100%', objectFit: 'cover', display: 'block' } as const;

export function ProductCard({ item }: { item: CatalogProduct }) {
  const [cover, alternate] = item.images;
  const variants = item.variants.filter((variant) => variant.active);
  const summary = variantSummary(variants);
  return <Box component="li" aria-label={item.name} sx={{
    position: 'relative', minWidth: 0, listStyle: 'none',
    // Only real pointers swap to the second photo; touch screens keep the cover.
    '@media (hover: hover)': { '&:hover [data-alternate]': { opacity: 1 } },
  }}>
    <Box sx={{ aspectRatio: '3/4', bgcolor: '#f5f5f5', overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
      {cover ? <Box component="img" src={cover.url} alt={`Ảnh của ${item.name}`} loading="lazy" sx={photoStyle} />
        : <Typography variant="body2" color="text.secondary">Chưa có ảnh</Typography>}
      {cover && alternate && <Box component="img" data-alternate src={alternate.url} alt="" loading="lazy"
        sx={{ ...photoStyle, opacity: 0, transition: 'opacity .3s ease' }} />}
    </Box>
    <Stack sx={{ pt: 1.5, gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary">{item.category.name}</Typography>
      {/* The name link stretches over the whole card so the photo is clickable without a second link. */}
      <Link component={RouterLink} to={`/products/${item.slug}`} underline="none" sx={{
        fontWeight: 500, overflowWrap: 'anywhere', '&::after': { content: '""', position: 'absolute', inset: 0 },
      }}>
        {item.name}
      </Link>
      <Typography sx={{ fontWeight: 700 }}>{priceLabel(item.priceFrom, variants)}</Typography>
      {summary && <Typography variant="body2" color="text.secondary">{summary}</Typography>}
    </Stack>
  </Box>;
}

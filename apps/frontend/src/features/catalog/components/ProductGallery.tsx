import { Box, Typography } from '@mui/material';
import { useState } from 'react';
import type { CatalogImage } from '../api/catalog.api';

const photoBox = { aspectRatio: '3/4', bgcolor: '#f5f5f5' } as const;

// One set of photos: phones swipe through them one at a time, wider screens see them all in a two-column grid.
export function ProductGallery({ name, images }: { name: string; images: CatalogImage[] }) {
  const [active, setActive] = useState(0);
  if (images.length === 0) {
    return <Box sx={{ ...photoBox, display: 'grid', placeItems: 'center' }}>
      <Typography color="text.secondary">Chưa có ảnh</Typography>
    </Box>;
  }
  return <Box sx={{ position: 'relative', minWidth: 0, mx: { xs: -2, sm: 0 } }}>
    <Box onScroll={(event) => {
      const strip = event.currentTarget;
      if (strip.clientWidth > 0) setActive(Math.round(strip.scrollLeft / strip.clientWidth));
    }} sx={{
      display: { xs: 'flex', md: 'grid' }, gridTemplateColumns: { md: images.length > 1 ? '1fr 1fr' : '1fr' }, gap: { md: 1 },
      overflowX: { xs: 'auto', md: 'visible' }, scrollSnapType: 'x mandatory', scrollbarWidth: 'none',
    }}>
      {images.map((image, index) => <Box key={image.id} component="img" src={image.url} alt={`Ảnh ${index + 1} của ${name}`}
        loading={index === 0 ? 'eager' : 'lazy'}
        sx={{ ...photoBox, flex: '0 0 100%', width: '100%', objectFit: 'cover', display: 'block', scrollSnapAlign: 'start' }} />)}
    </Box>
    {images.length > 1 && <Typography aria-hidden="true" variant="caption" sx={{
      display: { md: 'none' }, position: 'absolute', right: 12, bottom: 12, px: 1, bgcolor: 'rgba(255,255,255,.85)', fontWeight: 600,
    }}>
      {active + 1} / {images.length}
    </Typography>}
  </Box>;
}

import { Box, Link, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import type { CatalogCategory } from '../api/catalog.api';
import { categoryHref } from '../hooks/useCatalogCategories';

export function CategoryStrip({ categories }: { categories: CatalogCategory[] }) {
  if (categories.length === 0) return null;
  return <Box component="section" aria-labelledby="home-categories-title" sx={{ mt: { xs: 5, md: 8 } }}>
    <Typography id="home-categories-title" variant="h4" component="h2" sx={{ mb: 2.5 }}>Danh mục</Typography>
    {/* Phones swipe through the tiles; wider screens lay them out in a grid. */}
    <Box component="nav" aria-label="Danh mục nổi bật" sx={{
      display: { xs: 'flex', md: 'grid' }, gridTemplateColumns: { md: 'repeat(4, 1fr)' }, gap: { xs: 1.5, md: 2 },
      overflowX: { xs: 'auto', md: 'visible' }, scrollSnapType: 'x mandatory', mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, pb: 1,
    }}>
      {categories.map((category) => <Link key={category.id} component={RouterLink} to={categoryHref(category.id)} underline="none"
        sx={{
          flex: '0 0 auto', minWidth: { xs: 160, md: 0 }, scrollSnapAlign: 'start', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', gap: 2, px: 2.5, py: 3, border: 1, borderColor: 'divider', fontWeight: 700,
          '&:hover': { borderColor: 'text.primary' },
        }}>
        {category.name}
        <span aria-hidden="true">→</span>
      </Link>)}
    </Box>
  </Box>;
}

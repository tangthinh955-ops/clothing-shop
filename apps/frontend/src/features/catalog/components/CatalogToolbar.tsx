import { Box, Button, IconButton, Stack, TextField, Typography } from '@mui/material';
import { CloseIcon } from '../../../shared/ui/icons';
import type { CatalogCategory } from '../api/catalog.api';
import { SORT_LABELS, SORTS, type SortValue } from '../hooks/useCatalogFilters';

interface CatalogToolbarProps {
  categories: CatalogCategory[] | undefined;
  categoriesFailed: boolean;
  categoryId: string;
  q: string;
  sort: SortValue;
  total: number | undefined;
  hasFilters: boolean;
  onCategory: (categoryId: string) => void;
  onSort: (sort: string) => void;
  onClearSearch: () => void;
  onClearFilters: () => void;
}

function CategoryButton({ label, pressed, onClick }: { label: string; pressed: boolean; onClick: () => void }) {
  return <Button size="small" variant={pressed ? 'contained' : 'outlined'} aria-pressed={pressed} onClick={onClick}
    sx={{ flex: '0 0 auto', minHeight: 36, borderRadius: '999px', px: 2, whiteSpace: 'nowrap' }}>
    {label}
  </Button>;
}

export function CatalogToolbar(props: CatalogToolbarProps) {
  const { categories, categoryId, q, total } = props;
  return <Stack spacing={2} useFlexGap sx={{ mb: 3, minWidth: 0 }}>
    {/* Phones swipe through the categories; wider screens wrap them. */}
    <Box role="group" aria-label="Lọc theo danh mục" sx={{
      display: 'flex', gap: 1, flexWrap: { xs: 'nowrap', md: 'wrap' }, overflowX: { xs: 'auto', md: 'visible' },
      mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, pb: 0.5,
    }}>
      <CategoryButton label="Tất cả" pressed={categoryId === ''} onClick={() => props.onCategory('')} />
      {(categories ?? []).map((category) => <CategoryButton key={category.id} label={category.name}
        pressed={category.id === categoryId} onClick={() => props.onCategory(category.id)} />)}
    </Box>
    {props.categoriesFailed && <Typography variant="body2" color="text.secondary">
      Không tải được danh mục. Danh sách hàng vẫn dùng được.
    </Typography>}
    <Stack direction="row" sx={{
      alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap',
      borderTop: 1, borderBottom: 1, borderColor: 'divider', py: 1.5,
    }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, flexWrap: 'wrap', minWidth: 0 }}>
        {total !== undefined && <Typography role="status" sx={{ fontWeight: 500 }}>{total} sản phẩm</Typography>}
        {q && <Stack direction="row" sx={{ alignItems: 'center', border: 1, borderColor: 'divider', pl: 1.5, minWidth: 0 }}>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>Tìm: “{q}”</Typography>
          <IconButton size="small" color="inherit" aria-label="Xóa tìm kiếm" onClick={props.onClearSearch}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>}
        {props.hasFilters && <Button size="small" onClick={props.onClearFilters} sx={{ minHeight: 36 }}>Xóa lọc</Button>}
      </Stack>
      <TextField select size="small" label="Thứ tự sắp xếp" value={props.sort} onChange={(event) => props.onSort(event.target.value)}
        slotProps={{ select: { native: true }, inputLabel: { shrink: true } }} sx={{ width: { xs: '100%', sm: 220 } }}>
        {SORTS.map((value) => <option key={value} value={value}>{SORT_LABELS[value]}</option>)}
      </TextField>
    </Stack>
  </Stack>;
}

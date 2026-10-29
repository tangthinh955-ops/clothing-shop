import { Box, Button, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import type { CatalogVariant } from '../api/catalog.api';
import { sortSizes } from '../catalogFormat';

interface VariantPickerProps {
  variants: CatalogVariant[];
  colors: string[];
  color: string;
  size: string;
  onColor: (color: string) => void;
  onSize: (size: string) => void;
}

function OptionButton({ label, name, pressed, soldOut = false, onClick }:
  { label: string; name?: string | undefined; pressed: boolean; soldOut?: boolean; onClick: () => void }) {
  return <Button variant={pressed ? 'contained' : 'outlined'} aria-pressed={pressed} aria-label={name} onClick={onClick}
    sx={{ minWidth: 56, px: 2, ...(soldOut && !pressed ? { color: 'text.disabled', textDecoration: 'line-through' } : {}) }}>
    {label}
  </Button>;
}

export function VariantPicker({ variants, colors, color, size, onColor, onSize }: VariantPickerProps) {
  const inColor = variants.filter((variant) => variant.color === color);
  const sizes = sortSizes(inColor.map((variant) => variant.size));
  return <Stack spacing={2.5}>
    <Box>
      <Typography sx={{ fontWeight: 600, mb: 1 }}>Màu: {color}</Typography>
      <Box role="group" aria-label="Chọn màu" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {colors.map((value) => <OptionButton key={value} label={value} pressed={value === color} onClick={() => onColor(value)} />)}
      </Box>
    </Box>
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
        <Typography sx={{ fontWeight: 600 }}>Size: {size || 'chưa chọn'}</Typography>
        <Link component={RouterLink} to="/size-guide" variant="body2" underline="always">Bảng size</Link>
      </Stack>
      <Box role="group" aria-label="Chọn size" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {sizes.map((value) => {
          // A sold-out size stays selectable so the shopper can see it is out of stock, but reads as crossed out.
          const soldOut = inColor.every((variant) => variant.size !== value || variant.available <= 0);
          return <OptionButton key={value} label={value} name={soldOut ? `${value}, hết hàng` : undefined} soldOut={soldOut}
            pressed={value === size} onClick={() => onSize(value)} />;
        })}
      </Box>
    </Box>
  </Stack>;
}

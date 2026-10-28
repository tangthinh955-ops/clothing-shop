import { Box, Button, Chip, Stack, Typography } from '@mui/material';

interface Props {
  productName: string;
  url: string;
  position: number;
  total: number;
  saved: boolean;
  disabled: boolean;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
}

export function ProductImageTile({ productName, url, position, total, saved, disabled, onMove, onRemove }: Props) {
  return <Box component="li" sx={{ minWidth: 0 }}>
    <Box component="img" src={url} alt={`Ảnh ${position} của ${productName}${saved ? '' : ' (chưa lưu)'}`}
      sx={{ display: 'block', width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', bgcolor: 'action.hover' }} />
    <Stack direction="row" useFlexGap sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
      <Typography variant="body2">Ảnh {position}{saved ? '' : ' · chưa lưu'}</Typography>
      {position === 1 && <Chip size="small" label="Ảnh chính" />}
    </Stack>
    <Stack direction="row" useFlexGap sx={{ gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
      <Button size="small" color="inherit" disabled={disabled || position === 1} aria-label={`Đưa ảnh ${position} lên trước`}
        onClick={() => onMove(-1)}>Lên</Button>
      <Button size="small" color="inherit" disabled={disabled || position === total} aria-label={`Đưa ảnh ${position} ra sau`}
        onClick={() => onMove(1)}>Xuống</Button>
      <Button size="small" color="inherit" disabled={disabled} aria-label={saved ? `Gỡ ảnh ${position}` : `Bỏ ảnh chưa lưu ${position}`}
        onClick={onRemove}>{saved ? 'Gỡ' : 'Bỏ'}</Button>
    </Stack>
  </Box>;
}

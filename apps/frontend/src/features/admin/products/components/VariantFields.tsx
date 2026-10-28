import { Box, Button, Checkbox, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material';
import { productSizes } from '../api/products.api';
import type { VariantDraft } from './variantDrafts';

interface Props {
  idPrefix: string;
  position: number;
  values: VariantDraft;
  fields: Record<string, string>;
  disabled: boolean;
  onChange: (values: VariantDraft) => void;
  onRemove?: () => void;
}

export function VariantFields({ idPrefix, position, values, fields, disabled, onChange, onRemove }: Props) {
  const index = position - 1;
  const id = `${idPrefix}-variant-${values.key}`;
  const error = (field: string) => fields[`variants.${index}.${field}`];
  const title = `Biến thể ${position}${values.id ? '' : ' (mới)'}`;

  return <Paper component="section" aria-labelledby={`${id}-title`} variant="outlined" sx={{ p: 2, minWidth: 0 }}>
    <Stack direction="row" useFlexGap sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
      <Typography id={`${id}-title`} component="h3" variant="subtitle1" sx={{ fontWeight: 600 }}>{title}</Typography>
      {onRemove && <Button size="small" color="inherit" disabled={disabled} onClick={onRemove}
        aria-label={`Bỏ biến thể mới ${position}`}>Bỏ dòng này</Button>}
    </Stack>
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
      <TextField id={`${id}-sku`} label={`SKU ${position}`} value={values.sku} disabled={disabled}
        onChange={(event) => onChange({ ...values, sku: event.target.value })}
        error={Boolean(error('sku'))} helperText={error('sku') ?? 'Mã riêng, được lưu bằng chữ hoa.'}
        slotProps={{ htmlInput: { required: true, maxLength: 64, pattern: '[a-zA-Z0-9]([a-zA-Z0-9_]|-)*' } }} />
      <TextField id={`${id}-size`} select label={`Size ${position}`} value={values.size} disabled={disabled} onChange={(event) => {
        const selected = productSizes.find((value) => value === event.target.value);
        if (selected) onChange({ ...values, size: selected });
      }} error={Boolean(error('size'))} helperText={error('size')} slotProps={{ select: { native: true } }}>
        {productSizes.map((value) => <option key={value} value={value}>{value}</option>)}
      </TextField>
      <TextField id={`${id}-color`} label={`Màu ${position}`} value={values.color} disabled={disabled}
        onChange={(event) => onChange({ ...values, color: event.target.value })}
        error={Boolean(error('color'))} helperText={error('color')}
        slotProps={{ htmlInput: { required: true, maxLength: 40 } }} />
      <TextField id={`${id}-price`} label={`Giá ${position} (VND)`} type="number" value={values.price} disabled={disabled}
        onChange={(event) => onChange({ ...values, price: event.target.value })}
        error={Boolean(error('price'))} helperText={error('price') ?? 'Số nguyên từ 1 đến 100.000.000 VND.'}
        slotProps={{ htmlInput: { required: true, min: 1, max: 100000000, step: 1, inputMode: 'numeric' } }} />
    </Box>
    <FormControlLabel sx={{ mt: 1 }} label={`Bật biến thể ${position}`} disabled={disabled}
      control={<Checkbox checked={values.active} onChange={(event) => onChange({ ...values, active: event.target.checked })} />} />
  </Paper>;
}

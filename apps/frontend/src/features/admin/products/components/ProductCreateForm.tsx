import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { Category } from '../../categories/api/categories.api';
import { ApiError } from '../../../../shared/api/client';
import { productSizes, type ProductInput, type ProductSize } from '../api/products.api';
import { ProductInfoFields, type ProductInfoValues } from './ProductInfoFields';

interface Props {
  categories: Category[];
  onSubmit: (input: ProductInput) => Promise<void>;
}

export function ProductCreateForm({ categories, onSubmit }: Props) {
  const [info, setInfo] = useState<ProductInfoValues>({ name: '', slug: '', description: '', categoryId: categories[0]?.id ?? '' });
  const [sku, setSku] = useState('');
  const [size, setSize] = useState<ProductSize>('M');
  const [color, setColor] = useState('');
  const [price, setPrice] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const busy = useRef(false);
  const errorSummary = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (error) errorSummary.current?.focus();
  }, [error]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    setError('');
    setFields({});
    const amount = Number(price);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000000) {
      setError('Giá phải là số nguyên từ 1 đến 100.000.000 VND.');
      return;
    }
    busy.current = true;
    setPending(true);
    try {
      await onSubmit({ name: info.name, slug: info.slug, description: info.description, categoryId: info.categoryId,
        variants: [{ sku, size, color, price: amount, active: true }] });
    } catch (cause: unknown) {
      setError(cause instanceof ApiError ? cause.message : 'Chưa tạo được sản phẩm. Vui lòng thử lại.');
      if (cause instanceof ApiError) setFields(Object.fromEntries(cause.fieldErrors.map((field) => [field.field, field.message])));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return <Box component="form" aria-label="Tạo sản phẩm nháp" aria-busy={pending} onSubmit={(event) => { void submit(event); }}>
    <Stack spacing={2.5}>
      {error && <Alert severity="error" ref={errorSummary} tabIndex={-1}>{error}</Alert>}
      <Typography component="h2" variant="h5">Thông tin sản phẩm</Typography>
      <ProductInfoFields idPrefix={id} categories={categories} values={info} fields={fields} disabled={pending} onChange={setInfo} />
      <Box component="fieldset" sx={{ m: 0, p: 0, border: 0, minWidth: 0 }}>
        <Typography component="legend" variant="h5" sx={{ mb: 2.5 }}>Biến thể đầu tiên</Typography>
        <Stack spacing={2.5}>
          <TextField id={`${id}-sku`} label="SKU 1" value={sku} disabled={pending} onChange={(event) => setSku(event.target.value)}
            error={Boolean(fields['variants.0.sku'])} helperText={fields['variants.0.sku'] ?? 'Mã riêng, ví dụ COTTON-M-DEN. Được lưu bằng chữ hoa.'}
            slotProps={{ htmlInput: { required: true, maxLength: 64, pattern: '[a-zA-Z0-9]([a-zA-Z0-9_]|-)*' } }} />
          <TextField id={`${id}-size`} select label="Size 1" value={size} disabled={pending} onChange={(event) => {
            const selected = productSizes.find((value) => value === event.target.value);
            if (selected) setSize(selected);
          }} error={Boolean(fields['variants.0.size'])} helperText={fields['variants.0.size']} slotProps={{ select: { native: true } }}>
            {productSizes.map((value) => <option key={value} value={value}>{value}</option>)}
          </TextField>
          <TextField id={`${id}-color`} label="Màu 1" value={color} disabled={pending} onChange={(event) => setColor(event.target.value)}
            error={Boolean(fields['variants.0.color'])} helperText={fields['variants.0.color']}
            slotProps={{ htmlInput: { required: true, maxLength: 40 } }} />
          <TextField id={`${id}-price`} label="Giá 1 (VND)" type="number" value={price} disabled={pending} onChange={(event) => setPrice(event.target.value)}
            error={Boolean(fields['variants.0.price'])} helperText={fields['variants.0.price'] ?? 'Số nguyên từ 1 đến 100.000.000 VND.'}
            slotProps={{ htmlInput: { required: true, min: 1, max: 100000000, step: 1, inputMode: 'numeric' } }} />
        </Stack>
      </Box>
      <Typography variant="body2" color="text.secondary">Sản phẩm được lưu nháp, tồn kho ban đầu bằng 0. Khách chưa xem được sản phẩm này.</Typography>
      <Button type="submit" variant="contained" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu sản phẩm'}</Button>
    </Stack>
  </Box>;
}

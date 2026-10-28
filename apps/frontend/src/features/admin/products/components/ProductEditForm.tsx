import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { Category } from '../../categories/api/categories.api';
import { ApiError } from '../../../../shared/api/client';
import type { Product, ProductUpdateInput } from '../api/products.api';
import { ProductInfoFields, type ProductInfoValues } from './ProductInfoFields';

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const conflictMessage = 'Sản phẩm đã thay đổi hoặc đường dẫn sản phẩm bị trùng. Hãy tải dữ liệu mới, kiểm tra đường dẫn và thử lại.';

interface Props {
  product: Product;
  categories: Category[];
  onSubmit: (input: ProductUpdateInput) => Promise<void>;
  disabled?: boolean;
}

export function ProductEditForm({ product, categories, onSubmit, disabled = false }: Props) {
  // Snapshot freezes the variant list and version of this edit session; the page remounts this form (key=revision) after an explicit reload.
  const [snapshot] = useState(product);
  const [info, setInfo] = useState<ProductInfoValues>({ name: product.name, slug: product.slug, description: product.description, categoryId: product.categoryId });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const busy = useRef(false);
  const errorSummary = useRef<HTMLDivElement>(null);
  const id = useId();
  const locked = pending || disabled;

  useEffect(() => {
    if (error) errorSummary.current?.focus();
  }, [error]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || disabled) return;
    setError('');
    setFields({});
    busy.current = true;
    setPending(true);
    try {
      await onSubmit({ name: info.name, slug: info.slug, description: info.description, categoryId: info.categoryId,
        expectedVersion: snapshot.version,
        variants: snapshot.variants.map((variant) => ({ id: variant.id, sku: variant.sku, size: variant.size, color: variant.color, price: variant.price, active: variant.active })) });
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 409) setError(conflictMessage);
      else setError(cause instanceof ApiError ? cause.message : 'Chưa cập nhật được sản phẩm. Vui lòng thử lại.');
      if (cause instanceof ApiError) setFields(Object.fromEntries(cause.fieldErrors.map((field) => [field.field, field.message])));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return <Box component="form" aria-label="Sửa sản phẩm nháp" aria-busy={locked} onSubmit={(event) => { void submit(event); }}>
    <Stack spacing={2.5}>
      {error && <Alert severity="error" ref={errorSummary} tabIndex={-1}>{error}</Alert>}
      <Typography component="h2" variant="h5">Thông tin sản phẩm</Typography>
      <ProductInfoFields idPrefix={id} categories={categories} values={info} fields={fields} disabled={locked} onChange={setInfo} />
      <Box component="fieldset" sx={{ m: 0, p: 0, border: 0, minWidth: 0 }}>
        <Typography component="legend" variant="h5" sx={{ mb: 2.5 }}>Biến thể hiện có</Typography>
        <Stack spacing={1.5}>
          {snapshot.variants.map((variant) => <Paper key={variant.id} variant="outlined" sx={{ p: 2, overflowWrap: 'anywhere' }}>
            <Typography component="span" sx={{ fontWeight: 600 }}>{variant.sku}</Typography>
            <Typography variant="body2">{variant.size} · {variant.color} · {money.format(variant.price)}{variant.active ? '' : ' · Đang tắt'}</Typography>
          </Paper>)}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>Phần này chưa cho sửa SKU, size, màu, giá hoặc thêm/tắt biến thể.</Typography>
      </Box>
      <Button type="submit" variant="contained" disabled={locked}>{pending ? 'Đang lưu…' : 'Lưu thay đổi'}</Button>
    </Stack>
  </Box>;
}

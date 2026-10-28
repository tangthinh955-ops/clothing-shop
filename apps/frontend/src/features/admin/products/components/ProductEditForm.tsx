import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { Category } from '../../categories/api/categories.api';
import { ApiError } from '../../../../shared/api/client';
import type { Product, ProductUpdateInput } from '../api/products.api';
import { ProductInfoFields, type ProductInfoValues } from './ProductInfoFields';
import { VariantFields } from './VariantFields';
import { maxVariants, newVariantDraft, toVariantDraft, toVariantInput, validateVariants, type VariantDraft } from './variantDrafts';

const conflictMessage = 'Sản phẩm đã thay đổi, hoặc đường dẫn, SKU hoặc tổ hợp size/màu bị trùng. Hãy tải dữ liệu mới, kiểm tra lại rồi thử lại.';

interface Props {
  product: Product;
  categories: Category[];
  onSubmit: (input: ProductUpdateInput) => Promise<void>;
  disabled?: boolean;
}

// `product` is the page snapshot: fields are read once on mount, while `version` follows the page (an image save may advance it).
export function ProductEditForm({ product, categories, onSubmit, disabled = false }: Props) {
  const [info, setInfo] = useState<ProductInfoValues>({ name: product.name, slug: product.slug, description: product.description, categoryId: product.categoryId });
  const [variants, setVariants] = useState<VariantDraft[]>(() => product.variants.map(toVariantDraft));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const busy = useRef(false);
  const nextNewKey = useRef(0);
  const errorSummary = useRef<HTMLDivElement>(null);
  const id = useId();
  const locked = pending || disabled;

  useEffect(() => {
    if (error) errorSummary.current?.focus();
  }, [error]);

  function changeVariant(key: string, next: VariantDraft) {
    setVariants((rows) => rows.map((row) => row.key === key ? next : row));
  }

  function addVariant() {
    nextNewKey.current += 1;
    setVariants((rows) => [...rows, newVariantDraft(`new-${nextNewKey.current}`)]);
  }

  function removeVariant(key: string) {
    setVariants((rows) => rows.filter((row) => row.key !== key));
    // Row errors are keyed by position, so they would point at the wrong row once later rows shift up.
    setFields({});
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || disabled) return;
    setError('');
    const problems = validateVariants(variants);
    setFields(problems);
    if (Object.keys(problems).length) {
      setError('Kiểm tra lại các biến thể được đánh dấu.');
      return;
    }
    busy.current = true;
    setPending(true);
    try {
      await onSubmit({ name: info.name, slug: info.slug, description: info.description, categoryId: info.categoryId,
        expectedVersion: product.version, variants: variants.map(toVariantInput) });
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
        <Typography component="legend" variant="h5" sx={{ mb: 1 }}>Biến thể</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Biến thể đã lưu không xóa được; bỏ chọn “Bật biến thể” để ngừng dùng. Biến thể mới có tồn kho ban đầu bằng 0.
        </Typography>
        <Stack spacing={2}>
          {variants.map((variant, index) => <VariantFields key={variant.key} idPrefix={id} position={index + 1} values={variant}
            fields={fields} disabled={locked} onChange={(next) => changeVariant(variant.key, next)}
            {...(variant.id ? {} : { onRemove: () => removeVariant(variant.key) })} />)}
        </Stack>
        <Button variant="outlined" sx={{ mt: 2 }} disabled={locked || variants.length >= maxVariants} onClick={addVariant}>Thêm biến thể</Button>
      </Box>
      <Button type="submit" variant="contained" disabled={locked}>{pending ? 'Đang lưu…' : 'Lưu thay đổi'}</Button>
    </Stack>
  </Box>;
}

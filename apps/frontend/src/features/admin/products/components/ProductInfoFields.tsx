import { TextField } from '@mui/material';
import type { Category } from '../../categories/api/categories.api';

export interface ProductInfoValues {
  name: string;
  slug: string;
  description: string;
  categoryId: string;
}

interface Props {
  idPrefix: string;
  categories: Category[];
  values: ProductInfoValues;
  fields: Record<string, string>;
  disabled: boolean;
  onChange: (values: ProductInfoValues) => void;
}

export function ProductInfoFields({ idPrefix, categories, values, fields, disabled, onChange }: Props) {
  return <>
    <TextField id={`${idPrefix}-name`} label="Tên sản phẩm" value={values.name} disabled={disabled}
      onChange={(event) => onChange({ ...values, name: event.target.value })}
      error={Boolean(fields['name'])} helperText={fields['name']}
      slotProps={{ htmlInput: { required: true, minLength: 2, maxLength: 120 } }} />
    <TextField id={`${idPrefix}-slug`} label="Đường dẫn sản phẩm" value={values.slug} disabled={disabled}
      onChange={(event) => onChange({ ...values, slug: event.target.value })}
      error={Boolean(fields['slug'])} helperText={fields['slug'] ?? 'Ví dụ: ao-cotton. Chữ thường không dấu, số và dấu gạch ngang.'}
      slotProps={{ htmlInput: { required: true, maxLength: 120, pattern: '[a-z0-9]+(-[a-z0-9]+)*' } }} />
    <TextField id={`${idPrefix}-category`} select label="Danh mục" value={values.categoryId} disabled={disabled}
      onChange={(event) => onChange({ ...values, categoryId: event.target.value })}
      error={Boolean(fields['categoryId'])} helperText={fields['categoryId']}
      slotProps={{ select: { native: true }, htmlInput: { required: true } }}>
      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.active ? '' : ' (Đang tắt)'}</option>)}
    </TextField>
    <TextField id={`${idPrefix}-description`} label="Mô tả" multiline minRows={3} value={values.description} disabled={disabled}
      onChange={(event) => onChange({ ...values, description: event.target.value })}
      error={Boolean(fields['description'])} helperText={fields['description'] ?? 'Không bắt buộc, tối đa 5.000 ký tự.'}
      slotProps={{ htmlInput: { maxLength: 5000 } }} />
  </>;
}

import type { ProductSize, ProductVariant, VariantUpdateInput } from '../api/products.api';

// Form state of one variant row; price stays a string so a half-typed number is not coerced.
export interface VariantDraft {
  key: string;
  id?: string;
  sku: string;
  size: ProductSize;
  color: string;
  price: string;
  active: boolean;
}

export const maxVariants = 100;

export function toVariantDraft(variant: ProductVariant): VariantDraft {
  return { key: variant.id, id: variant.id, sku: variant.sku, size: variant.size, color: variant.color, price: String(variant.price), active: variant.active };
}

export function newVariantDraft(key: string): VariantDraft {
  return { key, sku: '', size: 'M', color: '', price: '', active: true };
}

export function toVariantInput({ id, sku, size, color, price, active }: VariantDraft): VariantUpdateInput {
  return { ...(id ? { id } : {}), sku, size, color, price: Number(price), active };
}

// Mirrors the backend rules (VariantDto, unique SKU and product/size/color) so errors point at the exact row before sending.
export function validateVariants(rows: VariantDraft[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const skus = new Set<string>();
  const combinations = new Set<string>();
  rows.forEach((row, index) => {
    const sku = row.sku.trim().toUpperCase();
    const color = row.color.trim().toLowerCase();
    const price = Number(row.price);
    if (!sku) errors[`variants.${index}.sku`] = 'Nhập SKU cho biến thể.';
    else if (skus.has(sku)) errors[`variants.${index}.sku`] = 'SKU bị trùng với biến thể khác trong sản phẩm.';
    if (!color) errors[`variants.${index}.color`] = 'Nhập màu cho biến thể.';
    else if (combinations.has(`${row.size}|${color}`)) errors[`variants.${index}.color`] = 'Đã có biến thể khác cùng size và màu.';
    if (row.price.trim() === '' || !Number.isInteger(price) || price < 1 || price > 100000000) {
      errors[`variants.${index}.price`] = 'Giá phải là số nguyên từ 1 đến 100.000.000 VND.';
    }
    skus.add(sku);
    combinations.add(`${row.size}|${color}`);
  });
  return errors;
}

import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../shared/api/client';
import type { Category } from '../../categories/api/categories.api';
import type { Product, ProductUpdateInput } from '../api/products.api';
import { ProductEditForm } from './ProductEditForm';

const category: Category = { id: 'category-test', name: 'Áo', slug: 'ao', active: true, version: 1 };
const product: Product = { id: 'product-test', name: 'Áo cotton', slug: 'ao-cotton', description: '', categoryId: category.id,
  category: { id: category.id, name: 'Áo', slug: 'ao' }, priceFrom: 250000, status: 'DRAFT', version: 3, images: [],
  variants: [
    { id: 'variant-m', sku: 'COTTON-M', size: 'M', color: 'đen', price: 250000, active: true, available: 0 },
    { id: 'variant-l', sku: 'COTTON-L', size: 'L', color: 'đen', price: 260000, active: false, available: 0 },
  ] };

function renderForm(onSubmit = vi.fn<(input: ProductUpdateInput) => Promise<void>>().mockResolvedValue(undefined)) {
  render(<ProductEditForm product={product} categories={[category]} onSubmit={onSubmit} />);
  return onSubmit;
}

function submitted(onSubmit: ReturnType<typeof renderForm>) {
  expect(onSubmit).toHaveBeenCalledTimes(1);
  const input = onSubmit.mock.calls[0]?.[0];
  if (!input) throw new Error('Missing submit input');
  return input;
}

describe('edit variants of a draft product', () => {
  it('edits saved variants in place, keeps their ids and turns a variant off instead of deleting it', async () => {
    const onSubmit = renderForm();
    expect(screen.getByLabelText('SKU 1')).toHaveValue('COTTON-M');
    expect(screen.getByLabelText('Giá 2 (VND)')).toHaveValue(260000);
    expect(screen.getByLabelText('Bật biến thể 2')).not.toBeChecked();
    expect(screen.queryByRole('button', { name: /Bỏ biến thể/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('SKU 1'), { target: { value: 'COTTON-M-DEN' } });
    fireEvent.change(screen.getByLabelText('Size 1'), { target: { value: 'S' } });
    fireEvent.change(screen.getByLabelText('Màu 1'), { target: { value: 'trắng' } });
    fireEvent.change(screen.getByLabelText('Giá 1 (VND)'), { target: { value: '199000' } });
    await userEvent.click(screen.getByLabelText('Bật biến thể 1'));
    await userEvent.click(screen.getByLabelText('Bật biến thể 2'));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(submitted(onSubmit)).toEqual({ name: 'Áo cotton', slug: 'ao-cotton', description: '', categoryId: category.id, expectedVersion: 3,
      variants: [
        { id: 'variant-m', sku: 'COTTON-M-DEN', size: 'S', color: 'trắng', price: 199000, active: false },
        { id: 'variant-l', sku: 'COTTON-L', size: 'L', color: 'đen', price: 260000, active: true },
      ] });
  });

  it('adds a new variant that is sent without an id', async () => {
    const onSubmit = renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm biến thể' }));
    const added = screen.getByRole('region', { name: 'Biến thể 3 (mới)' });
    expect(within(added).getByLabelText('Bật biến thể 3')).toBeChecked();
    fireEvent.change(screen.getByLabelText('SKU 3'), { target: { value: 'COTTON-XL' } });
    fireEvent.change(screen.getByLabelText('Size 3'), { target: { value: 'XL' } });
    fireEvent.change(screen.getByLabelText('Màu 3'), { target: { value: 'đen' } });
    fireEvent.change(screen.getByLabelText('Giá 3 (VND)'), { target: { value: '270000' } });
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    const variants = submitted(onSubmit).variants;
    expect(variants).toHaveLength(3);
    expect(variants[2]).toEqual({ sku: 'COTTON-XL', size: 'XL', color: 'đen', price: 270000, active: true });
    expect(variants[2]).not.toHaveProperty('id');
  });

  it('removes an unsaved new variant before saving', async () => {
    const onSubmit = renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm biến thể' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ biến thể mới 3' }));
    expect(screen.queryByLabelText('SKU 3')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(submitted(onSubmit).variants.map((variant) => variant.id)).toEqual(['variant-m', 'variant-l']);
  });

  it('marks the exact row for invalid price, duplicate SKU and duplicate size/color without sending', async () => {
    const onSubmit = renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm biến thể' }));
    fireEvent.change(screen.getByLabelText('SKU 3'), { target: { value: ' cotton-m ' } });
    fireEvent.change(screen.getByLabelText('Size 3'), { target: { value: 'M' } });
    fireEvent.change(screen.getByLabelText('Màu 3'), { target: { value: 'Đen' } });
    fireEvent.change(screen.getByLabelText('Giá 3 (VND)'), { target: { value: '0' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Sửa sản phẩm nháp' }));
    const summary = await screen.findByRole('alert');
    expect(summary).toHaveTextContent('Kiểm tra lại các biến thể được đánh dấu.');
    expect(summary).toHaveFocus();
    expect(screen.getByText('SKU bị trùng với biến thể khác trong sản phẩm.')).toBeVisible();
    expect(screen.getByText('Đã có biến thể khác cùng size và màu.')).toBeVisible();
    expect(screen.getByText('Giá phải là số nguyên từ 1 đến 100.000.000 VND.')).toBeVisible();
    expect(screen.getByLabelText('SKU 3')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('SKU 1')).not.toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps edited and added variants when the server rejects the save', async () => {
    const onSubmit = renderForm(vi.fn<(input: ProductUpdateInput) => Promise<void>>()
      .mockRejectedValue(new ApiError('CONFLICT', 'SKU, đường dẫn hoặc tổ hợp size/màu đã được sử dụng.', 409)));
    fireEvent.change(screen.getByLabelText('Giá 1 (VND)'), { target: { value: '199000' } });
    await userEvent.click(screen.getByRole('button', { name: 'Thêm biến thể' }));
    fireEvent.change(screen.getByLabelText('SKU 3'), { target: { value: 'COTTON-XL' } });
    fireEvent.change(screen.getByLabelText('Size 3'), { target: { value: 'XL' } });
    fireEvent.change(screen.getByLabelText('Màu 3'), { target: { value: 'đen' } });
    fireEvent.change(screen.getByLabelText('Giá 3 (VND)'), { target: { value: '270000' } });
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByText(/SKU hoặc tổ hợp size\/màu bị trùng/)).toBeVisible();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Giá 1 (VND)')).toHaveValue(199000);
    expect(screen.getByLabelText('SKU 3')).toHaveValue('COTTON-XL');
  });

  it('locks variant fields and actions while the page holds an operation', () => {
    render(<ProductEditForm product={product} categories={[category]} onSubmit={vi.fn()} disabled />);
    expect(screen.getByLabelText('SKU 1')).toBeDisabled();
    expect(screen.getByLabelText('Bật biến thể 1')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Thêm biến thể' })).toBeDisabled();
  });
});

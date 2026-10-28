import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../shared/api/client';
import type { Product } from '../api/products.api';
import { ProductStatusPanel, type StatusAction } from './ProductStatusPanel';

const ready: Product = { id: 'product-test', name: 'Áo cotton', slug: 'ao-cotton', description: '', categoryId: 'category-test',
  category: { id: 'category-test', name: 'Áo', slug: 'ao' }, priceFrom: 250000, status: 'DRAFT', version: 3,
  images: [{ id: 'asset-1', url: '/api/v1/admin/uploads/images/asset-1' }],
  variants: [{ id: 'variant-m', sku: 'COTTON-M', size: 'M', color: 'đen', price: 250000, active: true, available: 0 }] };

function renderPanel(options: { product?: Product; categoryActive?: boolean | undefined; unsaved?: boolean; disabled?: boolean } = {}) {
  const onChange = vi.fn<(action: StatusAction) => Promise<void>>().mockResolvedValue(undefined);
  render(<ProductStatusPanel product={options.product ?? ready} categoryActive={'categoryActive' in options ? options.categoryActive : true}
    unsaved={options.unsaved ?? false} disabled={options.disabled ?? false} onChange={onChange} />);
  return onChange;
}

describe('publish and hide a product', () => {
  it('publishes a ready draft and reports success', async () => {
    const onChange = renderPanel();
    expect(screen.getByText('Nháp')).toBeVisible();
    expect(screen.getAllByText('Đạt')).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'Xuất bản' }));
    expect(onChange).toHaveBeenCalledWith('publish');
    expect(await screen.findByRole('alert')).toHaveTextContent('Đã xuất bản sản phẩm.');
  });

  it('blocks publishing and names each unmet condition', () => {
    const variants = ready.variants.map((variant) => ({ ...variant, active: false }));
    renderPanel({ product: { ...ready, images: [], variants }, categoryActive: false });
    expect(screen.getAllByText('Chưa đạt')).toHaveLength(3);
    expect(screen.getByText('Danh mục đang bật')).toBeVisible();
    expect(screen.getByText('Có ít nhất 1 ảnh đã lưu')).toBeVisible();
    expect(screen.getByText('Có ít nhất 1 biến thể đang bật')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Xuất bản' })).toBeDisabled();
  });

  it('does not treat an unknown category state as ready', () => {
    renderPanel({ categoryActive: undefined });
    expect(screen.getByText('Chưa kiểm tra được danh mục')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Xuất bản' })).toBeDisabled();
  });

  it('blocks publishing while edits are unsaved, so publishing never drops them', () => {
    renderPanel({ unsaved: true });
    expect(screen.getByText('Lưu hoặc hủy các thay đổi đang nhập trước khi xuất bản.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Xuất bản' })).toBeDisabled();
  });

  it('hides a published product and republishes a hidden one', async () => {
    const onChange = renderPanel({ product: { ...ready, status: 'PUBLISHED' } });
    expect(screen.getByText('Đã xuất bản')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Xuất bản' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ẩn sản phẩm' }));
    expect(onChange).toHaveBeenCalledWith('hide');
    expect(await screen.findByRole('alert')).toHaveTextContent('Đã ẩn sản phẩm.');
  });

  it('offers Xuất bản again for a hidden product', () => {
    renderPanel({ product: { ...ready, status: 'HIDDEN' } });
    expect(screen.getByText('Đã ẩn')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Xuất bản' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Ẩn sản phẩm' })).not.toBeInTheDocument();
  });

  it('shows the server reason when the change is rejected and allows a retry', async () => {
    const onChange = renderPanel();
    onChange.mockRejectedValueOnce(new ApiError('CONFLICT', 'Cần danh mục bật, ít nhất một ảnh và một biến thể bật để xuất bản.', 409));
    await userEvent.click(screen.getByRole('button', { name: 'Xuất bản' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cần danh mục bật, ít nhất một ảnh');
    expect(screen.getByRole('button', { name: 'Xuất bản' })).toBeEnabled();
  });

  it('sends one request for a double click and locks while the page is busy', async () => {
    let finish: () => void = () => { throw new Error('Not started'); };
    const onChange = renderPanel();
    onChange.mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve(undefined); }));
    const button = screen.getByRole('button', { name: 'Xuất bản' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Đang xuất bản…' })).toBeDisabled();
    await act(async () => { finish(); });
  });

  it('locks actions while another page operation runs', () => {
    renderPanel({ disabled: true });
    expect(screen.getByRole('button', { name: 'Xuất bản' })).toBeDisabled();
  });
});

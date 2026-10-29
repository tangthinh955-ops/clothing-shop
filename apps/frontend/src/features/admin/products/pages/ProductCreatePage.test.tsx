import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogApi } from '../../../catalog/api/catalog.api';
import { App } from '../../../../app/App';
import { authApi, type User } from '../../../auth/api/auth.api';
import * as client from '../../../../shared/api/client';

const admin: User = { id: 'admin-product', email: 'product@example.test', name: 'Admin thử', role: 'ADMIN', emailVerified: true };
const category = { id: 'category-test', name: 'Áo', slug: 'ao', active: true, version: 0 };
const product = { id: 'product-test', name: 'Áo cotton', slug: 'ao-cotton', description: 'Cotton mềm', categoryId: category.id,
  category, priceFrom: 250000, status: 'DRAFT', version: 0, images: [],
  variants: [{ id: 'variant-test', sku: 'COTTON-M', size: 'M', color: 'đen', price: 250000, active: true, available: 0 }] };
afterEach(() => vi.restoreAllMocks());

function renderPage(user: User | null = admin) {
  // The store header loads category links on every page; these tests are not about them.
  vi.spyOn(catalogApi, 'categories').mockResolvedValue([]);
  vi.spyOn(authApi, 'me').mockResolvedValue(user);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={['/admin/products/new']}><App /></MemoryRouter>
  </QueryClientProvider>);
  return queryClient;
}

async function fillForm() {
  await screen.findByLabelText('Tên sản phẩm');
  // Bulk input keeps these form-flow tests fast; browser typing/native validation is covered by E2E.
  for (const [label, value] of [
    ['Tên sản phẩm', product.name], ['Đường dẫn sản phẩm', product.slug], ['Mô tả', product.description],
    ['SKU 1', 'cotton-m'], ['Màu 1', 'Đen'], ['Giá 1 (VND)', '250000'],
  ] as const) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  await userEvent.selectOptions(screen.getByLabelText('Size 1'), 'M');
}

describe('create a draft product with one variant', () => {
  it('loads categories, submits exactly one variant, and shows the persisted list', async () => {
    const request = vi.spyOn(client, 'request').mockResolvedValueOnce([category]).mockResolvedValueOnce(product)
      .mockResolvedValueOnce({ items: [product], total: 1, page: 1, pageSize: 24 });
    renderPage();
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Lưu sản phẩm' }));
    expect(await screen.findByText('Đã tạo sản phẩm nháp “Áo cotton”.')).toBeVisible();
    expect(await screen.findByRole('heading', { name: product.name })).toBeVisible();
    expect(screen.getByText('Nháp')).toBeVisible();
    expect(request).toHaveBeenCalledWith('/admin/products', { method: 'POST', body: {
      name: product.name, slug: product.slug, description: product.description, categoryId: category.id,
      variants: [{ sku: 'cotton-m', size: 'M', color: 'Đen', price: 250000, active: true }],
    } });
  });

  it('shows category loading and a link to create a category when none exist', async () => {
    let finish: (value: unknown) => void = () => { throw new Error('Query not started'); };
    vi.spyOn(client, 'request').mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    renderPage();
    expect(await screen.findByText('Đang tải danh mục…')).toBeVisible();
    await act(async () => { finish([]); });
    expect(await screen.findByText('Cần có danh mục trước khi tạo sản phẩm.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Quản lý danh mục' })).toHaveAttribute('href', '/admin/categories');
    expect(screen.queryByRole('button', { name: 'Lưu sản phẩm' })).not.toBeInTheDocument();
  });

  it('offers retry if loading categories fails', async () => {
    vi.spyOn(client, 'request').mockRejectedValueOnce(new client.ApiError('NETWORK_ERROR', 'Không thể tải danh mục.', 0))
      .mockResolvedValueOnce([category]);
    renderPage();
    expect(await screen.findByText('Không thể tải danh mục.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại danh mục' }));
    expect(await screen.findByLabelText('Tên sản phẩm')).toBeVisible();
  });

  it('preserves the draft when a background category refetch fails and recovers', async () => {
    vi.spyOn(client, 'request').mockResolvedValueOnce([category])
      .mockRejectedValueOnce(new client.ApiError('NETWORK_ERROR', 'Danh mục tạm thời mất kết nối.', 0))
      .mockResolvedValueOnce([category]);
    const queryClient = renderPage();
    await fillForm();
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ['admin-categories'] }); });
    expect(await screen.findByText('Danh mục tạm thời mất kết nối.')).toBeVisible();
    expect(screen.getByLabelText('Tên sản phẩm')).toHaveValue(product.name);
    expect(screen.getByLabelText('SKU 1')).toHaveValue('cotton-m');
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại danh mục' }));
    await waitFor(() => expect(screen.queryByText('Danh mục tạm thời mất kết nối.')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Tên sản phẩm')).toHaveValue(product.name);
  });

  it('retains all entered values after a conflict or nested validation error', async () => {
    vi.spyOn(client, 'request').mockResolvedValueOnce([category])
      .mockRejectedValueOnce(new client.ApiError('CONFLICT', 'SKU hoặc đường dẫn đã được sử dụng.', 409))
      .mockRejectedValueOnce(new client.ApiError('VALIDATION_ERROR', 'Thông tin chưa hợp lệ.', 400,
        [{ field: 'variants.0.sku', message: 'SKU không hợp lệ.' }]));
    renderPage();
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Lưu sản phẩm' }));
    expect(await screen.findByText('SKU hoặc đường dẫn đã được sử dụng.')).toBeVisible();
    expect(screen.getByLabelText('Tên sản phẩm')).toHaveValue(product.name);
    expect(screen.getByLabelText('SKU 1')).toHaveValue('cotton-m');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu sản phẩm' }));
    expect(await screen.findByText('SKU không hợp lệ.')).toBeVisible();
    expect(screen.getByLabelText('SKU 1')).toHaveAttribute('aria-invalid', 'true');
  });

  it('rejects non-integer VND values before making a create request', async () => {
    const request = vi.spyOn(client, 'request').mockResolvedValue([category]);
    renderPage();
    await fillForm();
    fireEvent.change(screen.getByLabelText('Giá 1 (VND)'), { target: { value: '1.5' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Tạo sản phẩm nháp' }));
    expect(await screen.findByText('Giá phải là số nguyên từ 1 đến 100.000.000 VND.')).toBeVisible();
    expect(request.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
  });

  it('blocks same-tick duplicate submits and preserves input after a network error', async () => {
    let fail: (error: Error) => void = () => { throw new Error('Request not started'); };
    const request = vi.spyOn(client, 'request').mockResolvedValueOnce([category])
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
    renderPage();
    await fillForm();
    const form = screen.getByRole('form', { name: 'Tạo sản phẩm nháp' });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(screen.getByRole('button', { name: 'Đang lưu…' })).toBeDisabled();
    expect(screen.getByLabelText('SKU 1')).toBeDisabled();
    await waitFor(() => expect(request.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1));
    await act(async () => { fail(new client.ApiError('NETWORK_ERROR', 'Không thể kết nối.', 0)); });
    expect(await screen.findByText('Không thể kết nối.')).toBeVisible();
    expect(screen.getByLabelText('Tên sản phẩm')).toHaveValue(product.name);
    expect(screen.getByRole('button', { name: 'Lưu sản phẩm' })).toBeEnabled();
  });

  it.each([null, { ...admin, role: 'CUSTOMER' } satisfies User])('does not expose creation to a guest/customer', async (user) => {
    const request = vi.spyOn(client, 'request');
    renderPage(user);
    expect(await screen.findByRole('heading', { name: user ? 'Tài khoản của bạn' : 'Chào bạn trở lại' })).toBeVisible();
    expect(request).not.toHaveBeenCalledWith('/admin/categories');
  });
});

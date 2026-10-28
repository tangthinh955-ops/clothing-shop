import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../../app/App';
import { authApi, type User } from '../../../auth/api/auth.api';
import * as client from '../../../../shared/api/client';

const admin: User = { id: 'admin-product', email: 'product@example.test', name: 'Admin thử', role: 'ADMIN', emailVerified: true };
const category = { id: 'category-test', name: 'Áo', slug: 'ao', active: true, version: 1 };
// Response mock keeps admin-only extras (inventory/available) to prove they are never sent back in the PATCH body.
const detail = { id: 'product-test', name: 'Áo cotton', slug: 'ao-cotton', description: 'Cotton mềm', categoryId: category.id,
  category: { id: category.id, name: 'Áo', slug: 'ao' }, priceFrom: 250000, status: 'DRAFT', version: 3, images: [],
  variants: [{ id: 'variant-test', sku: 'COTTON-M', size: 'M', color: 'đen', price: 250000, active: true, available: 0,
    inventory: { onHand: 0, reserved: 0 } }] };
const expectedPatchBody = { name: 'Áo cotton đã sửa', slug: 'ao-cotton', description: 'Mô tả mới', categoryId: category.id, expectedVersion: 3,
  variants: [{ id: 'variant-test', sku: 'COTTON-M', size: 'M', color: 'đen', price: 250000, active: true }] };

afterEach(() => vi.restoreAllMocks());

function stubApi() {
  const stubs: Record<string, unknown> = { categories: [category], detail, patch: { ...detail, version: 4 },
    list: { items: [], page: 1, pageSize: 24, total: 0 } };
  const spy = vi.spyOn(client, 'request').mockImplementation(async (path: string, options?: client.RequestOptions) => {
    const respond = (value: unknown) => { if (value instanceof Error) throw value; return value; };
    if (path === '/admin/categories') return respond(stubs.categories);
    if (path === '/admin/products/product-test' && options?.method === 'PATCH') return respond(stubs.patch);
    if (path === '/admin/products/product-test') return respond(stubs.detail);
    if (path.startsWith('/admin/products?page=')) return respond(stubs.list);
    throw new Error(`Unexpected request ${options?.method ?? 'GET'} ${path}`);
  });
  return { spy, stubs };
}

function renderPage(user: User | null = admin) {
  vi.spyOn(authApi, 'me').mockResolvedValue(user);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={['/admin/products/product-test']}><App /></MemoryRouter>
  </QueryClientProvider>);
  return queryClient;
}

describe('edit a draft product', () => {
  it('pre-fills saved data, keeps variants frozen, and sends only the update DTO with the captured version', async () => {
    const { spy, stubs } = stubApi();
    stubs.patch = { ...detail, name: 'Áo cotton đã sửa', version: 4 };
    stubs.list = { items: [stubs.patch], page: 1, pageSize: 24, total: 1 };
    renderPage();
    expect(await screen.findByLabelText('Tên sản phẩm')).toHaveValue('Áo cotton');
    expect(screen.getByLabelText('Đường dẫn sản phẩm')).toHaveValue('ao-cotton');
    expect(screen.getByLabelText('Danh mục')).toHaveValue(category.id);
    expect(screen.getByLabelText('Mô tả')).toHaveValue('Cotton mềm');
    expect(screen.getByText('COTTON-M')).toBeVisible();
    expect(screen.getByText(/M · đen/)).toBeVisible();
    expect(screen.getByText(/250\.000/)).toBeVisible();
    expect(screen.getByText('Phần này chưa cho sửa SKU, size, màu, giá hoặc thêm/tắt biến thể.')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Tên sản phẩm'), { target: { value: expectedPatchBody.name } });
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: expectedPatchBody.description } });
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByText('Đã cập nhật sản phẩm nháp “Áo cotton đã sửa”.')).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'Áo cotton đã sửa' })).toBeVisible();
    const patch = spy.mock.calls.find(([, options]) => options?.method === 'PATCH');
    expect(patch?.[0]).toBe('/admin/products/product-test');
    expect(patch?.[1]?.body).toEqual(expectedPatchBody);
  });

  it('keeps input on conflict and network errors and never blames the slug alone', async () => {
    const { stubs } = stubApi();
    renderPage();
    const name = await screen.findByLabelText('Tên sản phẩm');
    fireEvent.change(name, { target: { value: 'Tên đang nhập' } });
    stubs.patch = new client.ApiError('CONFLICT', 'Trùng đường dẫn sản phẩm.', 409);
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByText('Sản phẩm đã thay đổi hoặc đường dẫn sản phẩm bị trùng. Hãy tải dữ liệu mới, kiểm tra đường dẫn và thử lại.'))
      .toBeVisible();
    expect(screen.getByLabelText('Tên sản phẩm')).toHaveValue('Tên đang nhập');
    expect(screen.getByLabelText('Đường dẫn sản phẩm')).not.toHaveAttribute('aria-invalid', 'true');
    stubs.patch = new client.ApiError('NETWORK_ERROR', 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.', 0);
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByText('Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.')).toBeVisible();
    expect(screen.getByLabelText('Tên sản phẩm')).toHaveValue('Tên đang nhập');
  });

  it('blocks duplicate submits in the same tick and re-enables the form after failure', async () => {
    const { spy, stubs } = stubApi();
    renderPage();
    await screen.findByLabelText('Tên sản phẩm');
    let fail: (error: Error) => void = () => { throw new Error('Request not started'); };
    stubs.patch = new Promise((_resolve, reject) => { fail = reject; });
    const form = screen.getByRole('form', { name: 'Sửa sản phẩm nháp' });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(screen.getByRole('button', { name: 'Đang lưu…' })).toBeDisabled();
    expect(screen.getByLabelText('Tên sản phẩm')).toBeDisabled();
    await waitFor(() => expect(spy.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(1));
    await act(async () => { fail(new client.ApiError('NETWORK_ERROR', 'Không thể kết nối.', 0)); });
    expect(await screen.findByText('Không thể kết nối.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeEnabled();
    expect(screen.getByLabelText('Tên sản phẩm')).toHaveValue('Áo cotton');
  });

  it('locks saving and input until an explicit reload completes, then uses the reloaded version', async () => {
    const { spy, stubs } = stubApi();
    renderPage();
    fireEvent.change(await screen.findByLabelText('Tên sản phẩm'), { target: { value: 'Bản chưa lưu' } });
    let finishReload: (value: unknown) => void = () => { throw new Error('Reload not started'); };
    stubs.detail = new Promise((resolve) => { finishReload = resolve; });
    await userEvent.click(screen.getByRole('button', { name: 'Tải dữ liệu mới' }));
    expect(screen.getByLabelText('Tên sản phẩm')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tải dữ liệu mới' })).toBeDisabled();
    await act(async () => { fireEvent.submit(screen.getByRole('form', { name: 'Sửa sản phẩm nháp' })); });
    expect(spy.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(0);
    await act(async () => { finishReload({ ...detail, name: 'Bản tải mới', version: 9 }); });
    await waitFor(() => expect(screen.getByLabelText('Tên sản phẩm')).toHaveValue('Bản tải mới'));
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => {
      const patch = spy.mock.calls.find(([, options]) => options?.method === 'PATCH');
      expect(patch?.[1]?.body).toMatchObject({ name: 'Bản tải mới', expectedVersion: 9 });
    });
  });

  it('keeps reload and input locked through a pending save, even if cached detail updates', async () => {
    const { spy, stubs } = stubApi();
    const queryClient = renderPage();
    fireEvent.change(await screen.findByLabelText('Tên sản phẩm'), { target: { value: 'Bản đang lưu' } });
    let failSave: (error: Error) => void = () => { throw new Error('Save not started'); };
    stubs.patch = new Promise((_resolve, reject) => { failSave = reject; });
    await act(async () => { fireEvent.submit(screen.getByRole('form', { name: 'Sửa sản phẩm nháp' })); });
    await waitFor(() => expect(spy.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(1));
    expect(screen.getByRole('button', { name: 'Tải dữ liệu mới' })).toBeDisabled();
    const reads = spy.mock.calls.filter(([path, options]) => path === '/admin/products/product-test' && !options?.method).length;
    fireEvent.click(screen.getByRole('button', { name: 'Tải dữ liệu mới' }));
    await act(async () => { queryClient.setQueryData(['admin-products', 'detail', 'product-test'], { ...detail, name: 'Dữ liệu nền', version: 9 }); });
    expect(spy.mock.calls.filter(([path, options]) => path === '/admin/products/product-test' && !options?.method)).toHaveLength(reads);
    expect(screen.getByLabelText('Tên sản phẩm')).toHaveValue('Bản đang lưu');
    expect(screen.getByLabelText('Tên sản phẩm')).toBeDisabled();
    await act(async () => { failSave(new client.ApiError('NETWORK_ERROR', 'Lưu thất bại, hãy thử lại.', 0)); });
    expect(await screen.findByText('Lưu thất bại, hãy thử lại.')).toBeVisible();
    expect(screen.getByLabelText('Tên sản phẩm')).toHaveValue('Bản đang lưu');
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Tải dữ liệu mới' })).toBeEnabled();
  });

  it('does not rebase the captured version when a background refetch returns newer data', async () => {
    const { spy, stubs } = stubApi();
    const queryClient = renderPage();
    fireEvent.change(await screen.findByLabelText('Tên sản phẩm'), { target: { value: 'Bản đang nhập' } });
    stubs.detail = { ...detail, name: 'Bản mới trên server', version: 9 };
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ['admin-products'] }); });
    expect(screen.getByLabelText('Tên sản phẩm')).toHaveValue('Bản đang nhập');
    expect(screen.queryByText('Bản mới trên server')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => {
      const patch = spy.mock.calls.find(([, options]) => options?.method === 'PATCH');
      expect((patch?.[1]?.body as Record<string, unknown>)?.['expectedVersion']).toBe(3);
      expect((patch?.[1]?.body as Record<string, unknown>)?.['name']).toBe('Bản đang nhập');
    });
  });

  it('keeps the draft when a background category refetch fails and recovers', async () => {
    const { stubs } = stubApi();
    const queryClient = renderPage();
    await screen.findByLabelText('Tên sản phẩm');
    fireEvent.change(screen.getByLabelText('Tên sản phẩm'), { target: { value: 'Bản đang nhập' } });
    stubs.categories = new client.ApiError('NETWORK_ERROR', 'Danh mục tạm thời mất kết nối.', 0);
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ['admin-categories'] }); });
    expect(await screen.findByText('Danh mục tạm thời mất kết nối.')).toBeVisible();
    expect(screen.getByLabelText('Tên sản phẩm')).toHaveValue('Bản đang nhập');
    stubs.categories = [category];
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại danh mục' }));
    await waitFor(() => expect(screen.queryByText('Danh mục tạm thời mất kết nối.')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Tên sản phẩm')).toHaveValue('Bản đang nhập');
  });

  it('replaces the draft with the latest data only through Tải dữ liệu mới and saves with the new version', async () => {
    const { spy, stubs } = stubApi();
    renderPage();
    const name = await screen.findByLabelText('Tên sản phẩm');
    fireEvent.change(name, { target: { value: 'Chưa lưu' } });
    expect(spy.mock.calls.filter(([path, options]) => path === '/admin/products/product-test' && !options?.method)).toHaveLength(1);
    stubs.detail = { ...detail, name: 'Áo cotton bản mới', version: 9 };
    await userEvent.click(screen.getByRole('button', { name: 'Tải dữ liệu mới' }));
    await waitFor(() => expect(screen.getByLabelText('Tên sản phẩm')).toHaveValue('Áo cotton bản mới'));
    stubs.patch = { ...detail, version: 10 };
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => {
      const patch = spy.mock.calls.find(([, options]) => options?.method === 'PATCH');
      expect((patch?.[1]?.body as Record<string, unknown>)?.['expectedVersion']).toBe(9);
    });
  });

  it('keeps the draft when reloading the latest data fails', async () => {
    const { stubs } = stubApi();
    renderPage();
    const name = await screen.findByLabelText('Tên sản phẩm');
    fireEvent.change(name, { target: { value: 'Chưa lưu' } });
    stubs.detail = new client.ApiError('NETWORK_ERROR', 'Không thể kết nối.', 0);
    await userEvent.click(screen.getByRole('button', { name: 'Tải dữ liệu mới' }));
    expect(await screen.findByText('Không thể kết nối.')).toBeVisible();
    expect(screen.getByLabelText('Tên sản phẩm')).toHaveValue('Chưa lưu');
  });

  it('stops editing when the explicit reload finds the product is no longer a draft', async () => {
    const { stubs } = stubApi();
    renderPage();
    await screen.findByLabelText('Tên sản phẩm');
    stubs.detail = { ...detail, status: 'PUBLISHED' };
    await userEvent.click(screen.getByRole('button', { name: 'Tải dữ liệu mới' }));
    expect(await screen.findByText(/Chỉ sản phẩm nháp được sửa ở phần này/)).toBeVisible();
    expect(screen.queryByLabelText('Tên sản phẩm')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).not.toBeInTheDocument();
  });

  it('refuses editing for a product that is not a draft', async () => {
    const { spy, stubs } = stubApi();
    stubs.detail = { ...detail, status: 'PUBLISHED' };
    renderPage();
    expect(await screen.findByText(/Chỉ sản phẩm nháp được sửa ở phần này/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Tên sản phẩm')).not.toBeInTheDocument();
    expect(spy.mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(false);
  });

  it('offers retry when the product cannot be loaded', async () => {
    const { stubs } = stubApi();
    stubs.detail = new client.ApiError('NOT_FOUND', 'Không tìm thấy sản phẩm.', 404);
    renderPage();
    expect(await screen.findByText('Không tìm thấy sản phẩm.')).toBeVisible();
    stubs.detail = detail;
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại sản phẩm' }));
    expect(await screen.findByLabelText('Tên sản phẩm')).toHaveValue('Áo cotton');
  });

  it.each([null, { ...admin, role: 'CUSTOMER' } satisfies User])('does not expose editing to a guest/customer', async (user) => {
    const spy = vi.spyOn(client, 'request');
    renderPage(user);
    expect(await screen.findByRole('heading', { name: user ? 'Tài khoản của bạn' : 'Chào bạn trở lại' })).toBeVisible();
    expect(spy.mock.calls.filter(([path]) => path === '/admin/products/product-test')).toHaveLength(0);
  });
});

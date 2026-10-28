import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../../app/App';
import * as client from '../../../../shared/api/client';
import { authApi, type User } from '../../../auth/api/auth.api';

const admin: User = { id: 'inventory-admin', name: 'Admin', email: 'inventory@example.test', role: 'ADMIN', emailVerified: true };
const stock = { variantId: 'variant-one', sku: 'AO-M-DEN', size: 'M', color: 'đen', productName: 'Áo cotton',
  onHand: 12, reserved: 2, available: 10, version: 3 };
const result = { items: [stock], total: 1, page: 1, pageSize: 24 };

afterEach(() => vi.restoreAllMocks());

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  return <>
    <output data-testid="url">{location.pathname}{location.search}</output>
    <button onClick={() => { void navigate(-1); }}>Quay lại URL trước</button>
  </>;
}

function renderPage(path = '/admin/inventory', user: User | null = admin) {
  vi.spyOn(authApi, 'me').mockResolvedValue(user);
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={cache}>
    <MemoryRouter initialEntries={[path]}><Navigation /><App /></MemoryRouter>
  </QueryClientProvider>);
  return cache;
}

describe('admin inventory list', () => {
  it('shows server stock quantities and variant identity', async () => {
    const request = vi.spyOn(client, 'request').mockResolvedValue(result);
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Kho' })).toBeVisible();
    const row = await screen.findByRole('listitem', { name: stock.sku });
    for (const text of ['Áo cotton', 'M · đen', 'Tồn thực có', '12', 'Đang giữ', '2', 'Còn bán', '10']) {
      expect(within(row).getByText(text, { exact: true })).toBeVisible();
    }
    expect(request).toHaveBeenCalledWith('/admin/inventory?page=1&pageSize=24');
  });

  it('shows loading until the inventory response arrives', async () => {
    let finish: (value: typeof result) => void = () => { throw new Error('List not requested'); };
    vi.spyOn(client, 'request').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    renderPage();
    expect(await screen.findByText('Đang tải tồn kho…')).toHaveAttribute('role', 'status');
    await act(async () => { finish(result); });
    expect(await screen.findByRole('listitem', { name: stock.sku })).toBeVisible();
  });

  it('reads q/page from URL, encodes the search and preserves filters during pagination', async () => {
    const request = vi.spyOn(client, 'request').mockResolvedValue({ ...result, total: 49, page: 2 });
    renderPage('/admin/inventory?q=%C3%81o%20%26%20M&page=2&source=trial');
    expect(await screen.findByLabelText('Tìm theo SKU hoặc tên sản phẩm')).toHaveValue('Áo & M');
    await screen.findByRole('listitem', { name: stock.sku });
    expect(request).toHaveBeenCalledWith('/admin/inventory?q=%C3%81o+%26+M&page=2&pageSize=24');
    await userEvent.click(screen.getByRole('button', { name: 'Trang 3' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/inventory?q=%C3%81o+%26+M&page=3&pageSize=24'));
    expect(screen.getByTestId('url')).toHaveTextContent('source=trial');
    expect(screen.getByTestId('url')).toHaveTextContent('page=3');
  });

  it('searches only on submit, trims input, resets page and restores search on browser Back', async () => {
    const request = vi.spyOn(client, 'request').mockResolvedValue({ ...result, total: 49 });
    renderPage('/admin/inventory?q=old&page=2');
    const field = await screen.findByLabelText('Tìm theo SKU hoặc tên sản phẩm');
    await screen.findByRole('listitem', { name: stock.sku });
    await userEvent.clear(field);
    await userEvent.type(field, '  AO-M  ');
    expect(request).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/inventory?q=AO-M&page=1&pageSize=24'));
    expect(screen.getByLabelText('Tìm theo SKU hoặc tên sản phẩm')).toHaveValue('AO-M');
    await userEvent.click(screen.getByRole('button', { name: 'Quay lại URL trước' }));
    await waitFor(() => expect(screen.getByLabelText('Tìm theo SKU hoặc tên sản phẩm')).toHaveValue('old'));
    expect(screen.getByTestId('url')).toHaveTextContent('q=old&page=2');
  });

  it('clears search and returns to the first page', async () => {
    const request = vi.spyOn(client, 'request').mockResolvedValue(result);
    renderPage('/admin/inventory?q=missing&page=3');
    await screen.findByLabelText('Tìm theo SKU hoặc tên sản phẩm');
    await userEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/admin/inventory?page=1&pageSize=24'));
    expect(screen.getByLabelText('Tìm theo SKU hoặc tên sản phẩm')).toHaveValue('');
  });

  it.each([
    { path: '/admin/inventory', message: 'Chưa có SKU nào. Hãy tạo sản phẩm và biến thể trước.' },
    { path: '/admin/inventory?q=missing', message: 'Không có SKU khớp từ khóa tìm kiếm.' },
  ])('explains an empty list at $path', async ({ path, message }) => {
    vi.spyOn(client, 'request').mockResolvedValue({ ...result, items: [], total: 0 });
    renderPage(path);
    expect(await screen.findByText(message)).toBeVisible();
  });

  it('offers a first-page recovery for an empty page beyond existing results', async () => {
    const request = vi.spyOn(client, 'request').mockResolvedValueOnce({ ...result, items: [], total: 1, page: 5 })
      .mockResolvedValueOnce(result);
    renderPage('/admin/inventory?page=5');
    expect(await screen.findByText('Trang này không có SKU.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Về trang đầu' }));
    expect(await screen.findByRole('listitem', { name: stock.sku })).toBeVisible();
    expect(request).toHaveBeenLastCalledWith('/admin/inventory?page=1&pageSize=24');
  });

  it('displays a server error and supports explicit retry', async () => {
    vi.spyOn(client, 'request').mockRejectedValueOnce(new client.ApiError('NETWORK_ERROR', 'Mất kết nối kho.', 0))
      .mockResolvedValueOnce(result);
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Mất kết nối kho.');
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại tồn kho' }));
    expect(await screen.findByRole('listitem', { name: stock.sku })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps cached quantities visible when a background refresh fails', async () => {
    vi.spyOn(client, 'request').mockResolvedValueOnce(result)
      .mockRejectedValueOnce(new client.ApiError('NETWORK_ERROR', 'Không cập nhật được kho.', 0));
    const cache = renderPage();
    await screen.findByRole('listitem', { name: stock.sku });
    await act(async () => { await cache.invalidateQueries({ queryKey: ['admin-inventory'] }); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Không cập nhật được kho.');
    expect(screen.getByRole('listitem', { name: stock.sku })).toBeVisible();
  });

  it.each(['abc', '0', '-1', '1.5', '100001'])('does not request invalid page %s', async (page) => {
    const request = vi.spyOn(client, 'request').mockResolvedValue(result);
    renderPage(`/admin/inventory?page=${page}`);
    expect(await screen.findByRole('alert')).toHaveTextContent('Số trang không hợp lệ.');
    expect(request).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Về trang đầu' }));
    expect(await screen.findByRole('listitem', { name: stock.sku })).toBeVisible();
  });

  it('rejects an overlong URL search without sending it to the API', async () => {
    const request = vi.spyOn(client, 'request').mockResolvedValue(result);
    renderPage(`/admin/inventory?q=${'x'.repeat(81)}`);
    expect(await screen.findByRole('alert')).toHaveTextContent('Từ khóa tối đa 80 ký tự.');
    expect(request).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm' }));
    expect(await screen.findByRole('listitem', { name: stock.sku })).toBeVisible();
  });

  it('links inventory from the admin dashboard', async () => {
    vi.spyOn(client, 'request').mockResolvedValue({ allowed: true });
    renderPage('/admin');
    expect(await screen.findByRole('link', { name: 'Kho' })).toHaveAttribute('href', '/admin/inventory');
  });

  it.each([null, { ...admin, role: 'CUSTOMER' } satisfies User])('protects inventory for guests and customers', async (user) => {
    const request = vi.spyOn(client, 'request');
    renderPage('/admin/inventory', user);
    expect(await screen.findByRole('heading', { name: user ? 'Tài khoản của bạn' : 'Chào bạn trở lại' })).toBeVisible();
    expect(request).not.toHaveBeenCalled();
  });
});

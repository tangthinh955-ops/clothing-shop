import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../../app/App';
import * as client from '../../../../shared/api/client';
import { authApi, type User } from '../../../auth/api/auth.api';
import { catalogApi } from '../../../catalog/api/catalog.api';

const admin: User = { id: 'orders-admin', name: 'Admin', email: 'orders@example.test', role: 'ADMIN', emailVerified: true };
const customer: User = { ...admin, id: 'orders-customer', role: 'CUSTOMER' };
const order = {
  id: 'order-1', code: 'ABCD2345EFGH', status: 'PENDING', source: 'WEB', method: 'COD', totalVnd: 730000,
  recipientName: 'Nguyễn Thử', phone: '0901234567', itemCount: 3, createdAt: '2026-11-01T03:30:00.000Z',
};
const page = (items: unknown[], total = items.length, pageNumber = 1) => ({ items, total, page: pageNumber, pageSize: 20 });

afterEach(() => vi.restoreAllMocks());

function CurrentUrl() {
  return <output data-testid="url">{useLocation().search}</output>;
}

function renderPage(path: string, answer: () => Promise<unknown>, user: User | null = admin) {
  vi.spyOn(catalogApi, 'categories').mockResolvedValue([]);
  vi.spyOn(authApi, 'me').mockResolvedValue(user);
  const request = vi.spyOn(client, 'request').mockImplementation((url: string) => {
    if (url === '/admin/access') return Promise.resolve({ allowed: true });
    return answer();
  });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}><CurrentUrl /><App /></MemoryRouter>
  </QueryClientProvider>);
  return request;
}

describe('admin order list', () => {
  it('shows each order with delivery status, money, recipient and how it was placed', async () => {
    const request = renderPage('/admin/orders', () => Promise.resolve(page([order])));
    const row = await screen.findByRole('listitem', { name: order.code });
    expect(within(row).getByText('Chờ xác nhận')).toBeVisible();
    expect(within(row).getByText(/730\.000\s*₫/)).toBeVisible();
    expect(within(row).getByText(/Nguyễn Thử/)).toBeVisible();
    expect(within(row).getByText(/0901234567/)).toBeVisible();
    expect(within(row).getByText(/COD/)).toBeVisible();
    expect(within(row).getByText(/Website/)).toBeVisible();
    expect(within(row).getByText(/3 sản phẩm/)).toBeVisible();
    expect(screen.getByText('1 đơn hàng')).toHaveAttribute('role', 'status');
    expect(request).toHaveBeenCalledWith('/admin/orders?page=1&pageSize=20');
    expect(document.title).toBe('Đơn hàng | Quản trị | RMG Labels');
  });

  it('is reachable from the admin home page', async () => {
    renderPage('/admin', () => Promise.resolve(page([])));
    expect(await screen.findByRole('link', { name: 'Đơn hàng' })).toHaveAttribute('href', '/admin/orders');
  });

  it('restores filters from the URL and sends them to the API', async () => {
    const request = renderPage('/admin/orders?status=CONFIRMED&q=0901&page=2', () => Promise.resolve(page([order], 21, 2)));
    await screen.findByRole('listitem', { name: order.code });
    expect(request).toHaveBeenCalledWith('/admin/orders?status=CONFIRMED&q=0901&page=2&pageSize=20');
    expect(screen.getByLabelText('Trạng thái')).toHaveValue('CONFIRMED');
    expect(screen.getByLabelText('Tìm theo mã đơn, SĐT hoặc tên')).toHaveValue('0901');
  });

  it('changes the status filter on the URL and returns to the first page', async () => {
    const user = userEvent.setup();
    const request = renderPage('/admin/orders?page=2', () => Promise.resolve(page([order], 21, 2)));
    await screen.findByRole('listitem', { name: order.code });
    await user.selectOptions(screen.getByLabelText('Trạng thái'), 'CANCELLED');
    await waitFor(() => expect(request).toHaveBeenLastCalledWith('/admin/orders?status=CANCELLED&page=1&pageSize=20'));
    expect(screen.getByTestId('url')).toHaveTextContent('status=CANCELLED');
    expect(screen.getByTestId('url')).toHaveTextContent('page=1');
  });

  it('searches on submit with a trimmed term', async () => {
    const user = userEvent.setup();
    const request = renderPage('/admin/orders', () => Promise.resolve(page([order])));
    await screen.findByRole('listitem', { name: order.code });
    await user.type(screen.getByLabelText('Tìm theo mã đơn, SĐT hoặc tên'), '  abcd  {Enter}');
    await waitFor(() => expect(request).toHaveBeenLastCalledWith('/admin/orders?q=abcd&page=1&pageSize=20'));
  });

  it('pages through results and keeps the filters', async () => {
    const user = userEvent.setup();
    renderPage('/admin/orders?status=PENDING', () => Promise.resolve(page([order], 45)));
    await screen.findByRole('listitem', { name: order.code });
    await user.click(screen.getByRole('button', { name: 'Trang 2' }));
    expect(screen.getByTestId('url')).toHaveTextContent('status=PENDING');
    expect(screen.getByTestId('url')).toHaveTextContent('page=2');
  });

  it('tells an empty shop from an empty filter, and offers clearing only the filter', async () => {
    const user = userEvent.setup();
    renderPage('/admin/orders?status=DELIVERED', () => Promise.resolve(page([])));
    expect(await screen.findByText('Không có đơn phù hợp bộ lọc.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    expect(await screen.findByText('Chưa có đơn hàng nào.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Xóa lọc' })).not.toBeInTheDocument();
    expect(screen.getByTestId('url')).toHaveTextContent(/^$/);
  });

  it('explains a failed load and retries on request', async () => {
    const user = userEvent.setup();
    let calls = 0;
    renderPage('/admin/orders', () => {
      calls += 1;
      return calls === 1
        ? Promise.reject(new client.ApiError('SERVICE_UNAVAILABLE', 'Dịch vụ chưa sẵn sàng.', 503))
        : Promise.resolve(page([order]));
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Dịch vụ chưa sẵn sàng.');
    await user.click(screen.getByRole('button', { name: 'Tải lại đơn hàng' }));
    expect(await screen.findByRole('listitem', { name: order.code })).toBeVisible();
  });

  it.each([
    ['/admin/orders?status=PAID', 'Bộ lọc không hợp lệ.'],
    ['/admin/orders?page=abc', 'Bộ lọc không hợp lệ.'],
    [`/admin/orders?q=${'x'.repeat(81)}`, 'Bộ lọc không hợp lệ.'],
  ])('guards %s without calling the API', async (path, message) => {
    const user = userEvent.setup();
    const request = renderPage(path, () => Promise.resolve(page([order])));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(request).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    expect(await screen.findByRole('listitem', { name: order.code })).toBeVisible();
  });

  it('keeps a customer out of the page without loading any order', async () => {
    const request = renderPage('/admin/orders', () => Promise.resolve(page([order])), customer);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Đơn hàng', level: 1 })).not.toBeInTheDocument());
    expect(request).not.toHaveBeenCalledWith(expect.stringMatching(/^\/admin\/orders/));
  });
});

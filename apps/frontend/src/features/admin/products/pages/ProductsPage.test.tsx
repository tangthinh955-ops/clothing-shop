import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogApi } from '../../../catalog/api/catalog.api';
import { App } from '../../../../app/App';
import { authApi, type User } from '../../../auth/api/auth.api';
import * as client from '../../../../shared/api/client';

const admin: User = { id: 'list-admin', name: 'Admin', email: 'list@example.test', role: 'ADMIN', emailVerified: true };
const product = { id: 'list-product', name: 'Áo danh sách', slug: 'ao-danh-sach', description: '', categoryId: 'cat',
  category: { id: 'cat', name: 'Áo', slug: 'ao' }, priceFrom: 250000, status: 'DRAFT', version: 0, images: [],
  variants: [{ id: 'var', sku: 'LIST-M', size: 'M', color: 'đen', price: 250000, active: true, available: 0 }] };
afterEach(() => vi.restoreAllMocks());
function CurrentUrl() { return <output data-testid="url">{useLocation().search}</output>; }
function renderPage(path = '/admin/products', user: User | null = admin) {
  // The store header loads category links on every page; these tests are not about them.
  vi.spyOn(catalogApi, 'categories').mockResolvedValue([]);
  vi.spyOn(authApi, 'me').mockResolvedValue(user);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}><CurrentUrl /><App /></MemoryRouter>
  </QueryClientProvider>);
}

describe('admin product list', () => {
  it('shows empty state and a working creation link', async () => {
    vi.spyOn(client, 'request').mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 24 });
    renderPage();
    expect(await screen.findByText('Chưa có sản phẩm nào. Hãy tạo sản phẩm nháp đầu tiên.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Thêm sản phẩm' })).toHaveAttribute('href', '/admin/products/new');
  });

  it('reads pagination from the URL and preserves it when changing pages', async () => {
    const request = vi.spyOn(client, 'request').mockResolvedValue({ items: [product], total: 49, page: 2, pageSize: 24 });
    renderPage('/admin/products?page=2');
    expect(await screen.findByRole('heading', { name: product.name })).toBeVisible();
    expect(screen.getByText('LIST-M')).toBeVisible();
    expect(screen.getByText('Nháp')).toBeVisible();
    expect(request).toHaveBeenCalledWith('/admin/products?page=2&pageSize=24');
    await userEvent.click(screen.getByRole('button', { name: 'Trang 3' }));
    expect(screen.getByTestId('url')).toHaveTextContent('?page=3');
  });

  it('links editing only for draft products', async () => {
    const published = { ...product, id: 'published-list', name: 'Áo đã xuất bản', slug: 'ao-da-xuat-ban', status: 'PUBLISHED' };
    vi.spyOn(client, 'request').mockResolvedValue({ items: [product, published], total: 2, page: 1, pageSize: 24 });
    renderPage();
    expect(await screen.findByRole('link', { name: `Sửa ${product.name}` })).toHaveAttribute('href', '/admin/products/list-product');
    expect(screen.queryByRole('link', { name: `Sửa ${published.name}` })).not.toBeInTheDocument();
  });

  it('links status management for published and hidden products', async () => {
    const published = { ...product, id: 'published-list', name: 'Áo đã xuất bản', slug: 'ao-da-xuat-ban', status: 'PUBLISHED' };
    const hidden = { ...product, id: 'hidden-list', name: 'Áo đã ẩn', slug: 'ao-da-an', status: 'HIDDEN' };
    vi.spyOn(client, 'request').mockResolvedValue({ items: [product, published, hidden], total: 3, page: 1, pageSize: 24 });
    renderPage();
    expect(await screen.findByRole('link', { name: `Quản lý ${published.name}` })).toHaveAttribute('href', '/admin/products/published-list');
    expect(screen.getByRole('link', { name: `Quản lý ${hidden.name}` })).toHaveAttribute('href', '/admin/products/hidden-list');
    expect(screen.queryByRole('link', { name: `Quản lý ${product.name}` })).not.toBeInTheDocument();
  });

  it('offers retry after a failed list request', async () => {
    vi.spyOn(client, 'request').mockRejectedValueOnce(new client.ApiError('NETWORK_ERROR', 'Chưa tải được sản phẩm.', 0))
      .mockResolvedValueOnce({ items: [product], total: 1, page: 1, pageSize: 24 });
    renderPage();
    expect(await screen.findByText('Chưa tải được sản phẩm.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại sản phẩm' }));
    expect(await screen.findByRole('heading', { name: product.name })).toBeVisible();
  });

  it('rejects malformed page parameters without querying an invalid page', async () => {
    const request = vi.spyOn(client, 'request').mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 24 });
    renderPage('/admin/products?page=abc');
    expect(await screen.findByText('Số trang không hợp lệ.')).toBeVisible();
    expect(request).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Về trang đầu' }));
    await screen.findByText('Chưa có sản phẩm nào. Hãy tạo sản phẩm nháp đầu tiên.');
  });

  it.each([null, { ...admin, role: 'CUSTOMER' } satisfies User])('protects product listing for a guest/customer', async (user) => {
    const request = vi.spyOn(client, 'request');
    renderPage('/admin/products', user);
    expect(await screen.findByRole('heading', { name: user ? 'Tài khoản của bạn' : 'Chào bạn trở lại' })).toBeVisible();
    expect(request).not.toHaveBeenCalled();
  });
});

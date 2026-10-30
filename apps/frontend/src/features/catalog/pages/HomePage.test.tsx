import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../app/App';
import { ApiError } from '../../../shared/api/client';
import { authApi } from '../../auth/api/auth.api';
import { catalogApi, type CatalogCategory, type CatalogList, type CatalogProduct } from '../api/catalog.api';

const hoodies: CatalogCategory = { id: '3f0c4a52-8d2e-4b1f-9a6c-7e5d2b8c1a90', name: 'Áo hoodie', slug: 'ao-hoodie' };

function product(index: number, withImage = true): CatalogProduct {
  return {
    id: `p${index}`, name: `Sản phẩm ${index}`, slug: `san-pham-${index}`, description: '', categoryId: hoodies.id, category: hoodies,
    priceFrom: 300000, images: withImage ? [{ id: `i${index}`, url: `/api/v1/media/i${index}` }] : [],
    variants: [{ id: `v${index}`, sku: `SP-${index}`, size: 'M', color: 'đen', price: 300000, active: true, available: 2 }],
  };
}

function listOf(items: CatalogProduct[]): CatalogList {
  return { items, total: items.length, page: 1, pageSize: 12 };
}

afterEach(() => vi.restoreAllMocks());

function renderHome(list: () => Promise<CatalogList>) {
  vi.spyOn(authApi, 'me').mockResolvedValue(null);
  vi.spyOn(catalogApi, 'categories').mockResolvedValue([hoodies]);
  const request = vi.spyOn(catalogApi, 'list').mockImplementation(list);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/']}><App /></MemoryRouter>
  </QueryClientProvider>);
  return request;
}

describe('home page', () => {
  it('features the newest photographed product and leads into the collection', async () => {
    const request = renderHome(() => Promise.resolve(listOf([product(1, false), product(2), product(3)])));
    const hero = await screen.findByRole('region', { name: 'Bộ sưu tập mới' });
    expect(await within(hero).findByRole('img', { name: 'Sản phẩm 2' })).toHaveAttribute('src', '/api/v1/media/i2');
    expect(within(hero).getByRole('link', { name: 'Xem bộ sưu tập' })).toHaveAttribute('href', '/shop');
    expect(request).toHaveBeenCalledWith({ q: '', page: 1, sort: 'newest' });
    expect(document.title).toBe('RMG Labels');
  });

  it('links each active category to the filtered collection', async () => {
    renderHome(() => Promise.resolve(listOf([product(1)])));
    const strip = await screen.findByRole('navigation', { name: 'Danh mục nổi bật' });
    expect(await within(strip).findByRole('link', { name: 'Áo hoodie' })).toHaveAttribute('href', `/shop?categoryId=${hoodies.id}`);
  });

  it('shows at most eight new arrivals and a way to see everything', async () => {
    renderHome(() => Promise.resolve(listOf(Array.from({ length: 10 }, (_unused, index) => product(index + 1)))));
    const arrivals = await screen.findByRole('list', { name: 'Hàng mới về' });
    expect(within(arrivals).getAllByRole('listitem')).toHaveLength(8);
    expect(within(arrivals).getByRole('link', { name: 'Sản phẩm 1' })).toHaveAttribute('href', '/products/san-pham-1');
    expect(screen.getByRole('link', { name: 'Xem tất cả sản phẩm' })).toHaveAttribute('href', '/shop');
  });

  it('keeps a text-only banner and points to Instagram while nothing is on sale', async () => {
    renderHome(() => Promise.resolve(listOf([])));
    const hero = await screen.findByRole('region', { name: 'Bộ sưu tập mới' });
    expect(await screen.findByText(/Shop đang chuẩn bị hàng mới/)).toBeVisible();
    expect(within(hero).queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Theo dõi @rmglabels' })).toHaveAttribute('href', 'https://www.instagram.com/rmglabels/');
  });

  it('explains a failed load and retries on request', async () => {
    const user = userEvent.setup();
    const request = renderHome(() => Promise.reject(new ApiError('NETWORK_ERROR', 'Mất kết nối tới máy chủ.', 0)));
    expect(await screen.findByRole('alert')).toHaveTextContent('Mất kết nối tới máy chủ.');
    request.mockResolvedValue(listOf([product(1)]));
    await user.click(screen.getByRole('button', { name: 'Tải lại' }));
    expect(await screen.findByRole('list', { name: 'Hàng mới về' })).toBeVisible();
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../app/App';
import * as client from '../../../shared/api/client';
import { authApi, type User } from '../../auth/api/auth.api';

const categoryId = 'b2b6d857-58b7-4c07-9d88-b33d3a2469dd';
const admin: User = { id: 'catalog-admin', name: 'Admin', email: 'catalog@example.test', role: 'ADMIN', emailVerified: true };
const variantS = { id: 'v1', sku: 'AO-1-S', size: 'S', color: 'trắng', price: 200000, active: true, available: 3 };
const variantM = { id: 'v2', sku: 'AO-1-M', size: 'M', color: 'đen', price: 250000, active: true, available: 10 };
const product = {
  id: 'p1', name: 'Áo cotton hanh phúc', slug: 'ao-cotton-hanh-phuc', description: 'Áo cotton co giãn, dễ mặc hàng ngày.',
  categoryId, category: { id: categoryId, name: 'Áo thun', slug: 'ao-thun' }, priceFrom: 200000,
  images: [{ id: 'img1', url: '/api/v1/media/asset-1' }, { id: 'img2', url: '/api/v1/media/asset-2' }],
  variants: [variantS, variantM],
};

afterEach(() => vi.restoreAllMocks());

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  return <>
    <output data-testid="url">{location.pathname}{location.search}</output>
    <button onClick={() => { void navigate(-1); }}>Quay lại URL trước</button>
  </>;
}

function renderDetail(path = `/products/${product.slug}`,
  products: (url: string) => Promise<unknown> = () => Promise.resolve(product),
  user: User | null = admin) {
  vi.spyOn(authApi, 'me').mockResolvedValue(user);
  const request = vi.spyOn(client, 'request').mockImplementation(async (path: string) => {
    if (path.startsWith('/products/')) return products(path);
    throw new Error(`Unexpected request: ${path}`);
  });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}><Navigation /><App /></MemoryRouter>
  </QueryClientProvider>);
  return request;
}

describe('public product detail page', () => {
  it('loads one published product by slug with name, breadcrumb, description and starting price', async () => {
    const request = renderDetail();
    expect(await screen.findByRole('heading', { name: product.name })).toBeVisible();
    expect(request).toHaveBeenCalledWith(`/products/${product.slug}`);
    const breadcrumbs = within(screen.getByRole('navigation', { name: 'Breadcrumb sản phẩm' }));
    expect(breadcrumbs.getByRole('link', { name: 'Bộ sưu tập' })).toHaveAttribute('href', '/shop');
    expect(breadcrumbs.getByRole('link', { name: 'Áo thun' })).toHaveAttribute('href', `/shop?categoryId=${categoryId}`);
    expect(screen.getByText('Áo cotton co giãn, dễ mặc hàng ngày.')).toBeVisible();
    expect(screen.getByText(/Giá từ 200\.000\s*₫/)).toBeVisible();
    expect(screen.queryByText(/Còn .* sản phẩm/)).not.toBeInTheDocument();
  });

  it('shows the main image and switches it when another thumbnail is chosen', async () => {
    renderDetail();
    const main = await screen.findByAltText(`Ảnh của ${product.name}`);
    expect(main).toHaveAttribute('src', '/api/v1/media/asset-1');
    await userEvent.click(screen.getByRole('button', { name: 'Xem ảnh 2' }));
    expect(main).toHaveAttribute('src', '/api/v1/media/asset-2');
    expect(screen.getByRole('button', { name: 'Xem ảnh 1' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Xem ảnh 2' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the variant group visible with every selectable size and colour', async () => {
    renderDetail();
    const group = await screen.findByRole('group', { name: 'Chọn biến thể' });
    expect(group).toHaveTextContent('S · trắng');
    expect(group).toHaveTextContent('M · đen');
    expect(screen.queryByRole('button', { name: 'M · đen' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('updates price and stock after choosing a variant', async () => {
    renderDetail();
    await screen.findByRole('heading', { name: product.name });
    await userEvent.click(screen.getByRole('button', { name: 'M · đen' }));
    expect(await screen.findByText('Còn 10 sản phẩm', { exact: true })).toBeVisible();
    expect(screen.getByText(/250\.000\s*₫/)).toBeVisible();
    expect(screen.queryByText(/Giá từ/)).not.toBeInTheDocument();
  });

  it('switches to another variant and shows that variant stock and price', async () => {
    renderDetail();
    await screen.findByRole('button', { name: 'M · đen' });
    await userEvent.click(screen.getByRole('button', { name: 'M · đen' }));
    await screen.findByText('Còn 10 sản phẩm', { exact: true });
    await userEvent.click(screen.getByRole('button', { name: 'S · trắng' }));
    expect(await screen.findByText('Còn 3 sản phẩm', { exact: true })).toBeVisible();
    expect(screen.getByText(/200\.000\s*₫/)).toBeVisible();
    expect(screen.queryByText(/250\.000\s*₫/)).not.toBeInTheDocument();
  });

  it('reports a selected variant with no stock as out of stock', async () => {
    renderDetail('/products/ao-cotton-hanh-phuc', () => Promise.resolve({
      ...product, variants: [{ ...variantS, available: 0 }], priceFrom: variantS.price,
    }));
    await screen.findByRole('button', { name: 'S · trắng' });
    await userEvent.click(screen.getByRole('button', { name: 'S · trắng' }));
    expect(await screen.findByText('Hết hàng', { exact: true })).toBeVisible();
    expect(screen.queryByText(/Giá từ/)).not.toBeInTheDocument();
  });

  it('shows a placeholder when the product has no image', async () => {
    renderDetail('/products/ao-cotton-hanh-phuc', () => Promise.resolve({ ...product, images: [] }));
    expect(await screen.findByText('Chưa có ảnh')).toBeVisible();
  });

  it('explains a missing or hidden product and offers a way back to the shop', async () => {
    renderDetail('/products/ao-an-di', () => Promise.reject(new client.ApiError('NOT_FOUND', 'Không tìm thấy sản phẩm.', 404)));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Không tìm thấy sản phẩm\./);
    expect(screen.queryByRole('button', { name: 'Tải lại sản phẩm' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Quay lại bộ sưu tập' }));
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/shop'));
  });

  it('recovers after a failed request when retried', async () => {
    let attempts = 0;
    renderDetail('/products/ao-cotton-hanh-phuc', () => {
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new client.ApiError('NETWORK_ERROR', 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.', 0))
        : Promise.resolve(product);
    });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Không thể kết nối/);
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại sản phẩm' }));
    expect(await screen.findByRole('heading', { name: product.name })).toBeVisible();
    expect(attempts).toBe(2);
  });

  it('keeps the loading status until the detail response arrives', async () => {
    let finish: (value: typeof product) => void = () => undefined;
    vi.spyOn(authApi, 'me').mockResolvedValue(admin);
    vi.spyOn(client, 'request').mockImplementation(async (path: string) => {
      if (path.startsWith('/products/')) return new Promise<typeof product>((resolve) => { finish = resolve; });
      throw new Error(`Unexpected request: ${path}`);
    });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/products/ao-cotton-hanh-phuc']}><App /></MemoryRouter>
    </QueryClientProvider>);
    expect(await screen.findByText('Đang tải sản phẩm…')).toHaveAttribute('role', 'status');
    await act(async () => { finish(product); });
    expect(await screen.findByRole('heading', { name: product.name })).toBeVisible();
  });
});

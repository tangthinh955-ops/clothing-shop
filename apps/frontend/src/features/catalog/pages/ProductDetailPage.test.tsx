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
    expect(await screen.findByRole('heading', { name: product.name, level: 1 })).toBeVisible();
    expect(request).toHaveBeenCalledWith(`/products/${product.slug}`);
    const breadcrumbs = within(screen.getByRole('navigation', { name: 'Breadcrumb sản phẩm' }));
    expect(breadcrumbs.getByRole('link', { name: 'Tất cả sản phẩm' })).toHaveAttribute('href', '/shop');
    expect(breadcrumbs.getByRole('link', { name: 'Áo thun' })).toHaveAttribute('href', `/shop?categoryId=${categoryId}`);
    expect(screen.getByText('Áo cotton co giãn, dễ mặc hàng ngày.')).toBeVisible();
    expect(screen.getByText(/^Từ 200\.000\s*₫$/)).toBeVisible();
    expect(screen.queryByText(/Còn .* sản phẩm/)).not.toBeInTheDocument();
  });

  it('shows every photo, numbered, without a separate thumbnail strip', async () => {
    renderDetail();
    expect(await screen.findByAltText(`Ảnh 1 của ${product.name}`)).toHaveAttribute('src', '/api/v1/media/asset-1');
    expect(screen.getByAltText(`Ảnh 2 của ${product.name}`)).toHaveAttribute('src', '/api/v1/media/asset-2');
    expect(screen.queryByRole('button', { name: /Xem ảnh/ })).not.toBeInTheDocument();
  });

  it('preselects the first colour and lists only the sizes made in that colour', async () => {
    const user = userEvent.setup();
    renderDetail();
    const colours = await screen.findByRole('group', { name: 'Chọn màu' });
    const sizes = screen.getByRole('group', { name: 'Chọn size' });
    expect(within(colours).getByRole('button', { name: 'trắng' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(colours).getByRole('button', { name: 'đen' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(sizes).getAllByRole('button').map((button) => button.textContent)).toEqual(['S']);
    await user.click(within(colours).getByRole('button', { name: 'đen' }));
    expect(within(sizes).getAllByRole('button').map((button) => button.textContent)).toEqual(['M']);
    expect(screen.getByText('Màu: đen')).toBeVisible();
  });

  it('shows the exact price, stock and SKU once a colour and size are chosen', async () => {
    const user = userEvent.setup();
    renderDetail();
    await user.click(await screen.findByRole('button', { name: 'đen' }));
    await user.click(screen.getByRole('button', { name: 'M' }));
    expect(screen.getByRole('button', { name: 'M' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText('Còn 10 sản phẩm', { exact: true })).toBeVisible();
    expect(screen.getByText(/^250\.000\s*₫$/)).toBeVisible();
    expect(screen.queryByText(/^Từ /)).not.toBeInTheDocument();
    expect(screen.getByText('Mã sản phẩm: AO-1-M')).toBeVisible();
  });

  it('clears the size when the colour changes so stock never belongs to the wrong variant', async () => {
    const user = userEvent.setup();
    renderDetail();
    await user.click(await screen.findByRole('button', { name: 'đen' }));
    await user.click(screen.getByRole('button', { name: 'M' }));
    await screen.findByText('Còn 10 sản phẩm', { exact: true });
    await user.click(screen.getByRole('button', { name: 'trắng' }));
    expect(screen.queryByText(/Còn .* sản phẩm/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mã sản phẩm/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'S' }));
    expect(await screen.findByText('Còn 3 sản phẩm', { exact: true })).toBeVisible();
    expect(screen.getByText(/^200\.000\s*₫$/)).toBeVisible();
  });

  it('marks a sold-out size and reports it as out of stock when chosen', async () => {
    const user = userEvent.setup();
    renderDetail('/products/ao-cotton-hanh-phuc', () => Promise.resolve({
      ...product, variants: [{ ...variantS, available: 0 }], priceFrom: variantS.price,
    }));
    await user.click(await screen.findByRole('button', { name: 'S, hết hàng' }));
    expect(await screen.findByText('Hết hàng', { exact: true })).toBeVisible();
    expect(screen.queryByText(/^Từ /)).not.toBeInTheDocument();
  });

  it('lets the shopper order by messaging the shop on Instagram', async () => {
    renderDetail();
    const order = await screen.findByRole('link', { name: 'Nhắn shop qua Instagram để đặt' });
    expect(order).toHaveAttribute('href', 'https://www.instagram.com/rmglabels/');
    expect(order).toHaveAttribute('target', '_blank');
    expect(order).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Bảng size' })).toHaveAttribute('href', '/size-guide');
  });

  it('folds the real shipping and returns policies into the page', async () => {
    const user = userEvent.setup();
    renderDetail();
    const shipping = await screen.findByRole('button', { name: 'Giao hàng' });
    expect(shipping).toHaveAttribute('aria-expanded', 'false');
    await user.click(shipping);
    expect(shipping).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/30\.000đ mỗi đơn/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Xem chính sách Giao hàng' })).toHaveAttribute('href', '/shipping');
    await user.click(screen.getByRole('button', { name: 'Đổi & trả' }));
    expect(screen.getByText(/trong 7 ngày/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Xem chính sách Đổi & trả' })).toHaveAttribute('href', '/returns-policy');
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

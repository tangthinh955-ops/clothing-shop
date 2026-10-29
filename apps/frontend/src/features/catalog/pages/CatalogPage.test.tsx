import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../app/App';
import * as client from '../../../shared/api/client';
import { authApi, type User } from '../../auth/api/auth.api';

const categoryIdFixture = 'b2b6d857-58b7-4c07-9d88-b33d3a2469dd';
const categoryIdSecond = '5e59e9f0-9e34-4a90-b6b2-a91a25f3d1c9';
const admin: User = { id: 'catalog-admin', name: 'Admin', email: 'catalog@example.test', role: 'ADMIN', emailVerified: true };
const product = { id: 'p1', name: 'Áo cotton hanh phúc', slug: 'ao-cotton-hanh-phuc', description: '', categoryId: categoryIdFixture,
  category: { id: categoryIdFixture, name: 'Áo thun', slug: 'ao-thun' }, priceFrom: 250000,
  images: [{ id: 'img1', url: '/api/v1/media/asset-1' }],
  variants: [{ id: 'v1', sku: 'AO-1', size: 'M', color: 'đen', price: 250000, active: true, available: 5 }] };
const list = { items: [product], total: 1, page: 1, pageSize: 12 };
const categories = [{ id: categoryIdFixture, name: 'Áo thun', slug: 'ao-thun' },
  { id: categoryIdSecond, name: 'Quần jean', slug: 'quan-jean' }];

afterEach(() => vi.restoreAllMocks());

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  return <>
    <output data-testid="url">{location.pathname}{location.search}</output>
    <button onClick={() => { void navigate(-1); }}>Quay lại URL trước</button>
  </>;
}

function renderCatalog(path = '/shop', user: User | null = admin,
  products: (url: string) => Promise<unknown> = () => Promise.resolve(list)) {
  vi.spyOn(authApi, 'me').mockResolvedValue(user);
  const request = vi.spyOn(client, 'request').mockImplementation(async (path: string) => {
    if (path.startsWith('/products')) return products(path);
    if (path.startsWith('/categories')) return categories;
    throw new Error(`Unexpected request: ${path}`);
  });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}><Navigation /><App /></MemoryRouter>
  </QueryClientProvider>);
  return request;
}

function productCalls(request: ReturnType<typeof renderCatalog>) {
  return request.mock.calls.map((call) => String(call[0])).filter((url) => url.startsWith('/products'));
}

describe('public shop catalog', () => {
  it('lists published products with name link, category, price and cover image', async () => {
    const request = renderCatalog();
    expect(await screen.findByRole('heading', { name: 'Bộ sưu tập' })).toBeVisible();
    const card = await screen.findByRole('listitem', { name: product.name });
    expect(within(card).getByRole('link', { name: product.name })).toHaveAttribute('href', `/products/${product.slug}`);
    expect(within(card).getByText('Áo thun')).toBeVisible();
    expect(within(card).getByText(/Giá từ 250\.000\s*₫/)).toBeVisible();
    expect(within(card).getByAltText(`Ảnh của ${product.name}`)).toHaveAttribute('src', '/api/v1/media/asset-1');
    expect(screen.getByText('Tìm thấy 1 sản phẩm.')).toBeVisible();
    expect(request).toHaveBeenCalledWith('/products?page=1&pageSize=12');
    expect(request).toHaveBeenCalledWith('/categories');
  });

  it('shows a placeholder when a product has no image', async () => {
    renderCatalog('/shop', admin, () => Promise.resolve({ ...list, items: [{ ...product, images: [] }] }));
    expect(await screen.findByText('Chưa có ảnh')).toBeVisible();
  });

  it('keeps the loading status until the catalog response arrives', async () => {
    let finish: (value: typeof list) => void = () => { throw new Error('List not requested'); };
    vi.spyOn(authApi, 'me').mockResolvedValue(admin);
    vi.spyOn(client, 'request').mockImplementation(async (path: string) => {
      if (path.startsWith('/products')) return new Promise<typeof list>((resolve) => { finish = resolve; });
      if (path.startsWith('/categories')) return categories;
      throw new Error(`Unexpected request: ${path}`);
    });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/shop']}><App /></MemoryRouter>
    </QueryClientProvider>);
    expect(await screen.findByText('Đang tải bộ sưu tập…')).toHaveAttribute('role', 'status');
    await act(async () => { finish(list); });
    expect(await screen.findByRole('listitem', { name: product.name })).toBeVisible();
  });

  it('searches on submit, trims input, resets the page and restores on Back', async () => {
    const request = renderCatalog('/shop?q=c%C5%A9&page=2');
    const field = await screen.findByLabelText('Tìm theo tên hoặc SKU');
    await screen.findByRole('listitem', { name: product.name });
    expect(productCalls(request)).toHaveLength(1);
    await userEvent.clear(field);
    await userEvent.type(field, '  Áo & M  ');
    expect(productCalls(request)).toHaveLength(1);
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(request).toHaveBeenLastCalledWith('/products?q=%C3%81o+%26+M&page=1&pageSize=12'));
    expect(screen.getByTestId('url')).toHaveTextContent('page=1');
    await userEvent.click(screen.getByRole('button', { name: 'Quay lại URL trước' }));
    await waitFor(() => expect(screen.getByLabelText('Tìm theo tên hoặc SKU')).toHaveValue('cũ'));
    expect(screen.getByTestId('url')).toHaveTextContent('q=c%C5%A9&page=2');
  });

  it('changes the sort order and reports it on the URL', async () => {
    const request = renderCatalog();
    await screen.findByRole('listitem', { name: product.name });
    await userEvent.selectOptions(screen.getByLabelText('Thứ tự sắp xếp'), 'price-desc');
    await waitFor(() => expect(request).toHaveBeenLastCalledWith('/products?sort=price-desc&page=1&pageSize=12'));
    expect(screen.getByTestId('url')).toHaveTextContent('sort=price-desc');
  });

  it('filters by a category from the public category list', async () => {
    const request = renderCatalog();
    const selector = await screen.findByLabelText('Danh mục');
    await screen.findByRole('listitem', { name: product.name });
    await userEvent.selectOptions(selector, categoryIdSecond);
    await waitFor(() => expect(request).toHaveBeenLastCalledWith(`/products?categoryId=${categoryIdSecond}&page=1&pageSize=12`));
    expect(screen.getByTestId('url')).toHaveTextContent(`categoryId=${categoryIdSecond}`);
    expect(within(selector).getByRole('option', { name: 'Quần jean' })).toBeInTheDocument();
    expect(within(selector).getByRole('option', { name: 'Tất cả danh mục' })).toBeInTheDocument();
  });

  it('paginates through the URL and keeps the search term', async () => {
    const request = renderCatalog('/shop?q=ao&page=1', admin, (url) => Promise.resolve({
      ...list, page: Number(new URLSearchParams(url.split('?')[1] ?? '').get('page') ?? '1'), total: 49,
    }));
    await screen.findByRole('listitem', { name: product.name });
    await userEvent.click(screen.getByRole('button', { name: 'Trang 2' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/products?q=ao&page=2&pageSize=12'));
    expect(screen.getByTestId('url')).toHaveTextContent('q=ao');
    expect(screen.getByTestId('url')).toHaveTextContent('page=2');
  });

  it('reads every filter from the URL on first paint', async () => {
    const request = renderCatalog(`/shop?q=gi%E1%BA%A3&sort=price-asc&categoryId=${categoryIdFixture}&page=3`);
    await screen.findByRole('listitem', { name: product.name });
    expect(request).toHaveBeenCalledWith(`/products?categoryId=${categoryIdFixture}&q=gi%E1%BA%A3&sort=price-asc&page=3&pageSize=12`);
    expect(screen.getByLabelText('Tìm theo tên hoặc SKU')).toHaveValue('giả');
    expect(screen.getByLabelText('Thứ tự sắp xếp')).toHaveValue('price-asc');
    expect(screen.getByLabelText('Danh mục')).toHaveValue(categoryIdFixture);
  });

  it('says a category is no longer shown instead of pretending to list every category', async () => {
    const hiddenCategory = '0d6a3c1e-7f43-4c5b-9a1d-2b8e6f4c9a70';
    renderCatalog(`/shop?categoryId=${hiddenCategory}`, admin, () => Promise.resolve({ ...list, items: [], total: 0 }));
    expect(await screen.findByText('Danh mục này không còn hiển thị.')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Danh mục' })).toHaveDisplayValue('Danh mục không còn hiển thị');
    expect(screen.queryByText('Chưa có sản phẩm phù hợp bộ lọc hiện tại.')).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Xóa lọc' })[0]!); // at least one clear action is rendered
    expect(screen.getByTestId('url')).toHaveTextContent(/^\/shop$/);
    expect(screen.queryByText('Danh mục này không còn hiển thị.')).not.toBeInTheDocument();
  });

  it('keeps the current cards on screen while the next page loads', async () => {
    let finish: (value: unknown) => void = () => { throw new Error('Page 2 not requested'); };
    renderCatalog('/shop', admin, (url) => url.includes('page=2')
      ? new Promise((resolve) => { finish = resolve; })
      : Promise.resolve({ ...list, total: 30 }));
    await screen.findByRole('listitem', { name: product.name });
    await userEvent.click(screen.getByRole('button', { name: 'Trang 2' }));
    expect(screen.getByText('Đang cập nhật bộ sưu tập…')).toBeVisible();
    expect(screen.getByRole('listitem', { name: product.name })).toBeVisible();
    expect(screen.queryByText('Đang tải bộ sưu tập…')).not.toBeInTheDocument();
    const next = { ...product, id: 'p2', name: 'Quần trang hai', slug: 'quan-trang-hai' };
    await act(async () => finish({ ...list, items: [next], total: 30, page: 2 }));
    expect(await screen.findByRole('listitem', { name: next.name })).toBeVisible();
    expect(screen.queryByRole('listitem', { name: product.name })).not.toBeInTheDocument();
  });

  it('explains an empty filtered list and offers clearing the filters', async () => {
    const request = renderCatalog('/shop?q=không', admin, () => Promise.resolve({ ...list, items: [], total: 0 }));
    expect(await screen.findByText('Chưa có sản phẩm phù hợp bộ lọc hiện tại.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    expect(await screen.findByText('Chưa có sản phẩm nào. Hãy quay lại sau.')).toBeVisible();
    expect(request).toHaveBeenLastCalledWith('/products?page=1&pageSize=12');
    expect(screen.getByTestId('url')).toHaveTextContent('/shop');
  });

  it('explains an entirely empty catalog without a clear-filters action', async () => {
    renderCatalog('/shop', admin, () => Promise.resolve({ ...list, items: [], total: 0 }));
    expect(await screen.findByText('Chưa có sản phẩm nào. Hãy quay lại sau.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Xóa lọc' })).not.toBeInTheDocument();
  });

  it('displays a catalog error and supports explicit retry', async () => {
    let calls = 0;
    const request = renderCatalog('/shop', admin, () => {
      calls += 1;
      return calls === 1
        ? Promise.reject(new client.ApiError('SERVICE_UNAVAILABLE', 'Dịch vụ chưa sẵn sàng. Vui lòng thử lại sau ít phút.', 503))
        : Promise.resolve(list);
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Dịch vụ chưa sẵn sàng.');
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại bộ sưu tập' }));
    expect(await screen.findByRole('listitem', { name: product.name })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    { path: '/shop?page=abc', message: 'Số trang không hợp lệ.', action: 'Về trang đầu' },
    { path: '/shop?sort=price', message: 'Bộ lọc không hợp lệ.', action: 'Xóa lọc' },
    { path: '/shop?categoryId=not-a-uuid', message: 'Bộ lọc không hợp lệ.', action: 'Xóa lọc' },
    { path: `/shop?q=${'x'.repeat(81)}`, message: 'Từ khóa tối đa 80 ký tự.', action: 'Xóa tìm kiếm' },
  ])('guards $message from $path without calling the API', async ({ path, message, action }) => {
    const request = renderCatalog(path);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(request).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: action }));
    expect(await screen.findByRole('listitem', { name: product.name })).toBeVisible();
  });
});

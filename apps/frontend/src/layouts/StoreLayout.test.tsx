import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import { authApi, type User } from '../features/auth/api/auth.api';
import { catalogApi, type CatalogCategory } from '../features/catalog/api/catalog.api';

const admin: User = { id: 'store-admin', name: 'Admin', email: 'store@example.test', role: 'ADMIN', emailVerified: true };
const tees: CatalogCategory = { id: '0b6f2d7e-3c1a-4e8b-9f5d-2a7c9e1b4d60', name: 'Áo thun', slug: 'ao-thun' };

afterEach(() => vi.restoreAllMocks());

function renderStore(path: string, user: User | null, categories: CatalogCategory[] = []) {
  vi.spyOn(authApi, 'me').mockResolvedValue(user);
  vi.spyOn(catalogApi, 'categories').mockResolvedValue(categories);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}><App /></MemoryRouter>
  </QueryClientProvider>);
}

describe('store layout of the real shop', () => {
  it('shows the shop name and seller details with no demo wording or customer sign-in link', async () => {
    renderStore('/shipping', null);
    expect(await screen.findByRole('link', { name: 'RMG LABELS' })).toHaveAttribute('href', '/');
    expect(document.body.textContent).not.toMatch(/demo|dữ liệu giả|giả định/i);
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByText(/Cá nhân kinh doanh/)).toBeVisible();
    expect(within(footer).getByText(/TP\. Hồ Chí Minh/)).toBeVisible();
    expect(within(footer).getByRole('link', { name: 'Instagram @rmglabels' })).toHaveAttribute('href', 'https://www.instagram.com/rmglabels/');
    const policies = within(footer).getByRole('navigation', { name: 'Thông tin cửa hàng' });
    for (const name of ['Liên hệ', 'Giao hàng', 'Đổi & trả', 'Thanh toán', 'Bảo mật']) {
      expect(within(policies).getByRole('link', { name })).toBeVisible();
    }
    const header = screen.getByRole('banner');
    expect(within(header).queryByRole('link', { name: 'Đăng nhập' })).not.toBeInTheDocument();
    expect(within(header).queryByRole('link', { name: 'Tài khoản' })).not.toBeInTheDocument();
    expect(within(header).queryByRole('link', { name: 'Quản trị' })).not.toBeInTheDocument();
  });

  it('still gives a signed-in admin the way into the admin area', async () => {
    renderStore('/shipping', admin);
    const header = screen.getByRole('banner');
    expect(await within(header).findByRole('link', { name: 'Quản trị' })).toHaveAttribute('href', '/admin');
  });

  it('names the shop in the page title', async () => {
    renderStore('/shipping', null);
    await screen.findByRole('heading', { name: 'Giao hàng', level: 1 });
    expect(document.title).toBe('Giao hàng | RMG Labels');
  });

  it('announces nationwide delivery and its fee above the header', async () => {
    renderStore('/shipping', null);
    const note = await screen.findByRole('note', { name: 'Thông báo cửa hàng' });
    expect(note).toHaveTextContent('Giao hàng toàn quốc');
    expect(note).toHaveTextContent('30.000đ');
  });

  it('links every active category to the filtered collection from the footer', async () => {
    renderStore('/shipping', null, [tees]);
    const shop = within(screen.getByRole('contentinfo')).getByRole('navigation', { name: 'Mua sắm' });
    expect(within(shop).getByRole('link', { name: 'Tất cả sản phẩm' })).toHaveAttribute('href', '/shop');
    expect(await within(shop).findByRole('link', { name: 'Áo thun' })).toHaveAttribute('href', `/shop?categoryId=${tees.id}`);
  });

  it('opens a mobile menu with the categories and closes it with Escape', async () => {
    const user = userEvent.setup();
    renderStore('/shipping', null, [tees]);
    await user.click(screen.getByRole('button', { name: 'Mở menu' }));
    const menu = await screen.findByRole('navigation', { name: 'Menu cửa hàng' });
    expect(await within(menu).findByRole('link', { name: 'Áo thun' })).toHaveAttribute('href', `/shop?categoryId=${tees.id}`);
    expect(within(menu).getByRole('link', { name: 'Bảng size' })).toHaveAttribute('href', '/size-guide');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Menu cửa hàng' })).not.toBeInTheDocument());
  });

  it('closes the mobile menu after following one of its links', async () => {
    const user = userEvent.setup();
    renderStore('/shipping', null);
    await user.click(screen.getByRole('button', { name: 'Mở menu' }));
    const menu = await screen.findByRole('navigation', { name: 'Menu cửa hàng' });
    await user.click(within(menu).getByRole('link', { name: 'Đổi & trả' }));
    expect(await screen.findByRole('heading', { name: 'Đổi & trả', level: 1 })).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Menu cửa hàng' })).not.toBeInTheDocument());
  });

  it('searches the collection from any page', async () => {
    const user = userEvent.setup();
    const list = vi.spyOn(catalogApi, 'list').mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 12 });
    renderStore('/shipping', null);
    await user.click(screen.getByRole('button', { name: 'Mở ô tìm kiếm' }));
    await user.type(await screen.findByRole('searchbox', { name: 'Tìm trong cửa hàng' }), 'áo khoác{Enter}');
    expect(await screen.findByRole('heading', { name: 'Kết quả cho “áo khoác”', level: 1 })).toBeVisible();
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ q: 'áo khoác', page: 1 }));
    expect(screen.queryByRole('searchbox', { name: 'Tìm trong cửa hàng' })).not.toBeInTheDocument();
  });
});

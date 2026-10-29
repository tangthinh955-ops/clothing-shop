import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import { authApi, type User } from '../features/auth/api/auth.api';

const admin: User = { id: 'store-admin', name: 'Admin', email: 'store@example.test', role: 'ADMIN', emailVerified: true };

afterEach(() => vi.restoreAllMocks());

function renderStore(path: string, user: User | null) {
  vi.spyOn(authApi, 'me').mockResolvedValue(user);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}><App /></MemoryRouter>
  </QueryClientProvider>);
}

describe('store layout of the real shop', () => {
  it('shows the shop name and seller details with no demo wording or customer sign-in link', async () => {
    renderStore('/shipping', null);
    expect(await screen.findByRole('link', { name: 'RMG LABELS' })).toHaveAttribute('href', '/shop');
    expect(document.body.textContent).not.toMatch(/demo|dữ liệu giả|giả định/i);
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByText(/Cá nhân kinh doanh/)).toBeVisible();
    expect(within(footer).getByText(/TP\. Hồ Chí Minh/)).toBeVisible();
    expect(within(footer).getByRole('link', { name: 'Instagram @rmglabels' })).toHaveAttribute('href', 'https://www.instagram.com/rmglabels/');
    const policies = within(footer).getByRole('navigation', { name: 'Thông tin cửa hàng' });
    for (const name of ['Liên hệ', 'Giao hàng', 'Đổi & trả', 'Thanh toán', 'Bảo mật']) {
      expect(within(policies).getByRole('link', { name })).toBeVisible();
    }
    const main = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(within(main).queryByRole('link', { name: 'Đăng nhập' })).not.toBeInTheDocument();
    expect(within(main).queryByRole('link', { name: 'Tài khoản' })).not.toBeInTheDocument();
    expect(within(main).queryByRole('link', { name: 'Quản trị' })).not.toBeInTheDocument();
  });

  it('still gives a signed-in admin the way into the admin area', async () => {
    renderStore('/shipping', admin);
    const main = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(await within(main).findByRole('link', { name: 'Quản trị' })).toHaveAttribute('href', '/admin');
  });

  it('names the shop in the page title', async () => {
    renderStore('/shipping', null);
    await screen.findByRole('heading', { name: 'Giao hàng', level: 1 });
    expect(document.title).toBe('Giao hàng | RMG Labels');
  });
});

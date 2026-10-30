import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authApi, type User } from '../features/auth/api/auth.api';
import * as apiClient from '../shared/api/client';
import { catalogApi } from '../features/catalog/api/catalog.api';
import { App } from './App';

afterEach(() => vi.restoreAllMocks());

function renderApp(path: string) {
  // The store header loads category links on every page; these tests are not about them.
  vi.spyOn(catalogApi, 'categories').mockResolvedValue([]);
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}><App /></MemoryRouter>
  </QueryClientProvider>);
}
const customer: User = { id: 'test-user', name: 'Khách thử', email: 'router@example.test', role: 'CUSTOMER', emailVerified: true };

describe('protected routes', () => {
  it('redirects an unauthenticated account request to login', async () => {
    vi.spyOn(authApi, 'me').mockResolvedValue(null);
    renderApp('/account');
    expect(await screen.findByRole('heading', { name: 'Chào bạn trở lại' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Tài khoản của bạn' })).not.toBeInTheDocument();
  });

  it('returns a customer from the admin route to their own account', async () => {
    vi.spyOn(authApi, 'me').mockResolvedValue(customer);
    renderApp('/admin');
    expect(await screen.findByRole('heading', { name: 'Tài khoản của bạn' })).toBeVisible();
    expect(screen.getByText(customer.email)).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Quản trị cửa hàng' })).not.toBeInTheDocument();
  });

  it('allows an administrator to reach the admin page', async () => {
    vi.spyOn(authApi, 'me').mockResolvedValue({ ...customer, role: 'ADMIN' });
    vi.spyOn(apiClient, 'request').mockResolvedValue({ allowed: true });
    renderApp('/admin');
    expect(await screen.findByRole('heading', { name: 'Quản trị cửa hàng' })).toBeVisible();
    expect(await screen.findByText('Chào bạn. Tài khoản quản trị đã sẵn sàng.')).toBeVisible();
  });
});

describe('login and registration with an existing session', () => {
  it.each([
    { role: 'CUSTOMER', path: '/login', heading: 'Tài khoản của bạn' },
    { role: 'CUSTOMER', path: '/register', heading: 'Tài khoản của bạn' },
    { role: 'ADMIN', path: '/login', heading: 'Quản trị cửa hàng' },
    { role: 'ADMIN', path: '/register', heading: 'Quản trị cửa hàng' },
  ] as const)('redirects $role from $path', async ({ role, path, heading }) => {
    vi.spyOn(authApi, 'me').mockResolvedValue({ ...customer, role });
    vi.spyOn(apiClient, 'request').mockResolvedValue({ allowed: true });
    renderApp(path);
    expect(await screen.findByRole('heading', { name: heading })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Đăng nhập' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tạo tài khoản' })).not.toBeInTheDocument();
  });

  it.each([
    { path: '/login', heading: 'Chào bạn trở lại' },
    { path: '/register', heading: 'Tạo tài khoản' },
  ])('keeps $path available for guests', async ({ path, heading }) => {
    vi.spyOn(authApi, 'me').mockResolvedValue(null);
    renderApp(path);
    expect(await screen.findByRole('heading', { name: heading })).toBeVisible();
  });

  it('does not advertise customer sign-up on the login page, since shoppers order without an account', async () => {
    vi.spyOn(authApi, 'me').mockResolvedValue(null);
    renderApp('/login');
    expect(await screen.findByRole('heading', { name: 'Chào bạn trở lại' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Đăng ký' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Quên mật khẩu?' })).toBeVisible();
  });

  it('waits for the session before presenting a login form', async () => {
    let finish: (user: User | null) => void = () => { throw new Error('Session not requested'); };
    vi.spyOn(authApi, 'me').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    renderApp('/login');
    expect(screen.queryByLabelText('Mật khẩu')).not.toBeInTheDocument();
    await act(async () => { finish(customer); });
    expect(await screen.findByRole('heading', { name: 'Tài khoản của bạn' })).toBeVisible();
  });

  it('allows retry after a session lookup error without rendering a misleading login form', async () => {
    vi.spyOn(authApi, 'me').mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValueOnce(customer);
    renderApp('/register');
    expect(await screen.findByRole('button', { name: 'Kiểm tra lại phiên' })).toBeVisible();
    expect(screen.queryByLabelText('Mật khẩu')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại phiên' }));
    expect(await screen.findByRole('heading', { name: 'Tài khoản của bạn' })).toBeVisible();
  });
});

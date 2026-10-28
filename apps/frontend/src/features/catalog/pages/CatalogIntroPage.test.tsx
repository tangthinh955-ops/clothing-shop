import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authApi, type User } from '../../auth/api/auth.api';
import { currentUserKey } from '../../auth/hooks/useCurrentUser';
import { CatalogIntroPage } from './CatalogIntroPage';

const customer: User = { id: 'catalog-customer', email: 'catalog@example.test', name: 'Khách thử', role: 'CUSTOMER', emailVerified: true };
afterEach(() => vi.restoreAllMocks());

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><CatalogIntroPage /></MemoryRouter></QueryClientProvider>);
  return client;
}

describe('catalog entry action follows the current session', () => {
  it('offers registration to a confirmed guest', async () => {
    vi.spyOn(authApi, 'me').mockResolvedValue(null);
    renderPage();
    expect(await screen.findByRole('link', { name: 'Tạo tài khoản' })).toHaveAttribute('href', '/register');
  });

  it.each([
    { role: 'CUSTOMER', label: 'Tài khoản', path: '/account' },
    { role: 'ADMIN', label: 'Quản trị', path: '/admin' },
  ] as const)('replaces registration for $role', async ({ role, label, path }) => {
    vi.spyOn(authApi, 'me').mockResolvedValue({ ...customer, role });
    renderPage();
    expect(await screen.findByRole('link', { name: label })).toHaveAttribute('href', path);
    expect(screen.queryByRole('link', { name: 'Tạo tài khoản' })).not.toBeInTheDocument();
  });

  it('does not flash registration while the session is loading', async () => {
    let finish: (user: User | null) => void = () => { throw new Error('Session not requested'); };
    vi.spyOn(authApi, 'me').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    renderPage();
    expect(screen.queryByRole('link', { name: 'Tạo tài khoản' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đang kiểm tra phiên…');
    await act(async () => { finish(customer); });
    expect(await screen.findByRole('link', { name: 'Tài khoản' })).toBeVisible();
  });

  it('offers retry instead of treating a session lookup error as a guest', async () => {
    vi.spyOn(authApi, 'me').mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValueOnce(customer);
    renderPage();
    expect(await screen.findByRole('button', { name: 'Kiểm tra lại phiên' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Tạo tài khoản' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại phiên' }));
    expect(await screen.findByRole('link', { name: 'Tài khoản' })).toBeVisible();
  });

  it('updates the action when the shared session cache changes after logout', async () => {
    vi.spyOn(authApi, 'me').mockResolvedValue(customer);
    const client = renderPage();
    await screen.findByRole('link', { name: 'Tài khoản' });
    await act(async () => { client.setQueryData(currentUserKey, null); });
    expect(await screen.findByRole('link', { name: 'Tạo tài khoản' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Tài khoản' })).not.toBeInTheDocument();
  });
});

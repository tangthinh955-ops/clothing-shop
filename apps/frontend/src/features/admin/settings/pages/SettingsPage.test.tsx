import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../../app/App';
import { authApi, type User } from '../../../auth/api/auth.api';
import * as client from '../../../../shared/api/client';

const admin: User = { id: 'settings-admin', name: 'Admin', email: 'settings@example.test', role: 'ADMIN', emailVerified: true };
const savedSettings = { shippingFeeVnd: 45000, bankDeadlineMinutes: 150, bankName: 'Ngân hàng thử', bankBin: '970422',
  bankAccountNumber: '12345678', bankAccountName: 'CONG TY THU', version: 2 };
// Money text contains a non-breaking space from the locale formatter, so match the digits like the
// catalog and inventory suites do instead of the whole currency string.
const feePattern = /45\.000/;

afterEach(() => vi.restoreAllMocks());

function renderPage(user: User | null = admin) {
  vi.spyOn(authApi, 'me').mockResolvedValue(user);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/admin/settings']}><App /></MemoryRouter>
  </QueryClientProvider>);
}

describe('admin settings page', () => {
  it('shows the fee, the deadline in minutes and the bank details', async () => {
    vi.spyOn(client, 'request').mockResolvedValue(savedSettings);
    renderPage();
    expect(await screen.findByText(feePattern)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Cài đặt cửa hàng' })).toBeVisible();
    expect(screen.getByText('150 phút')).toBeVisible();
    expect(screen.getByText('Ngân hàng thử')).toBeVisible();
    expect(screen.getByText('970422')).toBeVisible();
    expect(screen.getByText('12345678')).toBeVisible();
    expect(screen.getByText('CONG TY THU')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Về quản trị' })).toHaveAttribute('href', '/admin');
  });

  it('shows Chưa cấu hình for every missing bank field', async () => {
    vi.spyOn(client, 'request').mockResolvedValue({ ...savedSettings, bankName: null, bankBin: null,
      bankAccountNumber: null, bankAccountName: null, version: 0 });
    renderPage();
    expect(await screen.findByText(feePattern)).toBeVisible();
    expect(screen.getAllByText('Chưa cấu hình')).toHaveLength(4);
  });

  it('shows loading, then an error with a retry that recovers', async () => {
    let rejectRequest: (error: Error) => void = () => { throw new Error('Request not started'); };
    const request = vi.spyOn(client, 'request')
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRequest = reject; }))
      .mockResolvedValueOnce(savedSettings);
    renderPage();
    // Wait for the session check to finish and the page to mount; the settings query stays pending.
    await screen.findByText('Về quản trị');
    expect(screen.getByText('Đang tải cài đặt…')).toHaveAttribute('role', 'status');
    await act(async () => { rejectRequest(new client.ApiError('NETWORK_ERROR', 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.', 0)); });
    expect(await screen.findByText('Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại cài đặt' }));
    expect(await screen.findByText(feePattern)).toBeVisible();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('stays read-only without save controls or inputs', async () => {
    vi.spyOn(client, 'request').mockResolvedValue(savedSettings);
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Cài đặt cửa hàng' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Lưu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it.each([null, { ...admin, role: 'CUSTOMER' } satisfies User])('protects settings for a guest/customer', async (user) => {
    const request = vi.spyOn(client, 'request');
    renderPage(user);
    expect(await screen.findByRole('heading', { name: user ? 'Tài khoản của bạn' : 'Chào bạn trở lại' })).toBeVisible();
    expect(request).not.toHaveBeenCalledWith('/admin/settings');
  });
});

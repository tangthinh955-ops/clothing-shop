import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../../app/App';
import { authApi, type User } from '../../../auth/api/auth.api';
import { catalogApi } from '../../../catalog/api/catalog.api';
import * as client from '../../../../shared/api/client';

const admin: User = { id: 'settings-admin', name: 'Admin', email: 'settings@example.test', role: 'ADMIN', emailVerified: true };
const savedSettings = { shippingFeeVnd: 45000, bankDeadlineMinutes: 150, bankName: 'Ngân hàng thử', bankBin: '970422',
  bankAccountNumber: '12345678', bankAccountName: 'CONG TY THU', version: 2 };
const updatedSettings = { shippingFeeVnd: 51000, bankDeadlineMinutes: 150, bankName: 'Ngân hàng thử', bankBin: '970422',
  bankAccountNumber: '12345678', bankAccountName: 'CONG TY THU', version: 3 };
const freshSettings = { shippingFeeVnd: 77000, bankDeadlineMinutes: 240, bankName: 'Ngân hàng mới', bankBin: '970435',
  bankAccountNumber: '000987654321', bankAccountName: 'BAN QUAN TRI', version: 7 };

afterEach(() => vi.restoreAllMocks());

function renderPage(user: User | null = admin) {
  vi.spyOn(catalogApi, 'categories').mockResolvedValue([]);
  vi.spyOn(authApi, 'me').mockResolvedValue(user);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/admin/settings']}><App /></MemoryRouter>
  </QueryClientProvider>);
}

describe('admin settings page', () => {
  it('keeps the draft and conflict lock when a confirmed reload fails', async () => {
    let reads = 0;
    vi.spyOn(client, 'request').mockImplementation((_path, options) => {
      if (options?.method === 'PATCH') return Promise.reject(new client.ApiError('CONFLICT', 'Cấu hình đã đổi.', 409));
      return ++reads === 1 ? Promise.resolve(savedSettings)
        : Promise.reject(new client.ApiError('NETWORK_ERROR', 'Tải cấu hình thất bại.', 0));
    });
    renderPage();
    const fee = await screen.findByLabelText('Phí giao hàng');
    await userEvent.clear(fee);
    await userEvent.type(fee, '51000');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));
    await screen.findByText('Cấu hình đã đổi.');
    await userEvent.click(screen.getByRole('button', { name: 'Tải cấu hình mới' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xoá và tải cấu hình mới' }));
    await screen.findByText('Tải cấu hình thất bại.');
    expect(screen.getByLabelText('Phí giao hàng')).toHaveValue('51000');
    expect(screen.getByLabelText('Phí giao hàng')).toBeDisabled();
  });

  it('blocks saving while an explicit reload is still pending', async () => {
    let reads = 0;
    let finishReload: (value: typeof savedSettings) => void = () => { throw new Error('Reload not started'); };
    vi.spyOn(client, 'request').mockImplementation((_path, options) => {
      if (options?.method === 'PATCH') return Promise.reject(new client.ApiError('VALIDATION_ERROR', 'Chưa lưu được.', 400));
      return ++reads === 1 ? Promise.resolve(savedSettings)
        : new Promise((resolve) => { finishReload = resolve; });
    });
    renderPage();
    await screen.findByLabelText('Phí giao hàng');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));
    await screen.findByText('Chưa lưu được.');
    await userEvent.click(screen.getByRole('button', { name: 'Tải cấu hình mới' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xoá và tải cấu hình mới' }));
    try {
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Lưu cài đặt' })).toBeDisabled();
      expect(screen.getByLabelText('Phí giao hàng')).toBeDisabled();
    } finally {
      await act(async () => { finishReload(savedSettings); });
    }
  });

  it('keeps the original command retryable after a lost response and a failed reload', async () => {
    let reads = 0;
    let patches = 0;
    const request = vi.spyOn(client, 'request').mockImplementation((_path, options) => {
      if (options?.method === 'PATCH') return ++patches === 1
        ? Promise.reject(new client.ApiError('NETWORK_ERROR', 'Mất phản hồi lưu.', 0)) : Promise.resolve(updatedSettings);
      return ++reads === 1 ? Promise.resolve(savedSettings)
        : Promise.reject(new client.ApiError('NETWORK_ERROR', 'Tải lại vẫn lỗi.', 0));
    });
    renderPage();
    await screen.findByLabelText('Phí giao hàng');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));
    await screen.findByRole('button', { name: 'Gửi lại' });
    await userEvent.click(screen.getByRole('button', { name: 'Tải cấu hình mới' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xoá và tải cấu hình mới' }));
    await screen.findByText('Tải lại vẫn lỗi.');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Phí giao hàng')).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Gửi lại' }));
    await screen.findByText('Đã lưu cài đặt. Cấu hình mới áp dụng cho các đơn mới.');
    const commands = request.mock.calls.filter(([, options]) => options?.method === 'PATCH');
    expect(commands).toHaveLength(2);
    expect(commands[1]).toEqual(commands[0]);
  });

  it('locks an unreadable save response and resends the identical command', async () => {
    let patches = 0;
    const request = vi.spyOn(client, 'request').mockImplementation((_path, options) => options?.method === 'PATCH'
      ? Promise.resolve(++patches === 1 ? {} : updatedSettings) : Promise.resolve(savedSettings));
    renderPage();
    await screen.findByLabelText('Phí giao hàng');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không rõ máy chủ đã lưu');
    expect(screen.getByLabelText('Phí giao hàng')).toHaveValue('45000');
    expect(screen.getByLabelText('Phí giao hàng')).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Gửi lại' }));
    await screen.findByText('Đã lưu cài đặt. Cấu hình mới áp dụng cho các đơn mới.');
    const commands = request.mock.calls.filter(([, options]) => options?.method === 'PATCH');
    expect(commands).toHaveLength(2);
    expect(commands[1]).toEqual(commands[0]);
  });

  it('shows an editable form prefilled with the saved configuration', async () => {
    vi.spyOn(client, 'request').mockResolvedValue(savedSettings);
    renderPage();
    expect(await screen.findByLabelText('Phí giao hàng')).toHaveValue('45000');
    expect(screen.getByLabelText('Hạn chuyển khoản')).toHaveValue('150');
    expect(screen.getByLabelText('Tên ngân hàng')).toHaveValue('Ngân hàng thử');
    expect(screen.getByLabelText('Mã BIN')).toHaveValue('970422');
    expect(screen.getByLabelText('Số tài khoản')).toHaveValue('12345678');
    expect(screen.getByLabelText('Tên chủ tài khoản')).toHaveValue('CONG TY THU');
    expect(screen.getByText(/báo giá và đơn hàng đã tạo giữ nguyên/)).toHaveTextContent('phiên bản 2');
    expect(screen.getByRole('link', { name: 'Về quản trị' })).toHaveAttribute('href', '/admin');
  });

  it('saves through PATCH /admin/settings and adopts the server response as the new baseline', async () => {
    const request = vi.spyOn(client, 'request').mockImplementation((path, options) =>
      path === '/admin/settings' && options?.method === 'PATCH'
        ? Promise.resolve(updatedSettings)
        : Promise.resolve(savedSettings));
    renderPage();
    await screen.findByLabelText('Phí giao hàng');
    await userEvent.clear(screen.getByLabelText('Phí giao hàng'));
    await userEvent.type(screen.getByLabelText('Phí giao hàng'), '51000');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));
    expect(await screen.findByText('Đã lưu cài đặt. Cấu hình mới áp dụng cho các đơn mới.')).toBeVisible();
    expect(request).toHaveBeenCalledWith('/admin/settings', {
      method: 'PATCH',
      idempotencyKey: expect.stringMatching(/^[A-Za-z0-9_-]{16,120}$/),
      body: { shippingFeeVnd: 51000, bankDeadlineMinutes: 150, bankName: 'Ngân hàng thử', bankBin: '970422',
        bankAccountNumber: '12345678', bankAccountName: 'CONG TY THU', expectedVersion: 2 },
    });
    // The saved config page state flows from the server response, not a local guess.
    expect(screen.getByLabelText('Phí giao hàng')).toHaveValue('51000');
    expect(screen.getByText(/báo giá và đơn hàng đã tạo giữ nguyên/)).toHaveTextContent('phiên bản 3');
  });

  it('resends the identical command after a lost response and shows the served state', async () => {
    let patchCalls = 0;
    const request = vi.spyOn(client, 'request').mockImplementation((path, options) => {
      if (path === '/admin/settings' && options?.method === 'PATCH') {
        patchCalls += 1;
        return patchCalls === 1
          ? Promise.reject(new client.ApiError('NETWORK_ERROR', 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.', 0))
          : Promise.resolve(updatedSettings);
      }
      return Promise.resolve(savedSettings);
    });
    renderPage();
    await screen.findByLabelText('Phí giao hàng');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể kết nối');
    expect(screen.getByLabelText('Phí giao hàng')).toBeDisabled(); // content locked while unconfirmed
    await userEvent.click(await screen.findByRole('button', { name: 'Gửi lại' }));
    expect(await screen.findByText('Đã lưu cài đặt. Cấu hình mới áp dụng cho các đơn mới.')).toBeVisible();
    const patchOptions = request.mock.calls
      .filter(([path, options]) => path === '/admin/settings' && options?.method === 'PATCH')
      .map(([, options]) => options);
    expect(patchOptions).toHaveLength(2);
    expect(patchOptions[1]).toEqual(patchOptions[0]); // exact same body and Idempotency-Key
  });

  it('on a version conflict keeps the draft and only replaces content after a confirmed reload', async () => {
    let serverSettings: unknown = savedSettings;
    const request = vi.spyOn(client, 'request').mockImplementation((path, options) =>
      path === '/admin/settings' && options?.method === 'PATCH'
        ? Promise.reject(new client.ApiError('CONFLICT', 'Phiên bản cấu hình đã thay đổi. Hãy tải cấu hình mới.', 409))
        : Promise.resolve(serverSettings));
    renderPage();
    await screen.findByLabelText('Phí giao hàng');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Phiên bản cấu hình đã thay đổi');
    expect(screen.getByLabelText('Phí giao hàng')).toHaveValue('45000'); // draft kept
    await userEvent.click(screen.getByRole('button', { name: 'Tải cấu hình mới' }));
    serverSettings = freshSettings; // must be in place before the confirm, the refetch captures it then
    await userEvent.click(screen.getByRole('button', { name: 'Xoá và tải cấu hình mới' }));
    await waitFor(() => expect(screen.getByLabelText('Phí giao hàng')).toHaveValue('77000'));
    expect(screen.getByLabelText('Hạn chuyển khoản')).toHaveValue('240');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
    expect(await screen.findByLabelText('Phí giao hàng')).toBeVisible();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it.each([null, { ...admin, role: 'CUSTOMER' } satisfies User])('protects settings for a guest/customer', async (user) => {
    const request = vi.spyOn(client, 'request');
    renderPage(user);
    expect(await screen.findByRole('heading', { name: user ? 'Tài khoản của bạn' : 'Chào bạn trở lại' })).toBeVisible();
    expect(request).not.toHaveBeenCalledWith('/admin/settings');
  });
});

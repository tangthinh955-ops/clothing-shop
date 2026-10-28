import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../../app/App';
import { authApi, type User } from '../../../auth/api/auth.api';
import * as client from '../../../../shared/api/client';

const admin: User = { id: 'admin-test', email: 'admin@example.test', name: 'Quản trị thử', role: 'ADMIN', emailVerified: true };
const category = { id: 'category-test', name: 'Áo thun', slug: 'ao-thun', active: true, version: 0 };
afterEach(() => vi.restoreAllMocks());

function renderPage(user: User | null = admin) {
  vi.spyOn(authApi, 'me').mockResolvedValue(user);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={['/admin/categories']}><App /></MemoryRouter>
  </QueryClientProvider>);
  return queryClient;
}

async function fillForm() {
  await userEvent.type(screen.getByLabelText('Tên danh mục'), category.name);
  await userEvent.type(screen.getByLabelText('Đường dẫn danh mục'), category.slug);
}

describe('admin category list and creation', () => {
  it('shows loading, empty state, creates a category and refreshes the list', async () => {
    let finishList: (value: unknown) => void = () => { throw new Error('List not started'); };
    const request = vi.spyOn(client, 'request')
      .mockImplementationOnce(() => new Promise((resolve) => { finishList = resolve; }))
      .mockResolvedValueOnce(category)
      .mockResolvedValueOnce([category]);
    renderPage();
    expect(await screen.findByText('Đang tải danh mục…')).toBeVisible();
    await act(async () => { finishList([]); });
    expect(await screen.findByText('Chưa có danh mục nào. Hãy thêm danh mục đầu tiên.')).toBeVisible();
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm danh mục' }));
    expect(await screen.findByText('Đã lưu danh mục “Áo thun”.')).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'Áo thun' })).toBeVisible();
    expect(screen.getByLabelText('Tên danh mục')).toHaveValue('');
    expect(request).toHaveBeenCalledWith('/admin/categories', {
      method: 'POST', body: { name: 'Áo thun', slug: 'ao-thun', active: true },
    });
  });

  it('offers retry after a failed list request', async () => {
    vi.spyOn(client, 'request')
      .mockRejectedValueOnce(new client.ApiError('NETWORK_ERROR', 'Không thể kết nối. Vui lòng thử lại.', 0))
      .mockResolvedValueOnce([category, { ...category, id: 'inactive', name: 'Áo khoác', slug: 'ao-khoac', active: false }]);
    renderPage();
    expect(await screen.findByText('Không thể kết nối. Vui lòng thử lại.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại danh mục' }));
    expect(await screen.findByRole('heading', { name: 'Áo thun' })).toBeVisible();
    expect(screen.getByText('Đang bật')).toBeVisible();
    expect(screen.getByText('Đang tắt')).toBeVisible();
  });

  it('keeps form values after a duplicate slug and allows correction', async () => {
    const request = vi.spyOn(client, 'request').mockResolvedValueOnce([category])
      .mockRejectedValueOnce(new client.ApiError('CONFLICT', 'Đường dẫn danh mục đã được sử dụng.', 409))
      .mockResolvedValueOnce({ ...category, id: 'new', slug: 'ao-thun-moi', active: false })
      .mockResolvedValueOnce([category, { ...category, id: 'new', slug: 'ao-thun-moi', active: false }]);
    renderPage();
    await screen.findByRole('heading', { name: 'Danh mục sản phẩm' });
    await fillForm();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Bật danh mục khi tạo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Thêm danh mục' }));
    expect(await screen.findByText('Đường dẫn danh mục đã được sử dụng.')).toBeVisible();
    expect(screen.getByLabelText('Tên danh mục')).toHaveValue(category.name);
    expect(screen.getByLabelText('Đường dẫn danh mục')).toHaveValue(category.slug);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    await userEvent.type(screen.getByLabelText('Đường dẫn danh mục'), '-moi');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm danh mục' }));
    expect(await screen.findByText('Đã lưu danh mục “Áo thun”.')).toBeVisible();
    expect(request).toHaveBeenCalledWith('/admin/categories', {
      method: 'POST', body: { name: 'Áo thun', slug: 'ao-thun-moi', active: false },
    });
  });

  it('displays field validation and preserves input after a network failure', async () => {
    vi.spyOn(client, 'request').mockResolvedValueOnce([])
      .mockRejectedValueOnce(new client.ApiError('VALIDATION_ERROR', 'Thông tin chưa hợp lệ.', 400,
        [{ field: 'slug', message: 'Đường dẫn không hợp lệ.' }]))
      .mockRejectedValueOnce(new client.ApiError('NETWORK_ERROR', 'Không thể kết nối. Vui lòng thử lại.', 0));
    renderPage();
    await screen.findByRole('heading', { name: 'Danh mục sản phẩm' });
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm danh mục' }));
    expect(await screen.findByText('Đường dẫn không hợp lệ.')).toBeVisible();
    expect(screen.getByLabelText('Đường dẫn danh mục')).toHaveAttribute('aria-invalid', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm danh mục' }));
    expect(await screen.findByText('Không thể kết nối. Vui lòng thử lại.')).toBeVisible();
    expect(screen.getByLabelText('Tên danh mục')).toHaveValue(category.name);
    expect(screen.getByRole('button', { name: 'Thêm danh mục' })).toBeEnabled();
  });

  it('blocks same-tick duplicate submissions and locks input while saving', async () => {
    let finishCreate: (value: unknown) => void = () => { throw new Error('Create not started'); };
    const request = vi.spyOn(client, 'request').mockResolvedValueOnce([])
      .mockImplementationOnce(() => new Promise((resolve) => { finishCreate = resolve; }))
      .mockResolvedValueOnce([category]);
    renderPage();
    await screen.findByRole('heading', { name: 'Danh mục sản phẩm' });
    await fillForm();
    const form = screen.getByRole('button', { name: 'Thêm danh mục' }).closest('form');
    if (!form) throw new Error('Missing category form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(screen.getByRole('button', { name: 'Đang lưu…' })).toBeDisabled();
    expect(screen.getByLabelText('Tên danh mục')).toBeDisabled();
    await waitFor(() => expect(request.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1));
    await act(async () => { finishCreate(category); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Thêm danh mục' })).toBeEnabled());
  });

  it.each([
    { user: null, heading: 'Chào bạn trở lại' },
    { user: { ...admin, role: 'CUSTOMER' } satisfies User, heading: 'Tài khoản của bạn' },
  ])('protects the category route for $heading', async ({ user, heading }) => {
    const request = vi.spyOn(client, 'request');
    renderPage(user);
    expect(await screen.findByRole('heading', { name: heading })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Danh mục sản phẩm' })).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalledWith('/admin/categories');
  });
});

describe('admin category editing', () => {
  async function openEdit() {
    await userEvent.click(await screen.findByRole('button', { name: 'Sửa Áo thun' }));
    return within(screen.getByRole('dialog', { name: 'Sửa danh mục' }));
  }

  it('loads current fields, patches with the original version and refreshes the list', async () => {
    const updated = { ...category, name: 'Áo cotton', slug: 'ao-cotton', active: false, version: 1 };
    const request = vi.spyOn(client, 'request').mockResolvedValueOnce([category])
      .mockResolvedValueOnce(updated).mockResolvedValueOnce([updated]);
    renderPage();
    const dialog = await openEdit();
    expect(dialog.getByLabelText('Tên danh mục')).toHaveValue(category.name);
    await userEvent.clear(dialog.getByLabelText('Tên danh mục'));
    await userEvent.type(dialog.getByLabelText('Tên danh mục'), updated.name);
    await userEvent.clear(dialog.getByLabelText('Đường dẫn danh mục'));
    await userEvent.type(dialog.getByLabelText('Đường dẫn danh mục'), updated.slug);
    await userEvent.click(dialog.getByRole('checkbox', { name: 'Bật danh mục' }));
    await userEvent.click(dialog.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByText('Đã cập nhật danh mục “Áo cotton”.')).toBeVisible();
    expect(await screen.findByRole('heading', { name: updated.name })).toBeVisible();
    expect(screen.getByText('Đang tắt')).toBeVisible();
    expect(request).toHaveBeenCalledWith('/admin/categories/category-test', {
      method: 'PATCH', body: { name: updated.name, slug: updated.slug, active: false, expectedVersion: 0 },
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('cancels without saving and preserves the separate creation form', async () => {
    const request = vi.spyOn(client, 'request').mockResolvedValue([category]);
    renderPage();
    await screen.findByRole('button', { name: 'Sửa Áo thun' });
    await userEvent.type(screen.getByLabelText('Tên danh mục'), 'Bản tạo đang nhập');
    const dialog = await openEdit();
    await userEvent.type(dialog.getByLabelText('Tên danh mục'), ' chưa lưu');
    await userEvent.click(dialog.getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Tên danh mục')).toHaveValue('Bản tạo đang nhập');
    expect(request.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(0);
  });

  it('preserves draft/version after background updates and conflict, then explicitly reloads the latest version', async () => {
    const latest = { ...category, name: 'Đã sửa ở tab khác', version: 1 };
    const saved = { ...latest, active: false, version: 2 };
    const request = vi.spyOn(client, 'request').mockResolvedValueOnce([category])
      .mockRejectedValueOnce(new client.ApiError('CONFLICT', 'Dữ liệu đã thay đổi hoặc bị trùng.', 409))
      .mockResolvedValueOnce([latest]).mockResolvedValueOnce(saved).mockResolvedValueOnce([saved]);
    const queryClient = renderPage();
    const dialog = await openEdit();
    await userEvent.type(dialog.getByLabelText('Tên danh mục'), ' đang nhập');
    await act(async () => { queryClient.setQueryData(['admin-categories'], [latest]); });
    expect(dialog.getByLabelText('Tên danh mục')).toHaveValue('Áo thun đang nhập');
    await userEvent.click(dialog.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('Danh mục đã thay đổi hoặc đường dẫn bị trùng.');
    expect(dialog.getByLabelText('Tên danh mục')).toHaveValue('Áo thun đang nhập');
    expect(request).toHaveBeenCalledWith('/admin/categories/category-test', {
      method: 'PATCH', body: { name: 'Áo thun đang nhập', slug: category.slug, active: true, expectedVersion: 0 },
    });
    await userEvent.click(dialog.getByRole('button', { name: 'Tải dữ liệu mới' }));
    await waitFor(() => expect(dialog.getByLabelText('Tên danh mục')).toHaveValue(latest.name));
    await userEvent.click(dialog.getByRole('checkbox', { name: 'Bật danh mục' }));
    await userEvent.click(dialog.getByRole('button', { name: 'Lưu thay đổi' }));
    await screen.findByText(`Đã cập nhật danh mục “${latest.name}”.`);
    expect(request).toHaveBeenCalledWith('/admin/categories/category-test', {
      method: 'PATCH', body: { name: latest.name, slug: category.slug, active: false, expectedVersion: 1 },
    });
  });

  it('preserves input after a failed reload and a failed save', async () => {
    vi.spyOn(client, 'request').mockResolvedValueOnce([category])
      .mockRejectedValueOnce(new client.ApiError('NETWORK_ERROR', 'Không thể kết nối.', 0))
      .mockRejectedValueOnce(new client.ApiError('VALIDATION_ERROR', 'Thông tin chưa hợp lệ.', 400,
        [{ field: 'slug', message: 'Đường dẫn không hợp lệ.' }]));
    renderPage();
    const dialog = await openEdit();
    await userEvent.type(dialog.getByLabelText('Tên danh mục'), ' đang nhập');
    await userEvent.click(dialog.getByRole('button', { name: 'Tải dữ liệu mới' }));
    expect(await dialog.findByText('Không thể kết nối.')).toBeVisible();
    expect(dialog.getByLabelText('Tên danh mục')).toHaveValue('Áo thun đang nhập');
    await userEvent.click(dialog.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await dialog.findByText('Đường dẫn không hợp lệ.')).toBeVisible();
    expect(dialog.getByLabelText('Tên danh mục')).toHaveValue('Áo thun đang nhập');
  });

  it('blocks duplicate saves and closing the dialog while a save is pending', async () => {
    let finish: (value: unknown) => void = () => { throw new Error('Save not started'); };
    const request = vi.spyOn(client, 'request').mockResolvedValueOnce([category])
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValueOnce([category]);
    renderPage();
    const dialog = await openEdit();
    const form = dialog.getByRole('form', { name: 'Sửa danh mục' });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(dialog.getByRole('button', { name: 'Đang lưu…' })).toBeDisabled();
    expect(dialog.getByRole('button', { name: 'Hủy' })).toBeDisabled();
    expect(dialog.getByRole('button', { name: 'Tải dữ liệu mới' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeVisible();
    await waitFor(() => expect(request.mock.calls.filter(([, options]) => options?.method === 'PATCH')).toHaveLength(1));
    await act(async () => { finish({ ...category, version: 1 }); });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

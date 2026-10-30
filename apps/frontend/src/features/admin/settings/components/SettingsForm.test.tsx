import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { ApiError } from '../../../../shared/api/client';
import type { AdminSettings, SettingsUpdateInput } from '../api/settings.api';
import { SettingsForm } from './SettingsForm';

const snapshot: AdminSettings = { shippingFeeVnd: 45000, bankDeadlineMinutes: 150, bankName: 'Ngân hàng thử',
  bankBin: '970422', bankAccountNumber: '12345678', bankAccountName: 'CONG TY THU', version: 2 };
const updated: AdminSettings = { ...snapshot, shippingFeeVnd: 51000, version: 3 };

type SaveFn = (input: SettingsUpdateInput, idempotencyKey: string) => Promise<AdminSettings>;
type SaveMock = Mock<SaveFn>;

const idleSave = vi.fn<SaveFn>(() => Promise.resolve(updated));
const rejectMissing = vi.fn<SaveFn>(() => { throw new Error('Should not call API'); });

function renderForm(save: SaveMock = idleSave, discardReload: () => void = vi.fn((): void => undefined)) {
  render(<SettingsForm snapshot={snapshot} onSave={save} onDiscardReload={discardReload} />);
  return { save, discardReload };
}

async function fill(overrides: Partial<Record<string, string>> = {}) {
  const labels = ['Phí giao hàng', 'Hạn chuyển khoản', 'Tên ngân hàng', 'Mã BIN', 'Số tài khoản', 'Tên chủ tài khoản'] as const;
  for (const label of labels) {
    const value = overrides[label];
    if (value === undefined) continue;
    const input = screen.getByLabelText(label);
    await userEvent.clear(input);
    if (value !== '') await userEvent.type(input, value); // clearing to '' needs no typing
  }
  await userEvent.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));
}

describe('settings form', () => {
  it('shows all six fields prefilled with the saved configuration', () => {
    renderForm();
    expect(screen.getByLabelText('Phí giao hàng')).toHaveValue('45000');
    expect(screen.getByLabelText('Hạn chuyển khoản')).toHaveValue('150');
    expect(screen.getByLabelText('Tên ngân hàng')).toHaveValue('Ngân hàng thử');
    expect(screen.getByLabelText('Mã BIN')).toHaveValue('970422');
    expect(screen.getByLabelText('Số tài khoản')).toHaveValue('12345678');
    expect(screen.getByLabelText('Tên chủ tài khoản')).toHaveValue('CONG TY THU');
    expect(screen.getByText(/báo giá và đơn hàng đã tạo giữ nguyên/)).toHaveTextContent('phiên bản 2');
  });

  it.each([
    { label: 'Phí giao hàng', value: '', message: 'Phí giao hàng phải là số nguyên.' },
    { label: 'Phí giao hàng', value: 'abc', message: 'Phí giao hàng phải là số nguyên.' },
    { label: 'Phí giao hàng', value: '-1', message: 'Phí giao hàng phải là số nguyên.' },
    { label: 'Phí giao hàng', value: '100000001', message: 'Phí giao hàng từ 0 đến 100.000.000 VNĐ.' },
    { label: 'Hạn chuyển khoản', value: '', message: 'Hạn chuyển khoản phải là số nguyên.' },
    { label: 'Hạn chuyển khoản', value: '14', message: 'Hạn chuyển khoản từ 15 đến 2880 phút.' },
    { label: 'Hạn chuyển khoản', value: '2881', message: 'Hạn chuyển khoản từ 15 đến 2880 phút.' },
    { label: 'Mã BIN', value: '97042', message: 'Mã BIN phải gồm 6 chữ số.' },
    { label: 'Mã BIN', value: '97042A', message: 'Mã BIN phải gồm 6 chữ số.' },
    { label: 'Số tài khoản', value: '12AB56', message: 'Số tài khoản chỉ gồm chữ số.' },
  ])('blocks an invalid save ($label="$value") and keeps the field editable', async ({ label, value, message }) => {
    const save = renderForm(rejectMissing);
    await fill({ [label]: value });
    expect(save.save).not.toHaveBeenCalled();
    expect(screen.getByLabelText(label)).toBeEnabled();
    expect(screen.getByText(message)).toBeVisible();
  });

  it('requires the bank group to be either fully filled or fully cleared', async () => {
    const save = renderForm(rejectMissing);
    await fill({ 'Mã BIN': '', 'Số tài khoản': '', 'Tên chủ tài khoản': '' });
    expect(save.save).not.toHaveBeenCalled(); // bank name alone is not a valid configuration
    expect(screen.getAllByText('Điền đủ 4 trường ngân hàng hoặc để trống toàn bộ.')).toHaveLength(3);
    expect(screen.getByLabelText('Mã BIN')).toBeEnabled();
  });

  it('sends trimmed values with the frozen version and a proper idempotency key', async () => {
    const save = renderForm();
    await fill({ 'Phí giao hàng': '51000', 'Tên ngân hàng': '  Ngân hàng TÂN  ' });
    expect(save.save).toHaveBeenCalledTimes(1);
    const [input, key] = save.save.mock.calls[0]!; // TS: non-null since call count asserted above
    expect(input).toEqual({ shippingFeeVnd: 51000, bankDeadlineMinutes: 150, bankName: 'Ngân hàng TÂN',
      bankBin: '970422', bankAccountNumber: '12345678', bankAccountName: 'CONG TY THU', expectedVersion: 2 });
    expect(key).toMatch(/^[A-Za-z0-9_-]{16,120}$/);
  });

  it('lets the whole bank group be cleared and sends empty strings', async () => {
    const cleared: AdminSettings = { shippingFeeVnd: 51000, bankDeadlineMinutes: 150, bankName: null,
      bankBin: null, bankAccountNumber: null, bankAccountName: null, version: 3 };
    const save = renderForm(vi.fn<SaveFn>(() => Promise.resolve(cleared)));
    await fill({ 'Tên ngân hàng': '', 'Mã BIN': '', 'Số tài khoản': '', 'Tên chủ tài khoản': '' });
    expect(await screen.findByText('Đã lưu cài đặt. Cấu hình mới áp dụng cho các đơn mới.')).toBeVisible();
    expect(save.save.mock.calls[0]![0]).toMatchObject({ bankName: '', bankBin: '', bankAccountNumber: '', bankAccountName: '' });
    expect(screen.getByLabelText('Tên ngân hàng')).toHaveValue('');
  });

  it('locks the form and blocks double submits while saving, then shows the served state', async () => {
    let finish: (value: AdminSettings) => void = () => { throw new Error('Save not requested'); };
    const save = renderForm(vi.fn<SaveFn>(() => new Promise<AdminSettings>((resolve) => { finish = resolve; })));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));
    expect(screen.getByRole('status')).toHaveTextContent('Đang lưu cài đặt…');
    expect(screen.getByLabelText('Phí giao hàng')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Lưu cài đặt' })).toBeDisabled(); // pointer-events: none, no second command
    await act(async () => { finish(updated); });
    expect(await screen.findByText('Đã lưu cài đặt. Cấu hình mới áp dụng cho các đơn mới.')).toBeVisible();
    expect(screen.getByLabelText('Phí giao hàng')).toBeEnabled();
    expect(save.save).toHaveBeenCalledTimes(1);
  });

  it('a saved response becomes the baseline and the next save uses a fresh key with the saved version', async () => {
    const save = renderForm();
    await fill({ 'Phí giao hàng': '51000' });
    expect(await screen.findByText('Đã lưu cài đặt. Cấu hình mới áp dụng cho các đơn mới.')).toBeVisible();
    expect(await screen.findByText(/báo giá và đơn hàng đã tạo giữ nguyên/)).toHaveTextContent('phiên bản 3');
    await userEvent.clear(screen.getByLabelText('Phí giao hàng'));
    await userEvent.type(screen.getByLabelText('Phí giao hàng'), '60000');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));
    expect(save.save).toHaveBeenCalledTimes(2);
    expect(save.save.mock.calls[1]![0]).toMatchObject({ shippingFeeVnd: 60000, expectedVersion: 3 });
    expect(save.save.mock.calls[1]![1]).not.toBe(save.save.mock.calls[0]![1]); // each deliberate save gets its own key
  });

  it('a background refetch never rebases the draft or the frozen expectedVersion', async () => {
    const save = vi.fn<SaveFn>(() => Promise.resolve(updated)); // local mock: no cross-test call leakage
    const view = render(<SettingsForm snapshot={snapshot} onSave={save} onDiscardReload={vi.fn()} />);
    // A newer configuration arrives as a background refetch; the component only sees a new prop,
    // and its frozen baseline/draft must survive untouched.
    await act(async () => {
      view.rerender(<SettingsForm snapshot={{ ...snapshot, shippingFeeVnd: 77777, version: 9 }} onSave={save} onDiscardReload={vi.fn()} />);
    });
    expect(screen.getByLabelText('Phí giao hàng')).toHaveValue('45000'); // draft from the first mount survives
    await fill({ 'Phí giao hàng': '51000' });
    expect(save.mock.calls[0]![0].expectedVersion).toBe(2);
    expect(save.mock.calls[0]![0].shippingFeeVnd).toBe(51000);
  });

  it('a lost response locks content down to resending the exact old command or reloading', async () => {
    const save = renderForm(vi.fn<SaveFn>(() => Promise.resolve(updated))
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.', 0)));
    await fill({ 'Phí giao hàng': '51000' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể kết nối');
    expect(screen.getByLabelText('Phí giao hàng')).toBeDisabled();
    expect(screen.getByLabelText('Phí giao hàng')).toHaveValue('51000'); // draft preserved behind the lock
    expect(await screen.findByRole('button', { name: 'Gửi lại' })).toBeVisible();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tải cấu hình mới' })).toBeVisible());
    expect(save.save).toHaveBeenCalledTimes(1); // nothing is retried automatically
    await userEvent.click(screen.getByRole('button', { name: 'Gửi lại' }));
    expect(await screen.findByText('Đã lưu cài đặt. Cấu hình mới áp dụng cho các đơn mới.')).toBeVisible();
    expect(save.save).toHaveBeenCalledTimes(2);
    expect(save.save.mock.calls[1]![0]).toEqual(save.save.mock.calls[0]![0]);
    expect(save.save.mock.calls[1]![1]).toBe(save.save.mock.calls[0]![1]);
  });

  it.each([
    new ApiError('SERVICE_UNAVAILABLE', 'Dịch vụ chưa sẵn sàng. Vui lòng thử lại sau ít phút.', 503),
    new ApiError('INVALID_RESPONSE', 'Chưa đọc được phản hồi. Vui lòng thử lại.', 200),
  ])('treats an unknown-outcome failure as unconfirmed and locked ($code)', async (error) => {
    renderForm(vi.fn<SaveFn>(() => Promise.reject(error)));
    await fill({ 'Phí giao hàng': '51000' });
    expect(await screen.findByRole('alert')).toHaveTextContent(error.message);
    expect(screen.getByLabelText('Phí giao hàng')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Gửi lại' })).toBeVisible();
  });

  it('a version conflict keeps the draft behind a reload offer and never retries on its own', async () => {
    const save = renderForm(vi.fn<SaveFn>(() => Promise.reject(new ApiError('CONFLICT', 'Phiên bản cấu hình đã thay đổi. Hãy tải cấu hình mới.', 409))));
    await fill({ 'Phí giao hàng': '51000' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Phiên bản cấu hình đã thay đổi');
    expect(screen.getByLabelText('Phí giao hàng')).toBeDisabled();
    expect(screen.getByLabelText('Phí giao hàng')).toHaveValue('51000'); // draft preserved
    expect(screen.queryByRole('button', { name: 'Gửi lại' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải cấu hình mới' })).toBeVisible();
    expect(save.save).toHaveBeenCalledTimes(1);
  });

  it('cancelling the reload keeps everything and does not trigger a discard', async () => {
    const discardReload = vi.fn((): void => undefined);
    renderForm(vi.fn<SaveFn>(() => Promise.reject(new ApiError('CONFLICT', 'Phiên bản cấu hình đã thay đổi.', 409))), discardReload);
    await fill({ 'Phí giao hàng': '51000' });
    await screen.findByRole('alert');
    expect(discardReload).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Tải cấu hình mới' }));
    expect(screen.getByRole('dialog', { name: 'Tải cấu hình mới?' })).toBeVisible();
    expect(screen.getByText(/Nội dung đang sửa chưa được lưu/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
    expect(discardReload).not.toHaveBeenCalled();
  });

  it('confirming the reload discards the draft exactly once', async () => {
    const discardReload = vi.fn((): void => undefined);
    renderForm(vi.fn<SaveFn>(() => Promise.reject(new ApiError('CONFLICT', 'Phiên bản cấu hình đã thay đổi.', 409))), discardReload);
    await fill({ 'Phí giao hàng': '51000' });
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: 'Tải cấu hình mới' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xoá và tải cấu hình mới' }));
    expect(discardReload).toHaveBeenCalledTimes(1);
  });

  it('a definitive 4xx keeps the form editable and the next save uses a fresh command', async () => {
    const save = renderForm(vi.fn<SaveFn>(() => Promise.resolve(updated))
      .mockRejectedValueOnce(new ApiError('VALIDATION_ERROR', 'Dữ liệu không hợp lệ. Kiểm tra lại các trường.', 400)));
    await fill({ 'Phí giao hàng': '51000' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Dữ liệu không hợp lệ');
    expect(screen.getByLabelText('Phí giao hàng')).toBeEnabled();
    expect(screen.getByLabelText('Phí giao hàng')).toHaveValue('51000');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));
    expect(await screen.findByText('Đã lưu cài đặt. Cấu hình mới áp dụng cho các đơn mới.')).toBeVisible();
    expect(save.save).toHaveBeenCalledTimes(2);
    expect(save.save.mock.calls[1]![1]).not.toBe(save.save.mock.calls[0]![1]);
  });
});

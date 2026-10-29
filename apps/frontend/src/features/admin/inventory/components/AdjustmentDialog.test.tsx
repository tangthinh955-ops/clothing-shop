import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { ApiError } from '../../../../shared/api/client';
import type { AdjustmentInput, AdjustmentResult, InventoryItem } from '../api/inventory.api';
import { AdjustmentDialog } from './AdjustmentDialog';

const stock: InventoryItem = { variantId: 'variant-one', sku: 'AO-M-DEN', size: 'M', color: 'đen',
  productName: 'Áo cotton', onHand: 12, reserved: 2, available: 10, version: 3 };
const updated: AdjustmentResult = { variantId: 'variant-one', onHand: 17, reserved: 2, available: 15, version: 4 };

type SaveFn = (input: AdjustmentInput, idempotencyKey: string) => Promise<AdjustmentResult>;
type SaveMock = Mock<SaveFn>;

const idleSave = vi.fn<SaveFn>(() => Promise.resolve(updated));

function renderDialog(save: SaveMock = idleSave, reload: () => void = vi.fn((): void => undefined),
  close: () => void = vi.fn((): void => undefined)) {
  render(<AdjustmentDialog stock={stock} onSave={save} onReload={reload} onClose={close} />);
  return { save, reload, close };
}

async function fillAndSubmit(delta: string, reason: string) {
  if (delta) await userEvent.type(screen.getByLabelText('Số lượng thay đổi'), delta);
  if (reason) await userEvent.type(screen.getByLabelText('Lý do điều chỉnh'), reason);
  await userEvent.click(screen.getByRole('button', { name: 'Lưu điều chỉnh' }));
}

describe('inventory adjustment dialog', () => {
  it('shows the row context, required fields and current stock', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Điều chỉnh AO-M-DEN' })).toBeVisible();
    expect(screen.getByText('Áo cotton', { exact: true })).toBeVisible();
    expect(screen.getByText('Còn bán: 10', { exact: true })).toBeVisible();
    expect(screen.getByLabelText('Số lượng thay đổi')).toBeVisible();
    expect(screen.getByLabelText('Lý do điều chỉnh')).toBeVisible();
  });

  it.each([
    { delta: '', reason: '' },
    { delta: '', reason: 'Lý do hợp lệ' },
    { delta: '0', reason: 'Lý do hợp lệ' },
    { delta: 'abc', reason: 'Lý do hợp lệ' },
    { delta: '1.5', reason: 'Lý do hợp lệ' },
    { delta: '1000001', reason: 'Lý do hợp lệ' },
    { delta: '5', reason: 'nh' },
  ])('blocks an invalid submission delta=$delta reason=$reason and keeps input editable', async ({ delta, reason }) => {
    const save: SaveMock = vi.fn<SaveFn>((input: AdjustmentInput) => Promise.reject(new Error(`Should not call API: ${input.delta}`)));
    renderDialog(save);
    await fillAndSubmit(delta, reason);
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Số lượng thay đổi')).toBeEnabled();
    expect(screen.getByLabelText('Lý do điều chỉnh')).toBeEnabled();
  });

  it('sends the frozen row version and content with a valid idempotency key', async () => {
    const save: SaveMock = vi.fn<SaveFn>(() => Promise.resolve(updated));
    const mocks = renderDialog(save);
    await fillAndSubmit('5', 'Nhập hàng thử');
    expect(mocks.save).toHaveBeenCalledTimes(1);
    const [input, key] = mocks.save.mock.calls[0]!; // TS: non-null since call count asserted above
    expect(input).toEqual({ variantId: 'variant-one', delta: 5, reason: 'Nhập hàng thử', expectedVersion: 3 });
    expect(key).toMatch(/^[A-Za-z0-9_-]{16,120}$/);
  });

  it('locks fields while saving, blocks resubmits and shows the new availability', async () => {
    let finish: (value: AdjustmentResult) => void = () => { throw new Error('Save not requested'); };
    const save: SaveMock = vi.fn<SaveFn>(() => new Promise<AdjustmentResult>((resolve) => { finish = resolve; }));
    renderDialog(save);
    await fillAndSubmit('5', 'Nhập hàng thử');
    expect(screen.getByLabelText('Số lượng thay đổi')).toBeDisabled();
    expect(screen.getByLabelText('Lý do điều chỉnh')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Lưu điều chỉnh' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled();
    await act(async () => finish(updated));
    expect(await screen.findByText('Khả dụng: 15', { exact: true })).toHaveAttribute('role', 'status');
  });

  it('closes a saved dialog without reloading the list', async () => {
    const mocks = renderDialog();
    await fillAndSubmit('5', 'Nhập hàng thử');
    await userEvent.click(await screen.findByRole('button', { name: 'Đóng' }));
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.reload).not.toHaveBeenCalled();
  });

  it('a network failure locks content down to resend or close-and-refresh only', async () => {
    const save: SaveMock = vi.fn<SaveFn>(() => Promise.reject(new ApiError('NETWORK_ERROR', 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.', 0)));
    const mocks = renderDialog(save);
    await fillAndSubmit('5', 'Nhập hàng thử');
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.');
    expect(screen.getByLabelText('Số lượng thay đổi')).toBeDisabled();
    expect(screen.getByLabelText('Lý do điều chỉnh')).toBeDisabled();
    expect(await screen.findByRole('button', { name: 'Gửi lại' })).toBeVisible();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Đóng và tải lại tồn' })).toBeVisible());
    expect(screen.queryByRole('button', { name: 'Hủy' })).not.toBeInTheDocument();
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it('resends the identical key and body after a lost response', async () => {
    const save: SaveMock = vi.fn<SaveFn>(() => Promise.reject(new Error('Unexpected call')))
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'Không thể kết nối.', 0))
      .mockResolvedValueOnce(updated);
    const mocks = renderDialog(save);
    await fillAndSubmit('5', 'Nhập hàng thử');
    await userEvent.click(await screen.findByRole('button', { name: 'Gửi lại' }));
    await screen.findByText('Khả dụng: 15', { exact: true });
    expect(mocks.save).toHaveBeenCalledTimes(2);
    const first = mocks.save.mock.calls[0]!; // asserted call count above
    const second = mocks.save.mock.calls[1]!;
    expect(second[0]).toEqual(first[0]);
    expect(second[1]).toBe(first[1]);
  });

  it.each([
    new ApiError('CONFLICT', 'Kho đã thay đổi. Hãy tải lại tồn trước khi điều chỉnh.', 409),
    new ApiError('CONFLICT', 'Tồn kho không được âm, nhỏ hơn lượng đang giữ hoặc vượt 1.000.000.', 409),
  ])('a conflict shows the server message with reload only, never a resend', async (error) => {
    const save: SaveMock = vi.fn<SaveFn>(() => Promise.reject(error));
    const mocks = renderDialog(save);
    await fillAndSubmit('5', 'Nhập hàng thử');
    expect(await screen.findByRole('alert')).toHaveTextContent(error.message);
    expect(screen.queryByRole('button', { name: 'Gửi lại' })).not.toBeInTheDocument();
    const reloadButton = screen.getByRole('button', { name: 'Đóng và tải lại tồn' });
    expect(reloadButton).toBeVisible();
    await userEvent.click(reloadButton);
    expect(mocks.reload).toHaveBeenCalledTimes(1);
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it('treats an unexpected server failure as unconfirmed and locked', async () => {
    const save: SaveMock = vi.fn<SaveFn>(() => Promise.reject(new ApiError('SERVICE_UNAVAILABLE', 'Dịch vụ chưa sẵn sàng. Vui lòng thử lại sau ít phút.', 503)));
    renderDialog(save);
    await fillAndSubmit('5', 'Nhập hàng thử');
    expect(await screen.findByRole('alert')).toHaveTextContent('Dịch vụ chưa sẵn sàng.');
    expect(screen.getByRole('button', { name: 'Gửi lại' })).toBeVisible();
    expect(screen.getByLabelText('Số lượng thay đổi')).toBeDisabled();
  });

  it.each([
    new ApiError('NETWORK_ERROR', 'Không thể kết nối.', 0),
    new ApiError('CONFLICT', 'Kho đã thay đổi. Hãy tải lại tồn trước khi điều chỉnh.', 409),
  ])('Escape after an unconfirmed or conflicting save reloads stock instead of closing silently', async (error) => {
    const save: SaveMock = vi.fn<SaveFn>(() => Promise.reject(error));
    const mocks = renderDialog(save);
    await fillAndSubmit('5', 'Nhập hàng thử');
    await screen.findByRole('alert');
    // In the browser MUI keeps focus inside the dialog; jsdom loses it when fields disable, so focus a control first.
    screen.getByRole('button', { name: 'Đóng và tải lại tồn' }).focus();
    await userEvent.keyboard('{Escape}');
    expect(mocks.reload).toHaveBeenCalledTimes(1);
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it('cancelling an idle submission closes without reload', async () => {
    const mocks = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.reload).not.toHaveBeenCalled();
  });
});

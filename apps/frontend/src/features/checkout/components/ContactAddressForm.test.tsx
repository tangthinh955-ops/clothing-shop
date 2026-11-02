import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ContactDraft } from '../hooks/useCreateOrder';
import { ContactAddressForm } from './ContactAddressForm';

// Checkout recipient form: nothing is marked as wrong before the shopper interacts, a blurred field
// reports only its own problem, submit validates everything (and focuses the first mistake without
// calling the page), and province + ward are picked from the current two-level administrative lists.
// Typed search text alone is never a value. A server field error disappears once that field is edited.

const EMPTY: ContactDraft = { name: '', phone: '', email: '', province: '',
  ward: '', addressLine: '', note: '' };

function renderForm(initial: Partial<ContactDraft> = {},
  serverErrors: Record<string, string> = {}) {
  const submitted = vi.fn();
  function Harness() {
    const [draft, setDraft] = useState<ContactDraft>({ ...EMPTY, ...initial });
    return <ContactAddressForm value={draft} disabled={false} serverErrors={serverErrors}
      onChange={setDraft} onSubmit={submitted} submitDisabled={false} submitLabel="Đặt hàng COD" />;
  }
  render(<Harness />);
  return { submitted };
}

async function chooseOption(label: string, name: string) {
  const combobox = screen.getByRole('combobox', { name: label });
  // Real typing always starts with the input focused; MUI syncs an unfocused input back to the
  // selected value, so focus first or a second search would silently keep the old value.
  fireEvent.focus(combobox);
  fireEvent.change(combobox, { target: { value: name } });
  fireEvent.keyDown(combobox, { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name }));
  return combobox;
}

const chooseProvince = (name: string) => chooseOption('Tỉnh/thành', name);
const chooseWard = (name: string) => chooseOption('Phường/xã/đặc khu', name);

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText('Họ tên'), { target: { value: 'Nguyễn Thử' } });
  fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0901234567' } });
  fireEvent.change(screen.getByLabelText('Địa chỉ cụ thể'), { target: { value: '12 Nguyễn Huệ' } });
}

describe('ContactAddressForm', () => {
  it('does not mark or describe a field before the shopper interacts with it', () => {
    renderForm();
    for (const label of ['Họ tên', 'Số điện thoại', 'Email (không bắt buộc)', 'Tỉnh/thành',
      'Phường/xã/đặc khu', 'Địa chỉ cụ thể']) {
      expect(screen.getByLabelText(label)).not.toHaveAttribute('aria-invalid', 'true');
    }
    expect(screen.queryByLabelText('Quận/huyện (không bắt buộc)')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Phường/xã/đặc khu' })).toBeDisabled();
    expect(screen.queryByText('Họ tên từ 2 đến 120 ký tự.')).not.toBeInTheDocument();
    expect(screen.queryByText('Chọn tỉnh/thành từ danh sách.')).not.toBeInTheDocument();
    expect(screen.queryByText('Chọn phường/xã/đặc khu từ danh sách.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Thông tin nhận hàng chưa hợp lệ/)).not.toBeInTheDocument();
  });

  it('reports one field after blur and clears it as soon as the value is corrected', () => {
    renderForm();
    const name = screen.getByLabelText('Họ tên');
    fireEvent.blur(name);
    expect(screen.getByText('Họ tên từ 2 đến 120 ký tự.')).toBeVisible();
    expect(screen.queryByText('Số điện thoại Việt Nam chưa hợp lệ.')).not.toBeInTheDocument();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(name, { target: { value: 'Nguyễn Thử' } });
    expect(screen.queryByText('Họ tên từ 2 đến 120 ký tự.')).not.toBeInTheDocument();
    expect(name).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('validates every field on submit, focuses the first mistake and never calls the page', async () => {
    const { submitted } = renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' }));
    expect(submitted).not.toHaveBeenCalled();
    expect(screen.getByText('Họ tên từ 2 đến 120 ký tự.')).toBeVisible();
    expect(screen.getByText('Số điện thoại Việt Nam chưa hợp lệ.')).toBeVisible();
    expect(screen.getByText('Chọn tỉnh/thành từ danh sách.')).toBeVisible();
    expect(screen.getByText('Chọn phường/xã/đặc khu từ danh sách.')).toBeVisible();
    expect(screen.getByText('Địa chỉ cụ thể từ 5 đến 255 ký tự.')).toBeVisible();
    expect(screen.queryByText('Email chưa hợp lệ.')).not.toBeInTheDocument(); // optional stays clean
    expect(screen.getByText(/Thông tin nhận hàng chưa hợp lệ/)).toBeVisible();
    expect(screen.getByLabelText('Họ tên')).toHaveFocus();
    // Fixing the first field moves the focus to the next remaining mistake on the next submit.
    fireEvent.change(screen.getByLabelText('Họ tên'), { target: { value: 'Nguyễn Thử' } });
    await userEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' }));
    expect(screen.getByLabelText('Số điện thoại')).toHaveFocus();
    expect(submitted).not.toHaveBeenCalled();
  });

  it('accepts a province and a ward only when each is picked from its list', async () => {
    const { submitted } = renderForm();
    fillRequiredFields();
    const province = screen.getByRole('combobox', { name: 'Tỉnh/thành' });
    fireEvent.change(province, { target: { value: 'Hồ Chí Minh' } });
    fireEvent.blur(province); // typed search text is not a selection
    expect(screen.getByText('Chọn tỉnh/thành từ danh sách.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' }));
    expect(submitted).not.toHaveBeenCalled();
    expect(province).toHaveFocus();
    await chooseProvince('TP. Hồ Chí Minh');
    expect(screen.queryByText('Chọn tỉnh/thành từ danh sách.')).not.toBeInTheDocument();
    expect(province).toHaveValue('TP. Hồ Chí Minh');

    const ward = screen.getByRole('combobox', { name: 'Phường/xã/đặc khu' });
    expect(ward).toBeEnabled();
    fireEvent.change(ward, { target: { value: 'Bến Thành' } });
    fireEvent.blur(ward); // typed but not picked: the previous empty value stays
    await userEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' }));
    expect(submitted).not.toHaveBeenCalled();
    expect(screen.getByText('Chọn phường/xã/đặc khu từ danh sách.')).toBeVisible();
    expect(ward).toHaveFocus();

    await chooseWard('Phường Bến Thành');
    expect(screen.queryByText('Chọn phường/xã/đặc khu từ danh sách.')).not.toBeInTheDocument();
    expect(ward).toHaveValue('Phường Bến Thành');
    await userEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' }));
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(submitted.mock.calls[0]![0]).toMatchObject({
      province: 'TP. Hồ Chí Minh', ward: 'Phường Bến Thành',
    });
    expect(submitted.mock.calls[0]![0]).not.toHaveProperty('district');
  });

  it('clears the old ward when the province changes and sends only the new pair', async () => {
    const { submitted } = renderForm();
    fillRequiredFields();
    await chooseProvince('Hà Nội');
    const ward = await chooseWard('Phường Hoàn Kiếm');
    await chooseProvince('Cần Thơ');
    expect(ward).toHaveValue(''); // the old ward belonged to Hà Nội
    await chooseWard('Phường Ninh Kiều');
    await userEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' }));
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(submitted.mock.calls[0]![0]).toMatchObject({
      province: 'Cần Thơ', ward: 'Phường Ninh Kiều',
    });
  });

  it('blocks a stale province and never sends the old province or ward', async () => {
    const { submitted } = renderForm();
    fillRequiredFields();
    await chooseProvince('Hà Nội');
    await chooseWard('Phường Hoàn Kiếm');
    const province = screen.getByRole('combobox', { name: 'Tỉnh/thành' });
    fireEvent.change(province, { target: { value: 'xyz' } }); // typed over the selected province
    fireEvent.submit(screen.getByRole('form', { name: 'Thông tin nhận hàng' }));
    expect(submitted).not.toHaveBeenCalled();
    expect(screen.getByText('Chọn tỉnh/thành từ danh sách.')).toBeVisible();
    expect(province).toHaveFocus();
    expect(province).toHaveValue('xyz');
    // Correcting the picker drops the old ward and sends only the newly picked pair.
    await chooseProvince('Cần Thơ');
    expect(screen.queryByText('Chọn tỉnh/thành từ danh sách.')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Phường/xã/đặc khu' })).toHaveValue('');
    await chooseWard('Phường Ninh Kiều');
    await userEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' }));
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(submitted.mock.calls[0]![0]).toMatchObject({
      province: 'Cần Thơ', ward: 'Phường Ninh Kiều',
    });
  });

  it('blocks a stale ward when the search text no longer matches the picked value', async () => {
    const { submitted } = renderForm();
    fillRequiredFields();
    await chooseProvince('TP. Hồ Chí Minh');
    await chooseWard('Phường Bến Thành');
    const ward = screen.getByRole('combobox', { name: 'Phường/xã/đặc khu' });
    fireEvent.change(ward, { target: { value: 'xyz' } }); // typed over the selected ward
    fireEvent.submit(screen.getByRole('form', { name: 'Thông tin nhận hàng' }));
    expect(submitted).not.toHaveBeenCalled();
    expect(screen.getByText('Chọn phường/xã/đặc khu từ danh sách.')).toBeVisible();
    expect(ward).toHaveFocus();
    expect(ward).toHaveValue('xyz');
    await chooseWard('Phường Tân Định');
    await userEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' }));
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(submitted.mock.calls[0]![0]).toMatchObject({
      province: 'TP. Hồ Chí Minh', ward: 'Phường Tân Định',
    });
  });

  it('hides a server field error as soon as that field is edited', () => {
    renderForm(
      { name: 'Nguyễn Thử', phone: '0901234567', province: 'TP. Hồ Chí Minh',
        ward: 'Phường Bến Thành', addressLine: '12 Nguyễn Huệ' },
      { 'contact.name': 'Tên bị máy chủ từ chối.', 'address.ward': 'Phường/xã bị máy chủ từ chối.' },
    );
    expect(screen.getByText('Tên bị máy chủ từ chối.')).toBeVisible();
    expect(screen.getByText('Phường/xã bị máy chủ từ chối.')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0901234568' } });
    // Editing one field must not dismiss errors belonging to another field.
    expect(screen.getByText('Tên bị máy chủ từ chối.')).toBeVisible();
    expect(screen.getByText('Phường/xã bị máy chủ từ chối.')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Họ tên'), { target: { value: 'Nguyễn Thử 2' } });
    expect(screen.queryByText('Tên bị máy chủ từ chối.')).not.toBeInTheDocument();
    expect(screen.getByText('Phường/xã bị máy chủ từ chối.')).toBeVisible();
    fireEvent.change(screen.getByRole('combobox', { name: 'Phường/xã/đặc khu' }),
      { target: { value: 'Phường Tân Định' } });
    expect(screen.queryByText('Phường/xã bị máy chủ từ chối.')).not.toBeInTheDocument();
  });
});

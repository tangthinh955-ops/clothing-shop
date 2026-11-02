import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ContactDraft } from '../hooks/useCreateOrder';
import { ContactAddressForm } from './ContactAddressForm';

// Checkout recipient form: nothing is marked as wrong before the shopper interacts, a blurred field
// reports only its own problem, submit validates everything (and focuses the first mistake without
// calling the page), and the province is picked from the searchable list of the 34 current units.
// Typed search text alone is never a province. The optional district is manual for every province
// and is cleared when the province changes. A server field error disappears once that field is edited.

const EMPTY: ContactDraft = { name: '', phone: '', email: '', province: '', district: '',
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

async function chooseProvince(name: string) {
  const combobox = screen.getByRole('combobox', { name: 'Tỉnh/thành' });
  // Real typing always starts with the input focused; MUI syncs an unfocused input back to the
  // selected value, so focus first or a second search would silently keep the old province.
  fireEvent.focus(combobox);
  fireEvent.change(combobox, { target: { value: name } });
  fireEvent.keyDown(combobox, { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name }));
  return combobox;
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText('Họ tên'), { target: { value: 'Nguyễn Thử' } });
  fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0901234567' } });
  fireEvent.change(screen.getByLabelText('Phường/xã'), { target: { value: 'Phường Bến Nghé' } });
  fireEvent.change(screen.getByLabelText('Địa chỉ cụ thể'), { target: { value: '12 Nguyễn Huệ' } });
}

describe('ContactAddressForm', () => {
  it('does not mark or describe a field before the shopper interacts with it', () => {
    renderForm();
    for (const label of ['Họ tên', 'Số điện thoại', 'Email (không bắt buộc)', 'Tỉnh/thành',
      'Quận/huyện (không bắt buộc)', 'Phường/xã', 'Địa chỉ cụ thể']) {
      expect(screen.getByLabelText(label)).not.toHaveAttribute('aria-invalid', 'true');
    }
    expect(screen.queryByText('Họ tên từ 2 đến 120 ký tự.')).not.toBeInTheDocument();
    expect(screen.queryByText('Chọn tỉnh/thành từ danh sách.')).not.toBeInTheDocument();
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
    expect(screen.getByText('Phường/xã từ 2 đến 100 ký tự.')).toBeVisible();
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

  it('accepts a province only when it is picked from the list', async () => {
    const { submitted } = renderForm();
    fillRequiredFields();
    const combobox = screen.getByRole('combobox', { name: 'Tỉnh/thành' });
    fireEvent.change(combobox, { target: { value: 'Hồ Chí Minh' } });
    fireEvent.blur(combobox); // typed search text is not a selection
    expect(screen.getByText('Chọn tỉnh/thành từ danh sách.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' }));
    expect(submitted).not.toHaveBeenCalled();
    expect(screen.getByText('Chọn tỉnh/thành từ danh sách.')).toBeVisible();
    expect(combobox).toHaveFocus(); // the province input is the first remaining mistake
    await chooseProvince('TP. Hồ Chí Minh');
    expect(screen.queryByText('Chọn tỉnh/thành từ danh sách.')).not.toBeInTheDocument();
    expect(combobox).toHaveValue('TP. Hồ Chí Minh');
    await userEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' }));
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(submitted.mock.calls[0]![0]).toMatchObject({ province: 'TP. Hồ Chí Minh', district: '' });
  });

  it('blocks a stale province when the search text no longer matches the picked value', async () => {
    const { submitted } = renderForm();
    fillRequiredFields();
    const combobox = await chooseProvince('Hà Nội');
    const district = screen.getByLabelText('Quận/huyện (không bắt buộc)');
    fireEvent.change(district, { target: { value: 'Quận Hoàn Kiếm' } });
    fireEvent.change(combobox, { target: { value: 'xyz' } }); // typed over the selected province
    fireEvent.submit(screen.getByRole('form', { name: 'Thông tin nhận hàng' }));
    expect(submitted).not.toHaveBeenCalled();
    expect(screen.getByText('Chọn tỉnh/thành từ danh sách.')).toBeVisible();
    expect(combobox).toHaveFocus();
    expect(combobox).toHaveValue('xyz');
    // Correcting the picker drops the old district and sends only the newly picked province.
    await chooseProvince('Cần Thơ');
    expect(screen.queryByText('Chọn tỉnh/thành từ danh sách.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Quận/huyện (không bắt buộc)')).toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' }));
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(submitted.mock.calls[0]![0]).toMatchObject({ province: 'Cần Thơ', district: '' });
  });

  it('keeps the district manual and optional for every province, clearing it on province change', async () => {
    const { submitted } = renderForm();
    fillRequiredFields();
    expect(screen.getByLabelText('Quận/huyện (không bắt buộc)')).toHaveValue('');
    await chooseProvince('Hà Nội');
    const district = screen.getByLabelText('Quận/huyện (không bắt buộc)');
    fireEvent.change(district, { target: { value: 'Quận Hoàn Kiếm' } });
    expect(district).toHaveValue('Quận Hoàn Kiếm');
    await chooseProvince('TP. Hồ Chí Minh'); // still allowed, but the old value must be gone
    expect(screen.getByLabelText('Quận/huyện (không bắt buộc)')).toHaveValue('');
    await chooseProvince('Cần Thơ'); // manual for every province, not only the two cities
    const canThoDistrict = screen.getByLabelText('Quận/huyện (không bắt buộc)');
    expect(canThoDistrict).toHaveValue('');
    fireEvent.change(canThoDistrict, { target: { value: 'Quận Ninh Kiều' } });
    await userEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' }));
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(submitted.mock.calls[0]![0]).toMatchObject({ province: 'Cần Thơ', district: 'Quận Ninh Kiều' });
  });

  it('hides a server field error as soon as that field is edited', () => {
    renderForm(
      { name: 'Nguyễn Thử', phone: '0901234567', province: 'Hà Nội',
        ward: 'Phường Bến Nghé', addressLine: '12 Nguyễn Huệ' },
      { 'contact.name': 'Tên bị máy chủ từ chối.', 'address.addressLine': 'Địa chỉ bị máy chủ từ chối.' },
    );
    expect(screen.getByText('Tên bị máy chủ từ chối.')).toBeVisible();
    expect(screen.getByText('Địa chỉ bị máy chủ từ chối.')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0901234568' } });
    // Editing one field must not dismiss errors belonging to another field.
    expect(screen.getByText('Tên bị máy chủ từ chối.')).toBeVisible();
    expect(screen.getByText('Địa chỉ bị máy chủ từ chối.')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Họ tên'), { target: { value: 'Nguyễn Thử 2' } });
    expect(screen.queryByText('Tên bị máy chủ từ chối.')).not.toBeInTheDocument();
    expect(screen.getByText('Địa chỉ bị máy chủ từ chối.')).toBeVisible();
  });
});

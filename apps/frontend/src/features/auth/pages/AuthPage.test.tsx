import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { authApi } from '../api/auth.api';
import { AuthPage } from './AuthPage';

afterEach(() => vi.restoreAllMocks());

function NextResetLink() {
  const navigate = useNavigate();
  return <button onClick={() => { void navigate('/reset-password#token=new-reset-token'); }}>Mở liên kết reset mới</button>;
}

it('shows a fresh password form for a new reset link after an earlier success', async () => {
  const reset = vi.spyOn(authApi, 'reset').mockResolvedValue({ message: 'Mật khẩu đã được cập nhật.' });
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/reset-password#token=old-reset-token']}>
    <NextResetLink /><AuthPage mode="reset" />
  </MemoryRouter></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'first-password-123!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }));
  await screen.findByText('Mật khẩu đã được cập nhật.');
  fireEvent.click(screen.getByRole('button', { name: 'Mở liên kết reset mới' }));
  const input = await screen.findByLabelText('Mật khẩu mới');
  expect(input).toHaveValue('');
  fireEvent.change(input, { target: { value: 'second-password-123!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }));
  await waitFor(() => expect(reset).toHaveBeenLastCalledWith('new-reset-token', 'second-password-123!'));
});

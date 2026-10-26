import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../shared/api/client';
import { AuthForm } from './AuthForm';

describe('auth form feedback', () => {
  it('keeps entered values and displays server validation beside the affected field', async () => {
    render(<AuthForm mode="login" onSubmit={async () => {
      throw new ApiError('VALIDATION_ERROR', 'Thông tin chưa hợp lệ.', 400,
        [{ field: 'email', message: 'Email chưa hợp lệ.' }]);
    }} />);
    await userEvent.type(screen.getByLabelText('Email'), 'customer@example.test');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'long-password-123');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('Email chưa hợp lệ.')).toBeVisible();
    expect(screen.getByLabelText('Email')).toHaveValue('customer@example.test');
    expect(screen.getByLabelText('Mật khẩu')).toHaveValue('long-password-123');
  });

  it('prevents duplicate submits while the original request is pending', async () => {
    let finish: (() => void) | undefined;
    let submitted = 0;
    render(<AuthForm mode="login" onSubmit={() => {
      submitted += 1;
      return new Promise<void>((resolve) => { finish = resolve; });
    }} />);
    await userEvent.type(screen.getByLabelText('Email'), 'customer@example.test');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'long-password-123');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(screen.getByRole('button')).toBeDisabled();
    fireEvent.submit(screen.getByRole('button').closest('form')!);
    expect(submitted).toBe(1);
    await act(async () => { finish?.(); });
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeEnabled();
  });
});

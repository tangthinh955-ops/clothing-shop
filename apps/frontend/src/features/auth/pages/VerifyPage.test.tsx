import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../api/auth.api';
import { VerifyPage } from './VerifyPage';

afterEach(() => vi.restoreAllMocks());

function NextLink() {
  const navigate = useNavigate();
  return <button onClick={() => { void navigate('/verify-email#token=second-token'); }}>Mở liên kết mới</button>;
}
function renderPage() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/verify-email#token=first-token']}><NextLink /><VerifyPage /></MemoryRouter>
  </QueryClientProvider>);
}

describe('verification link changes', () => {
  it('clears an earlier success and verifies the new link', async () => {
    const verify = vi.spyOn(authApi, 'verify').mockResolvedValue({ message: 'Email đã được xác minh.' });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Xác minh email' }));
    await screen.findByText('Email đã được xác minh.');
    fireEvent.click(screen.getByRole('button', { name: 'Mở liên kết mới' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Xác minh email' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Xác minh email' }));
    await waitFor(() => expect(verify).toHaveBeenLastCalledWith('second-token'));
  });

  it('does not display an old in-flight result over the new link', async () => {
    let finishOld: (value: { message: string }) => void = () => { throw new Error('Request not started'); };
    vi.spyOn(authApi, 'verify').mockImplementation(() => new Promise((resolve) => { finishOld = resolve; }));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Xác minh email' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mở liên kết mới' }));
    await act(async () => { finishOld({ message: 'Kết quả của liên kết cũ' }); });
    expect(screen.queryByText('Kết quả của liên kết cũ')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xác minh email' })).toBeEnabled();
  });
});

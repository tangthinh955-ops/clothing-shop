import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as client from '../../../shared/api/client';
import { CartProvider } from '../CartProvider';
import { CART_STORAGE_KEY } from '../cart-store';
import { CartPage } from './CartPage';

const variantA = '17bfecab-9df4-4de4-bd91-3c11116fca5b';
const variantB = '98d3a8f8-8ac2-4a54-b9e4-34d3fcb8816f';
const variantC = '24d0b13c-6a83-4bbf-9c05-4b1b9e9db93f';

const rowA = {
  variantId: variantA, status: 'AVAILABLE', available: 4,
  product: { name: 'Áo cotton', slug: 'ao-cotton' }, sku: 'CART-A-1', size: 'M', color: 'Đen',
  price: 200000, image: { url: '/api/v1/media/asset-1' },
};
const rowC = {
  variantId: variantC, status: 'EXCEEDS_STOCK', available: 1,
  product: { name: 'Quần jean', slug: 'quan-jean' }, sku: 'JEAN-1', size: 'L', color: 'Xanh',
  price: 400000, image: null,
};

function seed(items: { variantId: string; quantity: number }[]) {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, items }));
}

function renderPage(items?: { variantId: string; quantity: number }[]) {
  if (items) seed(items);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/cart']}>
      <CartProvider><CartPage /></CartProvider>
    </MemoryRouter>
  </QueryClientProvider>);
}

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => vi.restoreAllMocks());

describe('cart page', () => {
  it('preserves an unfinished quantity while the current cart refetches', async () => {
    const request = vi.spyOn(client, 'request').mockResolvedValue({ items: [rowA] });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    seed([{ variantId: variantA, quantity: 2 }]);
    render(<QueryClientProvider client={queryClient}><MemoryRouter><CartProvider><CartPage /></CartProvider></MemoryRouter></QueryClientProvider>);
    const field = await screen.findByRole('textbox', { name: 'Số lượng của Áo cotton' });
    fireEvent.change(field, { target: { value: '12' } });
    let finish: (value: unknown) => void = () => undefined;
    request.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    void queryClient.invalidateQueries({ queryKey: ['shop-cart-resolve'] });
    await screen.findByText('Đang cập nhật giá…');
    expect(screen.getByRole('textbox', { name: 'Số lượng của Áo cotton' })).toHaveValue('12');
    expect(screen.queryByText(/^200\.000\s*₫ \/ chiếc$/)).not.toBeInTheDocument();
    await act(async () => { finish({ items: [rowA] }); });
    expect(screen.getByRole('textbox', { name: 'Số lượng của Áo cotton' })).toHaveValue('12');
  });
  it('lets a customer enter a two-digit quantity without losing the field during refresh', async () => {
    const user = userEvent.setup();
    vi.spyOn(client, 'request').mockResolvedValue({ items: [rowA] });
    renderPage([{ variantId: variantA, quantity: 2 }]);
    const field = await screen.findByRole('textbox', { name: 'Số lượng của Áo cotton' });
    await user.clear(field);
    await user.type(field, '12');
    await user.tab();
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '').items[0].quantity).toBe(12));
  });
  it('does not change a quantity when the entered text is fractional or has a suffix', async () => {
    vi.spyOn(client, 'request').mockResolvedValue({ items: [rowA] });
    renderPage([{ variantId: variantA, quantity: 2 }]);
    const field = await screen.findByRole('textbox', { name: 'Số lượng của Áo cotton' });
    fireEvent.change(field, { target: { value: '1.5' } });
    expect(field).toHaveAccessibleDescription('Số lượng từ 1 đến 99.');
    expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '').items[0].quantity).toBe(2);
    fireEvent.change(field, { target: { value: '2abc' } });
    expect(field).toHaveAccessibleDescription('Số lượng từ 1 đến 99.');
    expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '').items[0].quantity).toBe(2);
  });

  it('hides cached prices when a background reload fails', async () => {
    const request = vi.spyOn(client, 'request').mockResolvedValue({ items: [rowA] });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    seed([{ variantId: variantA, quantity: 2 }]);
    render(<QueryClientProvider client={queryClient}><MemoryRouter><CartProvider><CartPage /></CartProvider></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText(/^200\.000\s*₫ \/ chiếc$/)).toBeVisible();
    request.mockRejectedValue(new Error('offline'));
    await queryClient.invalidateQueries({ queryKey: ['shop-cart-resolve'] });
    await screen.findByText(/Chưa đọc được giá và tình trạng/);
    expect(screen.queryByText(/^200\.000\s*₫ \/ chiếc$/)).not.toBeInTheDocument();
  });
  it('welcomes an empty cart without any network call', () => {
    const request = vi.spyOn(client, 'request');
    renderPage();
    expect(screen.getByRole('heading', { name: 'Giỏ hàng trống' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Xem sản phẩm' })).toHaveAttribute('href', '/shop');
    expect(request).not.toHaveBeenCalled();
  });

  it('sells the rows with live prices and a subtotal of what is still buyable', async () => {
    const request = vi.spyOn(client, 'request').mockResolvedValue({
      items: [rowA, { ...rowC, status: 'AVAILABLE', available: 4 }],
    });
    renderPage([{ variantId: variantA, quantity: 2 }, { variantId: variantC, quantity: 1 }]);
    expect(await screen.findByRole('link', { name: 'Áo cotton' })).toHaveAttribute('href', '/products/ao-cotton');
    expect(await screen.findByRole('link', { name: 'Quần jean' })).toBeVisible();
    expect(screen.getByText(/^200\.000\s*₫ \/ chiếc$/)).toBeVisible();
    expect(screen.getByText(/^Tạm tính:/)).toHaveTextContent('800.000');
    expect(screen.getByText(/Tạm tính dựa trên giá hiện tại, chưa gồm phí giao hàng\./)).toBeVisible();
    expect(request).toHaveBeenCalledWith('/cart/resolve', { method: 'POST', body: {
      items: [{ variantId: variantA, quantity: 2 }, { variantId: variantC, quantity: 1 }],
    } });
  });

  it('excludes unavailable rows from the subtotal without hiding their place', async () => {
    vi.spyOn(client, 'request').mockResolvedValue({
      items: [rowA, { variantId: variantB, status: 'UNAVAILABLE' }],
    });
    renderPage([{ variantId: variantA, quantity: 2 }, { variantId: variantB, quantity: 3 }]);
    await screen.findByRole('link', { name: 'Áo cotton' });
    expect(screen.getByText('Sản phẩm không truy cập được')).toBeVisible();
    expect(screen.getByText('3 chiếc')).toBeVisible();
    expect(screen.queryByText(/^Tạm tính:/)).not.toBeInTheDocument();
    expect(screen.getByText('Chưa thể tính đủ giỏ vì có sản phẩm không còn bán.')).toBeVisible();
    // An unavailable row keeps only the removal action; its price is gone by contract.
    expect(screen.queryByLabelText('Số lượng của dòng')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xóa dòng này khỏi giỏ' })).toBeVisible();
  });

  it('reports rows the shop can no longer fulfil at the requested quantity', async () => {
    vi.spyOn(client, 'request').mockResolvedValue({ items: [rowC] });
    renderPage([{ variantId: variantC, quantity: 2 }]);
    expect(await screen.findByText('Chỉ còn 1 chiếc')).toBeVisible();
    expect(screen.getByText(/^Giỏ có 2 nhưng chỉ còn 1 chiếc$/)).toBeVisible();
  });

  it('applies a new quantity to the right row and recomputes the subtotal', async () => {
    const user = userEvent.setup();
    vi.spyOn(client, 'request').mockResolvedValue({ items: [rowA, rowC] });
    renderPage([{ variantId: variantA, quantity: 2 }, { variantId: variantC, quantity: 1 }]);
    await screen.findByRole('link', { name: 'Áo cotton' });
    const field = screen.getByRole('textbox', { name: 'Số lượng của Áo cotton' });
    await user.clear(field);
    await user.type(field, '3');
    await user.tab();
    await waitFor(() => expect(screen.getByText(/^Tạm tính:/)).toHaveTextContent('1.000.000'));
    expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '')).toEqual({ schemaVersion: 1, items: [
      { variantId: variantA, quantity: 3 }, { variantId: variantC, quantity: 1 },
    ] });
  });

  it('treats quantity 0 and text as errors, never as a removal', async () => {
    const user = userEvent.setup();
    vi.spyOn(client, 'request').mockResolvedValue({ items: [rowA] });
    renderPage([{ variantId: variantA, quantity: 2 }]);
    await screen.findByRole('link', { name: 'Áo cotton' });
    const field = screen.getByRole('textbox', { name: 'Số lượng của Áo cotton' });
    await user.clear(field);
    await user.type(field, '0');
    expect(field).toHaveAccessibleDescription('Số lượng từ 1 đến 99.');
    await user.type(field, '{backspace}abc');
    await userEvent.click(screen.getByRole('heading', { name: 'Giỏ hàng của bạn' }));
    // The committed row survives a bad edit; removal stays the explicit button's job.
    expect(screen.getByRole('link', { name: 'Áo cotton' })).toBeVisible();
    expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '')).toEqual({ schemaVersion: 1, items: [
      { variantId: variantA, quantity: 2 },
    ] });
  });

  it('removes a row explicitly and reaches the empty state after the last removal', async () => {
    const user = userEvent.setup();
    vi.spyOn(client, 'request').mockResolvedValue({ items: [rowA] });
    renderPage([{ variantId: variantA, quantity: 2 }]);
    await screen.findByRole('link', { name: 'Áo cotton' });
    await user.click(screen.getByRole('button', { name: 'Xóa Áo cotton khỏi giỏ' }));
    expect(await screen.findByRole('heading', { name: 'Giỏ hàng trống' })).toBeVisible();
    expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '')).toEqual({ schemaVersion: 1, items: [] });
  });

  it('keeps the rows and offers a retry when pricing fails', async () => {
    const user = userEvent.setup();
    const request = vi.spyOn(client, 'request')
      .mockRejectedValueOnce(new client.ApiError('SERVICE_UNAVAILABLE', 'Dịch vụ chưa sẵn sàng…', 503))
      .mockResolvedValue({ items: [rowA] });
    renderPage([{ variantId: variantA, quantity: 2 }]);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Chưa đọc được giá và tình trạng của giỏ. Giỏ của bạn vẫn giữ nguyên.');
    expect(screen.queryByText(/^Tạm tính:/)).not.toBeInTheDocument();
    await user.click(within(alert).getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText(/^Tạm tính:/)).toHaveTextContent('400.000');
    expect(request).toHaveBeenCalledTimes(2);
    // The shopper's own rows were never the failure: they are still listed and removable.
    expect(screen.getByRole('link', { name: 'Áo cotton' })).toBeVisible();
  });
});

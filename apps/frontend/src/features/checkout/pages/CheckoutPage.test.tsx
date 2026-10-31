import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as client from '../../../shared/api/client';
import { CartProvider, useCart } from '../../cart/CartProvider';
import { CART_STORAGE_KEY } from '../../cart/cart-store';
import { CheckoutPage } from './CheckoutPage';

const variantA = '17bfecab-9df4-4de4-bd91-3c11116fca5b';
const variantB = '98d3a8f8-8ac2-4a54-b9e4-34d3fcb8816f';
const variantExtra = '24d0b13c-6a83-4bbf-9c05-4b1b9e9db93f';

const serverNow = () => new Date();
const quoteResponse = (overrides: Record<string, unknown> = {}) => {
  const now = serverNow();
  return {
    quoteId: 'quote-1', method: 'COD', currency: 'VND',
    items: [
      { variantId: variantA, productName: 'Áo cotton', sku: 'AO-A', size: 'M', color: 'đen',
        unitPriceVnd: 200000, quantity: 2, lineTotalVnd: 400000 },
      { variantId: variantB, productName: 'Quần jean', sku: 'JEAN-B', size: 'L', color: 'xanh',
        unitPriceVnd: 300000, quantity: 1, lineTotalVnd: 300000 },
    ],
    subtotal: 700000, shippingFee: 30000, total: 730000, settingsVersion: 0,
    serverNow: now.toISOString(), expiresAt: new Date(now.getTime() + 15 * 60000).toISOString(),
    ...overrides,
  };
};

function seed(items: { variantId: string; quantity: number }[]) {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, items }));
}

// Cart mutations from the test: the page itself has no edit controls on purpose.
function CartControls() {
  const cart = useCart();
  return <div>
    <button onClick={() => cart.addItem(variantExtra, 1)}>thêm-dòng</button>
    <button onClick={() => cart.updateQuantity(cart.items[0]!.variantId, cart.items[0]!.quantity + 1)}>tăng-số-lượng</button>
  </div>;
}

function renderPage(items: { variantId: string; quantity: number }[] = [
  { variantId: variantA, quantity: 2 }, { variantId: variantB, quantity: 1 }]) {
  seed(items);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/checkout']}>
      <Routes><Route path="checkout" element={<CartProvider><CartControls /><CheckoutPage /></CartProvider>} /></Routes>
    </MemoryRouter>
  </QueryClientProvider>);
}

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => vi.restoreAllMocks());

describe('checkout quote page', () => {
  it('allows confirming a fresh changed quote after the previous quote has expired', async () => {
    const now = new Date();
    const request = vi.spyOn(client, 'request').mockResolvedValueOnce(quoteResponse({
      serverNow: now.toISOString(), expiresAt: now.toISOString(),
    }));
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Lấy báo giá' }));
    await screen.findByText(/Báo giá đã hết hạn/);
    request.mockResolvedValue(quoteResponse({ quoteId: 'quote-2', shippingFee: 40000, total: 740000 }));
    await userEvent.click(screen.getByRole('button', { name: 'Cập nhật báo giá' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Dùng báo giá mới' }));
    expect(await screen.findByText(/Báo giá có hiệu lực khoảng 15 phút nữa/)).toBeVisible();
    expect(screen.getByText(/740\.000/)).toBeVisible();
    expect(screen.queryByText(/Báo giá đã hết hạn/)).not.toBeInTheDocument();
  });
  it('shows the empty state with a way back to the shop and no quote action', () => {
    renderPage([]);
    expect(screen.getByRole('heading', { name: 'Giỏ hàng trống' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Lấy báo giá' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Quay lại mua hàng' })).toHaveAttribute('href', '/shop');
  });

  it('renders exactly the server response with money and expiry, never a local estimate', async () => {
    vi.spyOn(client, 'request').mockResolvedValue(quoteResponse());
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Lấy báo giá' }));
    expect(await screen.findByText('Áo cotton')).toBeVisible();
    expect(screen.getByText(/400\.000/)).toBeVisible();
    // The unit price and the line total of the jeans both contain 300.000.
    expect(screen.getAllByText(/300\.000/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/730\.000/)).toBeVisible();
    expect(screen.getByText(/Báo giá chưa giữ hàng/)).toBeVisible();
    expect(screen.getByText(/Báo giá có hiệu lực khoảng/)).toBeVisible();
    expect(screen.queryByText(/Tạm tính/)).not.toBeInTheDocument();
  });

  it('collapses a same-tick double click into one request', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const request = vi.spyOn(client, 'request')
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    renderPage();
    const button = screen.getByRole('button', { name: 'Lấy báo giá' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Đang lấy báo giá…' })).toBeDisabled();
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    await act(async () => { finish(quoteResponse()); });
    expect(await screen.findByText(/730\.000/)).toBeVisible();
  });

  it('never lets a late response for the old cart become the quote of the edited cart', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const request = vi.spyOn(client, 'request')
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Lấy báo giá' }));
    await screen.findByRole('button', { name: 'Đang lấy báo giá…' });
    await userEvent.click(screen.getByRole('button', { name: 'tăng-số-lượng' }));
    await act(async () => { finish(quoteResponse()); });
    expect(await screen.findByText(/Giỏ đã thay đổi/)).toBeVisible();
    expect(screen.queryByText(/730\.000/)).not.toBeInTheDocument();
    // The shopper can fetch again; the next response is for the current cart and applies.
    vi.spyOn(client, 'request').mockResolvedValue(quoteResponse({ total: 1030000, subtotal: 1000000,
      items: [quoteResponse().items[0], { ...quoteResponse().items[1]!, quantity: 2, lineTotalVnd: 600000 }] }));
    await userEvent.click(screen.getByRole('button', { name: 'Lấy báo giá' }));
    expect(await screen.findByText(/1\.030\.000/)).toBeVisible();
    void request;
  });

  it('reports a malformed response as an error instead of a quote', async () => {
    vi.spyOn(client, 'request').mockResolvedValue({ hello: 'world' });
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Lấy báo giá' }));
    expect(await screen.findByText('Chưa đọc được báo giá. Vui lòng thử lại.')).toBeVisible();
    expect(screen.queryByText('Áo cotton')).not.toBeInTheDocument();
  });

  it('marks an expired quote and only a user action refreshes it', async () => {
    const now = serverNow();
    vi.spyOn(client, 'request').mockResolvedValue(quoteResponse({
      serverNow: now.toISOString(), expiresAt: now.toISOString() }));
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Lấy báo giá' }));
    expect(await screen.findByText(/Báo giá đã hết hạn/, {}, { timeout: 4000 })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cập nhật báo giá' })).toBeEnabled();
    expect(screen.queryByText(/Báo giá chưa giữ hàng/)).not.toBeInTheDocument();
  });

  it('shows the changed price or fee only after an explicit confirmation', async () => {
    const request = vi.spyOn(client, 'request').mockResolvedValue(quoteResponse());
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Lấy báo giá' }));
    expect(await screen.findByText(/730\.000/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'tăng-số-lượng' }));
    expect(await screen.findByText(/Giỏ đã thay đổi/)).toBeVisible();
    request.mockResolvedValue(quoteResponse({ subtotal: 1000000, total: 1030000,
      items: [quoteResponse().items[0], { ...quoteResponse().items[1]!, quantity: 2, lineTotalVnd: 600000 }] }));
    await userEvent.click(screen.getByRole('button', { name: 'Lấy báo giá' }));
    expect(await screen.findByText('Dùng báo giá mới')).toBeVisible();
    expect(screen.getByText(/1\.030\.000/)).toBeVisible();
    expect(screen.getByText(/730\.000/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Dùng báo giá mới' }));
    expect(await screen.findByText(/1\.030\.000/)).toBeVisible();
    expect(screen.queryByText('Dùng báo giá mới')).not.toBeInTheDocument();
  });

  it('keeps the cart when the quote request fails and never stores the quote', async () => {
    const request = vi.spyOn(client, 'request')
      .mockRejectedValueOnce(new client.ApiError('NETWORK_ERROR', 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.', 0))
      .mockResolvedValue(quoteResponse());
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Lấy báo giá' }));
    expect(await screen.findByText('Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText(/730\.000/)).toBeVisible();
    expect(request).toHaveBeenCalledTimes(2);
    const stored = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY)!);
    expect(Object.keys(stored)).toEqual(['schemaVersion', 'items']);
    expect(window.localStorage.getItem('checkout-quote')).toBeNull();
  });
});

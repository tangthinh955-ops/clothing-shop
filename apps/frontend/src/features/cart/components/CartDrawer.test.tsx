import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as client from '../../../shared/api/client';
import { CartProvider, useCart } from '../CartProvider';
import { CART_STORAGE_KEY } from '../cart-store';
import { CartPage } from '../pages/CartPage';
import { CartDrawer } from './CartDrawer';

const variantA = '17bfecab-9df4-4de4-bd91-3c11116fca5b';
const variantB = '98d3a8f8-8ac2-4a54-b9e4-34d3fcb8816f';

const rowA = {
  variantId: variantA, status: 'AVAILABLE', available: 4,
  product: { name: 'Áo cotton', slug: 'ao-cotton' }, sku: 'CART-A-1', size: 'M', color: 'Đen',
  price: 200000, image: { url: '/api/v1/media/asset-1' },
};

function Location() {
  const location = useLocation();
  return <output data-testid="url">{location.pathname}</output>;
}

function OpenButton() {
  const cart = useCart();
  return <button data-testid="open" onClick={cart.openDrawer}>open</button>;
}

function Harness({ path: initial }: { path: string }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <Location />
      <CartProvider>
        <OpenButton />
        <CartDrawer />
        <Routes><Route path="/cart" element={<CartPage />} /></Routes>
      </CartProvider>
    </MemoryRouter>
  </QueryClientProvider>;
}

function seed(items: { variantId: string; quantity: number }[]) {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, items }));
}

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => vi.restoreAllMocks());

describe('cart drawer', () => {
  it('includes the close and cart actions inside the named dialog', async () => {
    render(<Harness path="/" />);
    await userEvent.click(screen.getByTestId('open'));
    const dialog = await screen.findByRole('dialog', { name: 'GIỎ HÀNG' });
    expect(within(dialog).getByRole('button', { name: 'Đóng giỏ hàng' })).toBeVisible();
    expect(within(dialog).getByRole('link', { name: 'Đi tới giỏ hàng' })).toBeVisible();
  });
  it('closes the drawer when following a product link', async () => {
    vi.spyOn(client, 'request').mockResolvedValue({ items: [rowA] });
    seed([{ variantId: variantA, quantity: 2 }]);
    render(<Harness path="/" />);
    await userEvent.click(screen.getByTestId('open'));
    await userEvent.click(await screen.findByRole('link', { name: 'Áo cotton' }));
    expect(screen.getByTestId('url')).toHaveTextContent('/products/ao-cotton');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'GIỎ HÀNG' })).not.toBeInTheDocument());
  });
  it('rechecks the cart after closing and reopening the drawer', async () => {
    const request = vi.spyOn(client, 'request').mockResolvedValueOnce({ items: [rowA] })
      .mockResolvedValue({ items: [{ variantId: variantA, status: 'UNAVAILABLE' }] });
    seed([{ variantId: variantA, quantity: 2 }]);
    render(<Harness path="/" />);
    await userEvent.click(screen.getByTestId('open'));
    expect(await screen.findByRole('link', { name: 'Áo cotton' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Đóng giỏ hàng' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'GIỎ HÀNG' })).not.toBeInTheDocument());
    await userEvent.click(screen.getByTestId('open'));
    expect(await screen.findByText('Sản phẩm không truy cập được')).toBeVisible();
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('stays hidden until opened, then resolves the cart through the one endpoint', async () => {
    const request = vi.spyOn(client, 'request').mockResolvedValue({ items: [rowA] });
    seed([{ variantId: variantA, quantity: 2 }]);
    render(<Harness path="/" />);
    expect(screen.queryByRole('dialog', { name: 'GIỎ HÀNG' })).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('open'));
    const dialog = await screen.findByRole('dialog', { name: 'GIỎ HÀNG' });
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request).toHaveBeenCalledWith('/cart/resolve', {
      method: 'POST',
      body: { items: [{ variantId: variantA, quantity: 2 }] },
    });
    await waitFor(() => expect(within(dialog).getByRole('link', { name: 'Áo cotton' })).toBeVisible());
  });

  it('shows priced rows and keeps unavailable rows visible without any price', async () => {
    vi.spyOn(client, 'request').mockResolvedValue({
      items: [rowA, { variantId: variantB, status: 'UNAVAILABLE' }],
    });
    seed([{ variantId: variantA, quantity: 2 }, { variantId: variantB, quantity: 1 }]);
    render(<Harness path="/" />);
    await userEvent.click(screen.getByTestId('open'));
    const dialog = await screen.findByRole('dialog', { name: 'GIỎ HÀNG' });
    expect(within(dialog).getByRole('link', { name: 'Áo cotton' })).toHaveAttribute('href', '/products/ao-cotton');
    expect(within(dialog).getByText('Đen · size M · CART-A-1')).toBeVisible();
    // Line total comes from the server price of the live row, not a client-side guess.
    expect(within(dialog).getByText(/^200\.000\s*₫ × 2 = 400\.000\s*₫$/)).toBeVisible();
    expect(within(dialog).getByText('Sản phẩm không truy cập được')).toBeVisible();
    expect(within(dialog).getByText('1 chiếc')).toBeVisible();
  });

  it('flags rows the cart over-orders and rows that went out of stock', async () => {
    vi.spyOn(client, 'request').mockResolvedValue({
      items: [
        { ...rowA, status: 'EXCEEDS_STOCK', available: 1 },
        { ...rowA, variantId: variantB, status: 'OUT_OF_STOCK' },
      ],
    });
    seed([{ variantId: variantA, quantity: 3 }, { variantId: variantB, quantity: 1 }]);
    render(<Harness path="/" />);
    await userEvent.click(screen.getByTestId('open'));
    const dialog = await screen.findByRole('dialog', { name: 'GIỎ HÀNG' });
    expect(await within(dialog).findByText('Chỉ còn 1 chiếc')).toBeVisible();
    expect(within(dialog).getByText('Hết hàng')).toBeVisible();
  });

  it('keeps the cart and offers a retry when pricing fails', async () => {
    const request = vi.spyOn(client, 'request')
      .mockRejectedValueOnce(new client.ApiError('SERVICE_UNAVAILABLE', 'Dịch vụ chưa sẵn sàng…', 503))
      .mockResolvedValue({ items: [rowA] });
    seed([{ variantId: variantA, quantity: 2 }]);
    render(<Harness path="/" />);
    await userEvent.click(screen.getByTestId('open'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Chưa đọc được giá và tình trạng hàng. Giỏ của bạn vẫn giữ nguyên.');
    await userEvent.click(within(alert).getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('link', { name: 'Áo cotton' })).toBeVisible();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('shows the storage warning of a corrupt saved cart', async () => {
    window.localStorage.setItem(CART_STORAGE_KEY, '{broken');
    render(<Harness path="/" />);
    await userEvent.click(screen.getByTestId('open'));
    // The warning lives beside the (reset) cart content, not inside the row list.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Giỏ hàng đã lưu trên thiết bị không đọc được nên đã được đặt lại trống.');
  });

  it('offers the shop listing to continue empty-handed and the full cart page otherwise', async () => {
    render(<Harness path="/" />);
    await userEvent.click(screen.getByTestId('open'));
    const dialog = await screen.findByRole('dialog', { name: 'GIỎ HÀNG' });
    expect(within(dialog).getByText('Giỏ hàng trống. Hãy chọn một sản phẩm để bắt đầu.')).toBeVisible();
    await userEvent.click(within(dialog).getByRole('link', { name: 'Xem sản phẩm' }));
    expect(screen.getByTestId('url')).toHaveTextContent('/shop');
  });

  it('navigates from the drawer to the full cart page without losing the drawer cart', async () => {
    vi.spyOn(client, 'request').mockResolvedValue({ items: [rowA] });
    seed([{ variantId: variantA, quantity: 2 }]);
    render(<Harness path="/" />);
    await userEvent.click(screen.getByTestId('open'));
    const dialog = await screen.findByRole('dialog', { name: 'GIỎ HÀNG' });
    await within(dialog).findByRole('link', { name: 'Áo cotton' });
    await userEvent.click(screen.getByRole('link', { name: 'Đi tới giỏ hàng' }));
    expect(screen.getByTestId('url')).toHaveTextContent('/cart');
    expect(await screen.findByRole('heading', { name: 'Giỏ hàng của bạn' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Áo cotton' })).toBeVisible();
  });

  it('closes without wiping the saved cart', async () => {
    vi.spyOn(client, 'request').mockResolvedValue({ items: [rowA] });
    seed([{ variantId: variantA, quantity: 2 }]);
    render(<Harness path="/products/ao-cotton" />);
    await userEvent.click(screen.getByTestId('open'));
    await screen.findByRole('dialog', { name: 'GIỎ HÀNG' });
    await userEvent.click(screen.getByRole('button', { name: 'Đóng giỏ hàng' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'GIỎ HÀNG' })).not.toBeInTheDocument());
    expect(window.localStorage.getItem(CART_STORAGE_KEY)).toContain(variantA);
  });
});

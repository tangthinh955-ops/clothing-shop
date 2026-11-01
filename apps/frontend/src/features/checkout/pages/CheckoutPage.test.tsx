import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as client from '../../../shared/api/client';
import { CartProvider, useCart } from '../../cart/CartProvider';
import { CART_STORAGE_KEY } from '../../cart/cart-store';
import { OrderSubmissionProvider } from '../OrderSubmissionProvider';
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
    <button onClick={() => { cart.addItem(variantA, 2); cart.addItem(variantB, 1); }}>thêm-giỏ-mới</button>
    <button onClick={() => cart.updateQuantity(cart.items[0]!.variantId, cart.items[0]!.quantity + 1)}>tăng-số-lượng</button>
    <button onClick={() => { for (const line of [...cart.items]) cart.removeItem(line.variantId); }}>xóa-hết</button>
  </div>;
}

function RouteControls() {
  const navigate = useNavigate();
  return <div>
    <button onClick={() => navigate('/shop')}>đi-shop</button>
    <button onClick={() => navigate('/checkout')}>về-checkout</button>
  </div>;
}

function ShopProbe() {
  const navigate = useNavigate();
  return <div>
    Trang cửa hàng
    <button onClick={() => navigate('/checkout')}>về-checkout</button>
  </div>;
}

function OrderDetailProbe() {
  const location = useLocation();
  return <div>Trang đơn chi tiết {location.pathname}{location.hash}</div>;
}

function renderPage(items: { variantId: string; quantity: number }[] = [
  { variantId: variantA, quantity: 2 }, { variantId: variantB, quantity: 1 }]) {
  seed(items);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {/* Providers sit ABOVE the routes exactly like the real App — the captured command must
        survive route changes (m4.3.1 review fix 4). */}
    <MemoryRouter initialEntries={['/checkout']}>
      <CartProvider><OrderSubmissionProvider>
        <Routes>
          <Route path="checkout" element={<><CartControls /><RouteControls /><CheckoutPage /></>} />
          <Route path="shop" element={<ShopProbe />} />
          <Route path="orders/:code" element={<OrderDetailProbe />} />
        </Routes>
      </OrderSubmissionProvider></CartProvider>
    </MemoryRouter>
  </QueryClientProvider>);
}

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => vi.restoreAllMocks());

describe('checkout quote page', () => {
  async function acceptQuoteAndFillForm(mockBodies: unknown[]) {
    const request = vi.spyOn(client, 'request');
    let call = 0;
    request.mockImplementation((reqPath: string, options?: { method?: string }) => {
      const body = mockBodies[Math.min(call, mockBodies.length - 1)];
      call += 1;
      return body instanceof Error ? Promise.reject(body) : Promise.resolve(body);
    });
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Lấy báo giá' }));
    expect(await screen.findByText('Thông tin nhận hàng')).toBeVisible();
    // eslint-disable-next-line no-console
    for (const [label, value] of [
      ['Họ tên', 'Nguyễn Thử'], ['Số điện thoại', '0901234567'], ['Tỉnh/thành', 'TP. Hồ Chí Minh'],
      ['Phường/xã', 'Phường Bến Nghé'], ['Địa chỉ cụ thể', '12 Nguyễn Huệ'],
    ] as const) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    return request;
  }

  it('places a COD order without login, shows the code and clears the matching cart', async () => {
    const request = await acceptQuoteAndFillForm([
      quoteResponse(), // quote
      { order: { code: 'AB23456789CD', status: 'PENDING', method: 'COD', currency: 'VND',
        items: quoteResponse().items, subtotal: 700000, shippingFee: 30000, total: 730000 },
        lookupToken: 'a'.repeat(32) },
    ]);
    const button = screen.getByRole('button', { name: 'Đặt hàng COD' });
    expect(button).toBeEnabled(); // the filled draft and the accepted quote unlock the submit
    await userEvent.click(button);
    expect(await screen.findByText(/Đã tạo đơn hàng COD/)).toBeVisible();
    expect(screen.getByText('AB23456789CD')).toBeVisible();
    expect(screen.getByText(/Chờ xác nhận/)).toBeVisible();
    expect(screen.getByText(/chưa thu tiền/)).toBeVisible();
    // The confirmation total and the leftover quote summary may both print 730.000.
    expect(screen.getAllByText(/730\.000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: 'Đặt hàng COD' })).not.toBeInTheDocument();
    // The confirmation stays on screen; the matching cart is cleared underneath it.
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY)!);
      expect(stored.items).toEqual([]);
    });
    const post = request.mock.calls.find(([, options]) => options?.method === 'POST' && JSON.stringify(options?.body).includes('quoteId'));
    expect(post).toBeTruthy();
  });

  it('shows the private access link buttons and opens /orders/:code with the fragment token', async () => {
    const token = 'A'.repeat(32);
    await acceptQuoteAndFillForm([
      quoteResponse(), // quote
      { order: { code: 'AB23456789CD', status: 'PENDING', method: 'COD', currency: 'VND',
        items: quoteResponse().items, subtotal: 700000, shippingFee: 30000, total: 730000 },
        lookupToken: token },
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' }));
    expect(await screen.findByText(/Đã tạo đơn hàng COD/)).toBeVisible();
    // M4.4.1: the confirmation exposes the private link exactly once, through buttons only.
    expect(screen.getByRole('link', { name: 'Xem đơn hàng' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sao chép link riêng' })).toBeVisible();
    // M4.4.2: the recovery path is announced on the confirmation as well.
    expect(screen.getByRole('link', { name: 'Tra cứu bằng mã đơn và số điện thoại' }))
      .toHaveAttribute('href', '/orders/lookup');
    await userEvent.click(screen.getByRole('link', { name: 'Xem đơn hàng' }));
    // The fragment token travels in the address; the path query stays free of it.
    expect(await screen.findByText(/Trang đơn chi tiết \/orders\/AB23456789CD/)).toBeVisible();
    expect(screen.getByText(/#t=A{32}/)).toBeInTheDocument();
  });

  it('does not fabricate an access link for a replay answer without a token', async () => {
    await acceptQuoteAndFillForm([
      quoteResponse(), // quote
      { order: { code: 'EF23456789GH', status: 'PENDING', method: 'COD', currency: 'VND',
        items: quoteResponse().items, subtotal: 700000, shippingFee: 30000, total: 730000 }, replay: true },
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' }));
    expect(await screen.findByText('EF23456789GH')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Xem đơn hàng' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sao chép link riêng' })).not.toBeInTheDocument();
    // M4.4.2: a replay without a token still leaves the customer the lookup path.
    expect(screen.getByRole('link', { name: 'Tra cứu bằng mã đơn và số điện thoại' }))
      .toHaveAttribute('href', '/orders/lookup');
  });

  it('keeps the draft and shows the server reason on a definite failure, then allows a new intent', async () => {
    const conflict = new client.ApiError('QUOTE_CHANGED', 'Báo giá đã hết hạn. Hãy lấy báo giá mới.', 409,
      [{ field: 'contact.phone', message: 'Số điện thoại Việt Nam chưa hợp lệ.' }]);
    await acceptQuoteAndFillForm([quoteResponse(), conflict, quoteResponse(),
      { order: { code: 'CD23456789AB', status: 'PENDING', method: 'COD', currency: 'VND',
        items: quoteResponse().items, subtotal: 700000, shippingFee: 30000, total: 730000 } }]);
    await userEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' }));
    expect(await screen.findByText('Báo giá đã hết hạn. Hãy lấy báo giá mới.')).toBeVisible();
    expect(screen.getByLabelText('Họ tên')).toHaveValue('Nguyễn Thử'); // draft kept
    await userEvent.click(screen.getByRole('button', { name: 'Lấy báo giá' })); // re-quote after QUOTE_CHANGED
    await screen.findByText('Thông tin nhận hàng');
    expect(screen.getByLabelText('Họ tên')).toHaveValue('Nguyễn Thử'); // draft survives the re-quote
    await userEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' }));
    expect(await screen.findByText(/Đã tạo đơn hàng COD/)).toBeVisible(); // fresh key, new intent
  });

  it('routes a lost response through Gửi lại with the captured command and warns on reload', async () => {
    const lost = new client.ApiError('NETWORK_ERROR', 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.', 0);
    const request = await acceptQuoteAndFillForm([quoteResponse(), lost,
      { order: { code: 'EF23456789GH', status: 'PENDING', method: 'COD', currency: 'VND',
        items: quoteResponse().items, subtotal: 700000, shippingFee: 30000, total: 730000 } }]);
    await userEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' }));
    expect(await screen.findByText(/Đơn có thể đã được tạo từ lần gửi trước/)).toBeVisible();
    // Review fix 4: the unclear outcome replaces the form — the captured command survives alone.
    expect(screen.queryByLabelText('Họ tên')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Gửi lại' }));
    expect(await screen.findByText(/Đã tạo đơn hàng COD/)).toBeVisible();
    const posts = request.mock.calls.filter(([path, options]) => path === '/orders'
      && (options as { method?: string } | undefined)?.method === 'POST');
    expect(posts).toHaveLength(2); // same command resent exactly once
    const keys = posts.map((post) => (post[1] as { idempotencyKey?: string }).idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
  });

  it('keeps the unclear outcome alive across quote expiry, cart edits, an empty cart and route changes', async () => {
    const lost = new client.ApiError('NETWORK_ERROR', 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.', 0);
    // While the outcome is unclear the quote UI stays suppressed regardless of the quote hook's
    // phase — expiry, cart edits, an empty cart and route changes must not unlock it (review fix 4).
    await acceptQuoteAndFillForm([quoteResponse(), lost, lost]);
    await userEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' }));
    expect(await screen.findByText(/Đơn có thể đã được tạo từ lần gửi trước/)).toBeVisible();
    // The quote expires: the unknown block and Gửi lại survive it, and no new quote may be
    // fetched while the outcome is still unclear (m4.3.1 review fix 4).
    expect(screen.queryByRole('button', { name: 'Cập nhật báo giá' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gửi lại' })).toBeVisible();
    // No new quote may be fetched while the outcome is unclear.
    expect(screen.queryByRole('button', { name: 'Lấy báo giá' })).not.toBeInTheDocument();
    // The cart empties: the unknown block still owns the page.
    await userEvent.click(screen.getByRole('button', { name: 'xóa-hết' }));
    expect(screen.getByRole('button', { name: 'Gửi lại' })).toBeVisible();
    // A route change and back: the captured command is untouched.
    await userEvent.click(screen.getByRole('button', { name: 'đi-shop' }));
    expect(await screen.findByText('Trang cửa hàng')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'về-checkout' }));
    expect(screen.getByRole('button', { name: 'Gửi lại' })).toBeVisible();
    // The retry still works against the original command once the network is back.
    vi.mocked(client.request).mockResolvedValueOnce({ order: { code: 'GH23456789IJ', status: 'PENDING', method: 'COD',
      currency: 'VND', items: quoteResponse().items, subtotal: 700000, shippingFee: 30000, total: 730000 } });
    await userEvent.click(screen.getByRole('button', { name: 'Gửi lại' }));
    expect(await screen.findByText(/Đã tạo đơn hàng COD/)).toBeVisible();
    expect(screen.getByText('GH23456789IJ')).toBeVisible();
  });

  it('keeps the command unknown when a retry hits the rate limiter instead of pretending failure', async () => {
    const lost = new client.ApiError('NETWORK_ERROR', 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.', 0);
    const limited = new client.ApiError('RATE_LIMITED', 'Thao tác quá nhanh. Vui lòng thử lại sau.', 429);
    await acceptQuoteAndFillForm([quoteResponse(), lost, limited,
      { order: { code: 'IJ23456789KL', status: 'PENDING', method: 'COD', currency: 'VND',
        items: quoteResponse().items, subtotal: 700000, shippingFee: 30000, total: 730000 } }]);
    await userEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' }));
    expect(await screen.findByText(/Đơn có thể đã được tạo từ lần gửi trước/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Gửi lại' }));
    expect(await screen.findByText('Hệ thống đang quá tải. Vui lòng đợi một lúc rồi bấm “Gửi lại”.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Gửi lại' })).toBeVisible(); // still unknown, command kept
    await userEvent.click(screen.getByRole('button', { name: 'Gửi lại' }));
    expect(await screen.findByText(/Đã tạo đơn hàng COD/)).toBeVisible();
  });

  it('ends the confirmed intent on Tiếp tục mua sắm so a fresh cart can check out normally', async () => {
    const request = await acceptQuoteAndFillForm([quoteResponse(),
      { order: { code: 'KL23456789MN', status: 'PENDING', method: 'COD', currency: 'VND',
        items: quoteResponse().items, subtotal: 700000, shippingFee: 30000, total: 730000 } }]);
    await userEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' })); // place the order
    expect(await screen.findByText(/Đã tạo đơn hàng COD/)).toBeVisible();
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY)!).items).toEqual([]); // matching cart cleared
    });
    await userEvent.click(screen.getByRole('button', { name: 'Tiếp tục mua sắm' }));
    expect(await screen.findByText('Trang cửa hàng')).toBeVisible(); // intent consumed, navigated away
    // The shopper builds a brand-new cart identical to the old order — the old result must not
    // touch it (m4.3.1 review fix 6).
    vi.mocked(client.request).mockResolvedValueOnce(quoteResponse());
    await userEvent.click(screen.getByRole('button', { name: 'về-checkout' }));
    await userEvent.click(screen.getByRole('button', { name: 'thêm-giỏ-mới' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lấy báo giá' }));
    expect(await screen.findByText('Thông tin nhận hàng')).toBeVisible();
    expect(screen.queryByText(/Đã tạo đơn hàng COD/)).not.toBeInTheDocument();
    for (const [label, value] of [
      ['Họ tên', 'Khách mới'], ['Số điện thoại', '0987654321'], ['Tỉnh/thành', 'Hà Nội'],
      ['Phường/xã', 'Phường Đình Bảng'], ['Địa chỉ cụ thể', '99 Đường mới'],
    ] as const) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    vi.mocked(client.request).mockResolvedValueOnce({ order: { code: 'MN23456789OP', status: 'PENDING', method: 'COD',
      currency: 'VND', items: quoteResponse().items, subtotal: 700000, shippingFee: 30000, total: 730000 } });
    await userEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' }));
    expect(await screen.findByText('MN23456789OP')).toBeVisible(); // a new order, not the old confirmation
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY)!).items).toEqual([]); // cleared for THIS command
    });
    expect(request.mock.calls.filter(([, options]) => options?.method === 'POST' && JSON.stringify(options?.body).includes('quoteId')).length).toBe(2);
  });


  it('shows server field errors from the API without ever sending client money fields', async () => {
    const request = await acceptQuoteAndFillForm([
      quoteResponse(),
      new client.ApiError('VALIDATION_ERROR', 'Thông tin chưa hợp lệ.', 400,
        [{ field: 'address.addressLine', message: 'Địa chỉ cụ thể từ 5 đến 255 ký tự.' }]),
      { order: { code: 'AB23456789CD', status: 'PENDING', method: 'COD', currency: 'VND',
        items: quoteResponse().items, subtotal: 700000, shippingFee: 30000, total: 730000 } },
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Đặt hàng COD' }));
    expect(await screen.findByText('Địa chỉ cụ thể từ 5 đến 255 ký tự.')).toBeVisible();
    const moneyInBody = request.mock.calls.filter(([, options]) => options?.method === 'POST'
      && JSON.stringify(options?.body).includes('"subtotal"'));
    expect(moneyInBody).toHaveLength(0);
  });


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

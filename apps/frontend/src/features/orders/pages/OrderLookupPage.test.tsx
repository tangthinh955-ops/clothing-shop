import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as client from '../../../shared/api/client';
import { ApiError, type RequestOptions } from '../../../shared/api/client';
import { OrderLookupPage } from './OrderLookupPage';

// M4.4.2 guest lookup: mã đơn + SĐT chỉ ở memory, token mới chỉ đi qua fragment của link chuyển
// tới, mọi lỗi giữ nguyên form và không bao giờ tự gửi lại.

const CODE = 'ABCDUVWXYZ2';
const PHONE = '0901230001';
const TOKEN = 'T'.repeat(32);
const UNIFORM_404 = 'Không tìm thấy đơn hàng. Kiểm tra lại mã đơn hoặc đường dẫn đã nhận từ shop.';
const NETWORK_ERROR = 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.';
const LOOKUP_ERROR = 'Chưa đọc được kết quả tra cứu. Vui lòng thử lại.';

const lookupAnswer = (token = TOKEN, code = CODE) => ({
  order: {
    code, status: 'CONFIRMED', method: 'COD', currency: 'VND',
    createdAt: '2026-10-31T03:30:00.000Z',
    items: [{ variantId: '17bfecab-9df4-4de4-bd91-3c11116fca5b', productName: 'Áo tra cứu', sku: 'LKA',
      size: 'M', color: 'Đen', unitPriceVnd: 400000, quantity: 1, lineTotalVnd: 400000 }],
    subtotal: 400000, shippingFee: 30000, total: 430000, trackingNumber: null, deliveredAt: null,
    recipient: { name: 'Nguyễn Thử', phone: PHONE, email: null, province: 'TP. Hồ Chí Minh',
      district: '', ward: 'Phường Bến Nghé', addressLine: '12 Nguyễn Huệ', note: null },
  },
  timeline: [{ fromStatus: null, toStatus: 'PENDING', actorLabel: 'Khách đặt hàng', reason: null,
    version: 0, at: '2026-10-31T03:30:00.000Z' }],
  lookupToken: token,
});

function RouteProbe() {
  const location = useLocation();
  return <div>{`đã chuyển: ${location.pathname}${location.hash}${location.search}`}</div>;
}

function AwayControls() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/away')}>đi-trang-khác</button>;
}

function renderPage() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/orders/lookup']}>
      <Routes>
        <Route path="orders/lookup" element={<><OrderLookupPage /><AwayControls /></>} />
        <Route path="orders/:code" element={<RouteProbe />} />
        <Route path="away" element={<div>Trang khác</div>} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>);
}

async function fill(code = CODE, phone = PHONE) {
  await userEvent.type(screen.getByLabelText('Mã đơn'), code);
  await userEvent.type(screen.getByLabelText('Số điện thoại'), phone);
}

afterEach(() => vi.restoreAllMocks());

describe('OrderLookupPage', () => {
  it('sends one lookup and opens the fresh private link with the token only in the fragment', async () => {
    const spy = vi.spyOn(client, 'request').mockResolvedValue(lookupAnswer());
    renderPage();
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));
    expect(await screen.findByText(`đã chuyển: /orders/${CODE}#t=${TOKEN}`)).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(1);
    const [path, options] = spy.mock.calls[0] as [string, RequestOptions];
    expect(path).toBe('/orders/lookup'); // no query string on the call itself
    expect(options.method).toBe('POST');
    expect(options.body).toEqual({ code: CODE, phone: PHONE }); // form data only rides the body
  });

  it('answers an empty form locally without calling the server', async () => {
    const spy = vi.spyOn(client, 'request');
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));
    expect(await screen.findByText('Nhập mã đơn đã nhận khi đặt hàng.')).toBeInTheDocument();
    expect(screen.getByText('Nhập số điện thoại đã dùng khi đặt hàng.')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('keeps the entered data and shows the one uniform message when the answer is 404', async () => {
    const spy = vi.spyOn(client, 'request').mockRejectedValue(new ApiError('NOT_FOUND', UNIFORM_404, 404));
    renderPage();
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));
    expect(await screen.findByText(UNIFORM_404)).toBeInTheDocument();
    expect(screen.getByLabelText('Mã đơn')).toHaveValue(CODE);
    expect(screen.getByLabelText('Số điện thoại')).toHaveValue(PHONE);
    expect(spy).toHaveBeenCalledTimes(1); // no auto-retry behind the customer's back
    expect(screen.getByRole('button', { name: 'Tra cứu' })).toBeEnabled(); // manual retry stays possible
  });

  it('puts server field errors on the matching inputs', async () => {
    vi.spyOn(client, 'request').mockRejectedValue(new ApiError('VALIDATION_ERROR', 'Thông tin chưa hợp lệ.', 400,
      [{ field: 'code', message: 'Mã đơn chưa hợp lệ.' },
        { field: 'phone', message: 'Số điện thoại Việt Nam chưa hợp lệ.' }]));
    renderPage();
    await fill('không hợp lệ', '12345');
    await userEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));
    expect(await screen.findByText('Mã đơn chưa hợp lệ.')).toBeInTheDocument();
    expect(screen.getByText('Số điện thoại Việt Nam chưa hợp lệ.')).toBeInTheDocument();
  });

  it('shows the rate-limit notice and never retries behind the customer', async () => {
    const spy = vi.spyOn(client, 'request').mockRejectedValue(
      new ApiError('RATE_LIMITED', 'Thao tác quá nhanh. Vui lòng thử lại sau.', 429));
    renderPage();
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));
    expect(await screen.findByText('Thao tác quá nhanh. Vui lòng thử lại sau.')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Số điện thoại')).toHaveValue(PHONE); // form kept for a later retry
  });

  it('keeps the form after a lost response and only looks again when the customer asks', async () => {
    const spy = vi.spyOn(client, 'request')
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(lookupAnswer());
    renderPage();
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));
    expect(await screen.findByText(NETWORK_ERROR)).toBeInTheDocument();
    expect(screen.getByLabelText('Mã đơn')).toHaveValue(CODE);
    expect(spy).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Tra cứu' })); // explicit second try
    expect(await screen.findByText(`đã chuyển: /orders/${CODE}#t=${TOKEN}`)).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(2); // the retry succeeds and issues a fresh link
  });

  it('answers a malformed payload with the error state instead of navigating', async () => {
    vi.spyOn(client, 'request').mockResolvedValue({ hello: 'world' });
    renderPage();
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));
    expect(await screen.findByText(LOOKUP_ERROR)).toBeInTheDocument();
    expect(screen.queryByText(/đã chuyển:/)).not.toBeInTheDocument();
  });

  it('collapses two same-tick submits into one request and one navigation', async () => {
    let release: (value: unknown) => void = () => undefined;
    const spy = vi.spyOn(client, 'request')
      .mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    renderPage();
    await fill();
    const form = screen.getByRole('form', { name: 'Tra cứu đơn hàng' });
    // Two submits dispatched before any rerender: `isPending` is still false, so only the
    // synchronous ref lock can keep the second one from sending.
    fireEvent.submit(form);
    fireEvent.submit(form);
    await act(async () => { await Promise.resolve(); }); // let the mutation machinery start the request
    expect(spy).toHaveBeenCalledTimes(1); // exactly one POST left the page
    await act(async () => { release(lookupAnswer()); });
    expect(await screen.findByText(`đã chuyển: /orders/${CODE}#t=${TOKEN}`)).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(1); // and still exactly one after the answer lands
  });

  it('never drags the customer back when the answer lands after they left the page', async () => {
    let release: (value: unknown) => void = () => undefined;
    const spy = vi.spyOn(client, 'request')
      .mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    renderPage();
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));
    // The customer leaves while the lookup is still in flight.
    await userEvent.click(screen.getByRole('button', { name: 'đi-trang-khác' }));
    expect(await screen.findByText('Trang khác')).toBeInTheDocument();
    await act(async () => { release(lookupAnswer()); }); // the stale answer resolves here
    expect(screen.getByText('Trang khác')).toBeInTheDocument(); // they stay where they chose to be
    expect(screen.queryByText(/đã chuyển:/)).not.toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('refuses an answer for a different order and keeps the form instead of navigating', async () => {
    const spy = vi.spyOn(client, 'request')
      .mockResolvedValue({ ...lookupAnswer(), order: { ...lookupAnswer().order, code: 'A?x=1' } });
    renderPage();
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));
    expect(await screen.findByText(LOOKUP_ERROR)).toBeInTheDocument();
    expect(screen.queryByText(/đã chuyển:/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Mã đơn')).toHaveValue(CODE);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('encodes the order code path segment so punctuation never becomes a query', async () => {
    vi.spyOn(client, 'request').mockResolvedValue(lookupAnswer(TOKEN, 'A?X=1'));
    renderPage();
    await fill('A?X=1', PHONE);
    await userEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));
    expect(await screen.findByText(`đã chuyển: /orders/A%3FX%3D1#t=${TOKEN}`)).toBeInTheDocument();
    expect(screen.getByText(/^đã chuyển:/).textContent).not.toContain('?');
  });

  it('normalizes the typed code like the backend and lands on the stored uppercase link', async () => {
    const spy = vi.spyOn(client, 'request').mockResolvedValue(lookupAnswer(TOKEN, 'AB23456789CD'));
    renderPage();
    await fill('ab23456789cd', PHONE);
    await userEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));
    const [, options] = spy.mock.calls[0] as [string, RequestOptions];
    expect(options.body).toEqual({ code: 'AB23456789CD', phone: PHONE }); // one FE-side normalization
    expect(await screen.findByText(`đã chuyển: /orders/AB23456789CD#t=${TOKEN}`)).toBeInTheDocument();
  });
});

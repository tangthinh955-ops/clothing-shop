import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as client from '../../../shared/api/client';
import { ApiError, type RequestOptions } from '../../../shared/api/client';
import { sha256Hex } from '../token-tag';
import { OrderDetailPage } from './OrderDetailPage';

// M4.4.1 guest order view: the page never sends the token anywhere but the request header, keeps
// the fragment alive for refreshes, isolates cached data per access and answers failures uniformly.

const CODE = 'ABCDUVWXYZ2';
const TOKEN = 'A'.repeat(32);
const WRONG_TOKEN = 'B'.repeat(32);

// Fixed FNV-1a-32 colliding pair (computed offline once; never searched at runtime). Both are valid
// 32-char base64url tokens, so every regression below must hold even when the old key scheme maps
// both tokens onto the same cache entry.
const FNV_COLLIDING_A = 'xRgn5AI2gi4uByBrel0vb3sV_3sK7fFV';
const FNV_COLLIDING_B = 'ayCQj__x0iagZmbCf2wsa3AfIWmIQwSy';
function fnv1a32(token: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
expect(fnv1a32(FNV_COLLIDING_A)).toBe(fnv1a32(FNV_COLLIDING_B)); // the pair is a genuine collision

const NOTE_500 = 'Ghi chú dài hợp lệ: '.padEnd(499, 'x') + '.'; // exact backend note limit (500)

const view = (name = 'Nguyễn Thử Đơn A', note = 'Giao giờ hành chính') => ({
  order: {
    code: CODE, status: 'CONFIRMED', method: 'COD', currency: 'VND',
    createdAt: '2026-10-31T03:30:00.000Z',
    items: [{ variantId: '17bfecab-9df4-4de4-bd91-3c11116fca5b', productName: 'Áo xem chi tiết', sku: 'ACC-A',
      size: 'M', color: 'Đen', unitPriceVnd: 400000, quantity: 1, lineTotalVnd: 400000 }],
    subtotal: 400000, shippingFee: 30000, total: 430000,
    recipient: { name, phone: '0901230001', email: 'viewer-a@example.test', province: 'TP. Hồ Chí Minh',
      district: '', ward: 'Phường Bến Nghé', addressLine: '12 Nguyễn Huệ', note },
  },
  timeline: [
    { fromStatus: null, toStatus: 'PENDING', actorLabel: 'Khách đặt hàng', reason: null, version: 0,
      at: '2026-10-31T03:30:00.000Z' },
    { fromStatus: 'PENDING', toStatus: 'CONFIRMED', actorLabel: 'Cửa hàng', reason: 'Xác nhận qua điện thoại',
      version: 1, at: '2026-10-31T03:31:00.000Z' },
  ],
});

const UNIFORM_404 = 'Không tìm thấy đơn hàng. Kiểm tra lại mã đơn hoặc đường dẫn đã nhận từ shop.';

function HashProbe() {
  return <div data-testid="hash-probe">{useLocation().hash}</div>;
}

// In-tree navigation hook so tests can switch the access fragment on the SAME page instance.
let navigateProbe: ((target: string) => void) | undefined;
function NavigateProbe() {
  const navigate = useNavigate();
  navigateProbe = navigate;
  return <div data-testid="nav-probe" />;
}

function renderDetail(initial: string, client?: QueryClient) {
  return render(<QueryClientProvider client={client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="orders/:code" element={<><OrderDetailPage /><HashProbe /><NavigateProbe /></>} />
        <Route path="*" element={<div>404 khác</div>} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>);
}

type RequestSpy = ReturnType<typeof vi.spyOn>;

function spyOk(responses: unknown[]): { spy: RequestSpy; calls: () => number } {
  const spy = vi.spyOn(client, 'request');
  let call = 0;
  spy.mockImplementation((path: string, options?: { method?: string; orderToken?: string }) => {
    expect(path).toBe(`/orders/${CODE}`); // the token never rides the query string
    expect(options?.method ?? 'GET').toBe('GET');
    expect(options?.orderToken).toBeTypeOf('string');
    call += 1;
    const body = responses[Math.min(call - 1, responses.length - 1)];
    return body instanceof Error ? Promise.reject(body) : Promise.resolve(body);
  });
  return { spy, calls: () => call };
}

/** Per-token server answers: the recipient name tells token X's data apart from token Y's data. */
function spyPerToken() {
  const spy = vi.spyOn(client, 'request');
  spy.mockImplementation(async (path: string, options?: RequestOptions) => {
    expect(path).toBe(`/orders/${CODE}`);
    return view(`Định danh ${options?.orderToken}`);
  });
  return spy;
}

beforeEach(() => { window.history.replaceState(null, '/', '/'); });
afterEach(() => vi.restoreAllMocks());

describe('OrderDetailPage', () => {
  it('renders the server snapshot, the timeline and keeps the access fragment in the address', async () => {
    const spy = vi.spyOn(client, 'request');
    const sent: Array<{ path: string; options: RequestOptions }> = [];
    spy.mockImplementation(async (path: string, options?: RequestOptions) => {
      sent.push({ path, options: options ?? {} });
      return view();
    });
    renderDetail(`/orders/${CODE}#t=${TOKEN}`);
    expect(await screen.findByText(CODE)).toBeInTheDocument();
    expect(screen.getAllByText(/430\.000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Áo xem chi tiết')).toBeInTheDocument();
    expect(screen.getByText(/12 Nguyễn Huệ/)).toBeInTheDocument();
    expect(screen.getByText(/Xác nhận qua điện thoại/)).toBeInTheDocument();
    expect(screen.getByText(/Khách đặt hàng/)).toBeInTheDocument();
    expect(screen.getAllByText(/2026/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('hash-probe')).toHaveTextContent(`#t=${TOKEN}`);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.path).toBe(`/orders/${CODE}`); // the token rides the header, never the query string
    expect(sent[0]!.options.orderToken).toBe(TOKEN);
  });

  it('asks for nothing and shows one uniform access message when the fragment has no token', async () => {
    const { spy } = spyOk([]);
    renderDetail(`/orders/${CODE}`);
    expect(await screen.findByText(UNIFORM_404)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
    expect(screen.queryByText(/Áo xem chi tiết/)).not.toBeInTheDocument();
  });

  it('never serves the cached first view to a later mount with a different token', async () => {
    const shared = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    spyOk([view()]);
    const first = renderDetail(`/orders/${CODE}#t=${TOKEN}`, shared);
    expect(await screen.findByText('Áo xem chi tiết')).toBeInTheDocument();
    // A fresh mount for the same code with a foreign token: the cache must stay sealed.
    first.unmount();
    const { spy: failing } = spyOk([]);
    failing.mockImplementation(() => Promise.reject(new ApiError('NOT_FOUND', UNIFORM_404, 404)));
    renderDetail(`/orders/${CODE}#t=${WRONG_TOKEN}`, shared);
    expect(await screen.findByText(UNIFORM_404)).toBeInTheDocument();
    expect(screen.queryByText('Áo xem chi tiết')).not.toBeInTheDocument();
    expect(screen.queryByText(/12 Nguyễn Huệ/)).not.toBeInTheDocument();
  });

  it('collapses a malformed server answer into the error state instead of an order view', async () => {
    spyOk([{ unexpected: 'shape' }]);
    renderDetail(`/orders/${CODE}#t=${TOKEN}`);
    expect(await screen.findByText(/Chưa đọc được thông tin đơn hàng/)).toBeInTheDocument();
    expect(screen.queryByText(CODE)).not.toBeInTheDocument();
  });

  it('offers Thử lại only after transport errors and retries exactly when pressed', async () => {
    const { spy, calls } = spyOk([new TypeError('network down'), view()]);
    renderDetail(`/orders/${CODE}#t=${TOKEN}`);
    expect(await screen.findByText(/Không thể kết nối/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Áo xem chi tiết')).toBeInTheDocument();
    expect(calls()).toBe(2);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('does not auto-retry a held 404 and keeps it uniform without data', async () => {
    const { calls } = spyOk([new ApiError('NOT_FOUND', UNIFORM_404, 404)]);
    renderDetail(`/orders/${CODE}#t=${TOKEN}`);
    expect(await screen.findByText(UNIFORM_404)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls()).toBe(1);
  });

  it('serves each access on the same page instance with its own data, even for FNV-identical tokens', async () => {
    const spy = spyPerToken();
    renderDetail(`/orders/${CODE}#t=${FNV_COLLIDING_A}`);
    expect(await screen.findByText(/Định danh xRgn/)).toBeInTheDocument();
    expect(screen.queryByText(/Định danh ayCQj/)).not.toBeInTheDocument();
    // Switch the fragment token in place: the cache must be rekeyed, not reused.
    act(() => { navigateProbe!(`/orders/${CODE}#t=${FNV_COLLIDING_B}`); });
    expect(await screen.findByText(/Định danh ayCQj/)).toBeInTheDocument();
    expect(screen.queryByText(/Định danh xRgn/)).not.toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(2); // the second access really went to the server
    expect(spy.mock.calls[1]![1]!.orderToken).toBe(FNV_COLLIDING_B);
  });

  it('never serves the first mount data to a remount whose token collides in the old key scheme', async () => {
    const shared = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = spyPerToken();
    const first = renderDetail(`/orders/${CODE}#t=${FNV_COLLIDING_A}`, shared);
    expect(await screen.findByText(/Định danh xRgn/)).toBeInTheDocument();
    first.unmount();
    renderDetail(`/orders/${CODE}#t=${FNV_COLLIDING_B}`, shared);
    expect(await screen.findByText(/Định danh ayCQj/)).toBeInTheDocument();
    expect(screen.queryByText(/Định danh xRgn/)).not.toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('renders a legal 500-character note instead of collapsing the view into an error', async () => {
    spyOk([view('Nguyễn Thử Đơn A', NOTE_500)]);
    renderDetail(`/orders/${CODE}#t=${TOKEN}`);
    expect(await screen.findByText(CODE)).toBeInTheDocument();
    const noteLine = screen.getByText(/^Ghi chú: /);
    expect(noteLine.textContent).toBe(`Ghi chú: ${NOTE_500}`);
    expect(screen.queryByText(/Chưa đọc được thông tin đơn hàng/)).not.toBeInTheDocument();
  });

  it('never renders a late response from the old token under the new token', async () => {
    const shared = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let resolveLate: ((value: unknown) => void) = () => undefined;
    const spy = vi.spyOn(client, 'request');
    spy.mockImplementation(async (path: string, options?: RequestOptions) => {
      expect(path).toBe(`/orders/${CODE}`);
      if (options?.orderToken === TOKEN) {
        return new Promise((resolve) => { resolveLate = resolve; }); // the first access stays in flight
      }
      return view(`Định danh ${options?.orderToken}`);
    });
    renderDetail(`/orders/${CODE}#t=${TOKEN}`, shared);
    // Switch to the second token while the first request is still hanging.
    act(() => { navigateProbe!(`/orders/${CODE}#t=${WRONG_TOKEN}`); });
    expect(await screen.findByText(/Định danh BBBB/)).toBeInTheDocument();
    // The old request resolves late with a full view of its own; it must not repaint the page.
    await act(async () => { resolveLate(view()); });
    expect(screen.queryByText('Nguyễn Thử Đơn A')).not.toBeInTheDocument(); // the old recipient is gone
    expect(screen.getByText(/Định danh BBBB/)).toBeInTheDocument(); // the new view stays on the page
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('keys the cache by the token hash and never writes the raw token to browser storage', async () => {
    const shared = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    spyOk([view()]);
    renderDetail(`/orders/${CODE}#t=${TOKEN}`, shared);
    expect(await screen.findByText(CODE)).toBeInTheDocument();
    const keys = shared.getQueryCache().getAll().map((query) => JSON.stringify(query.queryKey)).join('\n');
    expect(keys).toContain(sha256Hex(TOKEN)); // the hash identifies the access in the cache
    expect(keys).not.toContain(TOKEN); // the raw token never enters a query key
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (let index = 0; index < storage.length; index += 1) {
        expect(storage.getItem(storage.key(index)!) ?? '').not.toContain(TOKEN);
      }
    }
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
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
    subtotal: 400000, shippingFee: 30000, total: 430000, trackingNumber: null as string | null, deliveredAt: null as string | null,
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

describe('customer cancellation (M4.4.3)', () => {
  const REASON = 'Tôi đặt nhầm size';
  const cancelled = () => {
    const current = view();
    return { ...current, order: { ...current.order, status: 'CANCELLED' }, timeline: [...current.timeline,
      { fromStatus: 'CONFIRMED', toStatus: 'CANCELLED', actorLabel: 'Khách đặt hàng', reason: REASON, version: 2, at: '2026-10-31T04:00:00.000Z' }] };
  };
  const transition = { code: CODE, status: 'CANCELLED', version: 2 };

  type Answer = (path: string, options?: RequestOptions) => Promise<unknown>;

  function serve(answer: Answer) {
    const spy = vi.spyOn(client, 'request').mockImplementation((path: string, options?: RequestOptions) => answer(path, options));
    return { spy, cancelCalls: () => spy.mock.calls.filter(([path]) => String(path).endsWith('/cancel')) };
  }

  // A small server: the order stays open until a cancellation is accepted.
  function backend(onCancel: () => Promise<unknown> = () => Promise.resolve(transition)): Answer {
    let current: unknown = view();
    return async (_path, options) => {
      if (options?.method !== 'POST') return current;
      const answer = await onCancel();
      current = cancelled();
      return answer;
    };
  }

  async function openDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Hủy đơn' }));
    return screen.findByRole('dialog', { name: `Hủy đơn ${CODE}?` });
  }

  it.each(['PENDING', 'CONFIRMED'])('offers to cancel a %s order', async (status) => {
    const current = view();
    serve(() => Promise.resolve({ ...current, order: { ...current.order, status } }));
    renderDetail(`/orders/${CODE}#t=${TOKEN}`);
    expect(await screen.findByRole('button', { name: 'Hủy đơn' })).toBeVisible();
  });

  it.each(['PACKING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'DELIVERY_FAILED', 'RETURNED_TO_SHOP'])('offers no cancellation for a %s order', async (status) => {
    const current = view();
    serve(() => Promise.resolve({ ...current, order: { ...current.order, status } }));
    renderDetail(`/orders/${CODE}#t=${TOKEN}`);
    await screen.findByRole('heading', { name: CODE, level: 1 });
    expect(screen.queryByRole('button', { name: 'Hủy đơn' })).not.toBeInTheDocument();
  });

  it('points to the shop while the order is being packed, and only then', async () => {
    const current = view();
    serve(() => Promise.resolve({ ...current, order: { ...current.order, status: 'PACKING' } }));
    const first = renderDetail(`/orders/${CODE}#t=${TOKEN}`);
    expect(await screen.findByRole('link', { name: '@rmglabels' })).toHaveAttribute('href', 'https://www.instagram.com/rmglabels/');
    first.unmount();
    vi.restoreAllMocks();
    serve(() => Promise.resolve(view()));
    renderDetail(`/orders/${CODE}#t=${TOKEN}`);
    await screen.findByRole('heading', { name: CODE, level: 1 });
    expect(screen.queryByRole('link', { name: '@rmglabels' })).not.toBeInTheDocument();
  });

  it('warns that this cannot be undone, and sends nothing when the customer backs out', async () => {
    const user = userEvent.setup();
    const { cancelCalls } = serve(backend());
    renderDetail(`/orders/${CODE}#t=${TOKEN}`);
    const dialog = await openDialog(user);
    expect(within(dialog).getByText(/không mở lại được/)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Để sau' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(cancelCalls()).toHaveLength(0);
  });

  it.each([['nothing', ''], ['too few characters', ' ab ']])('asks for a real reason when given %s', async (_label, typed) => {
    const user = userEvent.setup();
    const { cancelCalls } = serve(backend());
    renderDetail(`/orders/${CODE}#t=${TOKEN}`);
    const dialog = await openDialog(user);
    if (typed) await user.type(within(dialog).getByLabelText(/Lý do hủy/), typed);
    await user.click(within(dialog).getByRole('button', { name: 'Hủy đơn' }));
    expect(await within(dialog).findByText('Nhập lý do từ 3 đến 500 ký tự.')).toBeVisible();
    expect(cancelCalls()).toHaveLength(0);
  });

  it('sends the trimmed reason, the version on screen, the token header and a key, then shows the cancelled order', async () => {
    const user = userEvent.setup();
    const { cancelCalls } = serve(backend());
    renderDetail(`/orders/${CODE}#t=${TOKEN}`);
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(/Lý do hủy/), `  ${REASON}  `);
    await user.click(within(dialog).getByRole('button', { name: 'Hủy đơn' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Hủy đơn' })).not.toBeInTheDocument());
    const [call] = cancelCalls();
    expect(call?.[0]).toBe(`/orders/${CODE}/cancel`);
    expect(call?.[1]).toMatchObject({ method: 'POST', orderToken: TOKEN, body: { expectedVersion: 1, reason: REASON } });
    expect(call?.[1]?.idempotencyKey).toEqual(expect.any(String));
    expect(await screen.findByText(new RegExp(REASON))).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sends once while a cancellation is in flight', async () => {
    const user = userEvent.setup();
    let finish: (value: unknown) => void = () => undefined;
    const { cancelCalls } = serve(backend(() => new Promise((resolve) => { finish = resolve; })));
    renderDetail(`/orders/${CODE}#t=${TOKEN}`);
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(/Lý do hủy/), REASON);
    const send = within(dialog).getByRole('button', { name: 'Hủy đơn' });
    await Promise.all([user.click(send), user.click(send)]);
    expect(cancelCalls()).toHaveLength(1);
    expect(send).toBeDisabled();
    finish(transition);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('explains a conflict and reloads the order instead of retrying', async () => {
    const user = userEvent.setup();
    let reads = 0;
    const current = view();
    const { cancelCalls } = serve((_path, options) => {
      if (options?.method === 'POST') return Promise.reject(new client.ApiError('CONFLICT', 'Trạng thái đơn không cho phép thao tác này. Hãy tải lại đơn.', 409));
      reads += 1;
      return Promise.resolve(reads === 1 ? current : { ...current, order: { ...current.order, status: 'PACKING' } });
    });
    renderDetail(`/orders/${CODE}#t=${TOKEN}`);
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(/Lý do hủy/), REASON);
    await user.click(within(dialog).getByRole('button', { name: 'Hủy đơn' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Trạng thái đơn không cho phép');
    expect(within(dialog).queryByRole('button', { name: 'Gửi lại' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Tải lại đơn' }));
    expect(await screen.findByRole('link', { name: '@rmglabels' })).toBeVisible();
    expect(cancelCalls()).toHaveLength(1);
  });

  it('locks the reason after a lost response and resends the same key and content', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const { cancelCalls } = serve(backend(() => {
      attempts += 1;
      return attempts === 1 ? Promise.reject(new client.ApiError('NETWORK_ERROR', 'Không thể kết nối.', 0)) : Promise.resolve(transition);
    }));
    renderDetail(`/orders/${CODE}#t=${TOKEN}`);
    const dialog = await openDialog(user);
    const field = within(dialog).getByLabelText(/Lý do hủy/);
    await user.type(field, REASON);
    await user.click(within(dialog).getByRole('button', { name: 'Hủy đơn' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Không thể kết nối.');
    expect(field).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Gửi lại' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Hủy đơn' })).not.toBeInTheDocument());
    const [first, second] = cancelCalls();
    expect(second?.[1]?.idempotencyKey).toBe(first?.[1]?.idempotencyKey);
    expect(second?.[1]?.body).toEqual(first?.[1]?.body);
  });
});

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

  it('shows the tracking number once the shop has handed the order over, and no such line before', async () => {
    const shipped = view();
    spyOk([{ ...shipped, order: { ...shipped.order, status: 'SHIPPED', trackingNumber: 'GHN-123.ABC_9' } }]);
    const first = renderDetail(`/orders/${CODE}#t=${TOKEN}`);
    expect(await screen.findByText('Mã vận đơn: GHN-123.ABC_9')).toBeVisible();
    first.unmount();
    vi.restoreAllMocks();

    spyOk([view()]);
    renderDetail(`/orders/${CODE}#t=${TOKEN}`);
    await screen.findByRole('heading', { name: CODE, level: 1 });
    expect(screen.queryByText(/Mã vận đơn/)).not.toBeInTheDocument();
  });

  it('shows when the order was delivered, in Vietnam time, and no such line before', async () => {
    const delivered = view();
    spyOk([{ ...delivered, order: { ...delivered.order, status: 'DELIVERED', deliveredAt: '2026-11-01T03:00:00.000Z' } }]);
    const first = renderDetail(`/orders/${CODE}#t=${TOKEN}`);
    expect(await screen.findByText(/^Đã giao lúc: 10:00/)).toBeVisible();
    first.unmount();
    vi.restoreAllMocks();

    spyOk([view()]);
    renderDetail(`/orders/${CODE}#t=${TOKEN}`);
    await screen.findByRole('heading', { name: CODE, level: 1 });
    expect(screen.queryByText(/Đã giao lúc/)).not.toBeInTheDocument();
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

  it('re-verifies the same token with the server on every mount before showing anything', async () => {
    const shared = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let calls = 0;
    let release: ((value: unknown) => void) = () => undefined;
    vi.spyOn(client, 'request').mockImplementation(async (path: string, options?: RequestOptions) => {
      expect(path).toBe(`/orders/${CODE}`);
      calls += 1;
      if (calls === 1) return view();
      return new Promise((resolve) => { release = resolve; }); // the reopen stays in flight
    });
    const first = renderDetail(`/orders/${CODE}#t=${TOKEN}`, shared);
    expect(await screen.findByText('Áo xem chi tiết')).toBeInTheDocument();
    first.unmount();
    // gcTime 0 collects the unused entry on the next tick — a real navigation always leaves this gap.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    renderDetail(`/orders/${CODE}#t=${TOKEN}`, shared);
    // No cached snapshot may paint before the fresh verification answers.
    expect(screen.queryByText('Áo xem chi tiết')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải đơn hàng…');
    await act(async () => { release(view()); });
    expect(await screen.findByText('Áo xem chi tiết')).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('never flashes the cached snapshot on an immediate same-tick remount while the GET is pending', async () => {
    const shared = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let calls = 0;
    let rejectSecond: ((error: unknown) => void) = () => undefined;
    vi.spyOn(client, 'request').mockImplementation(async (path: string, options?: RequestOptions) => {
      expect(path).toBe(`/orders/${CODE}`);
      calls += 1;
      if (calls === 1) return view();
      return new Promise((_, reject) => { rejectSecond = reject; }); // the fresh verification hangs
    });
    const first = renderDetail(`/orders/${CODE}#t=${TOKEN}`, shared);
    expect(await screen.findByText('Áo xem chi tiết')).toBeInTheDocument();
    first.unmount();
    // NO gc-timer wait: remount in the same tick. The GC is never the permission gate — the page
    // itself must hide every snapshot until the fresh GET for this mount answers.
    renderDetail(`/orders/${CODE}#t=${TOKEN}`, shared);
    expect(screen.queryByText('Áo xem chi tiết')).not.toBeInTheDocument();
    expect(screen.queryByText(/12 Nguyễn Huệ/)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải đơn hàng…');
    // The pending verification answers 404 (the token was rotated elsewhere): still no snapshot.
    await act(async () => { rejectSecond(new ApiError('NOT_FOUND', UNIFORM_404, 404)); });
    expect(await screen.findByText(UNIFORM_404)).toBeInTheDocument();
    expect(screen.queryByText('Áo xem chi tiết')).not.toBeInTheDocument();
    expect(calls).toBe(2); // the remount really asked the server again
  });

  it('refuses a rotated-out link on reopen instead of replaying the cached view', async () => {
    const shared = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { spy } = spyOk([view()]);
    const first = renderDetail(`/orders/${CODE}#t=${TOKEN}`, shared);
    expect(await screen.findByText('Áo xem chi tiết')).toBeInTheDocument();
    first.unmount();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    // A lookup replaced the hash while the tab was away: the same link now fails server-side.
    let reopenCalls = 0;
    spy.mockImplementation(async () => {
      reopenCalls += 1;
      throw new ApiError('NOT_FOUND', UNIFORM_404, 404);
    });
    renderDetail(`/orders/${CODE}#t=${TOKEN}`, shared);
    expect(await screen.findByText(UNIFORM_404)).toBeInTheDocument();
    expect(screen.queryByText('Áo xem chi tiết')).not.toBeInTheDocument();
    expect(screen.queryByText(/12 Nguyễn Huệ/)).not.toBeInTheDocument();
    expect(reopenCalls).toBe(1); // the reopen really asked the server again
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

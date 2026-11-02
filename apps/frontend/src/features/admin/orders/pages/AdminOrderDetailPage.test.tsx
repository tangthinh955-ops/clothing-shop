import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../../app/App';
import * as client from '../../../../shared/api/client';
import { authApi, type User } from '../../../auth/api/auth.api';
import { catalogApi } from '../../../catalog/api/catalog.api';

const admin: User = { id: 'detail-admin', name: 'Admin', email: 'detail@example.test', role: 'ADMIN', emailVerified: true };
const customer: User = { ...admin, id: 'detail-customer', role: 'CUSTOMER' };
const ORDER_ID = '3f0c4a52-8d2e-4b1f-9a6c-7e5d2b8c1a90';
const note = { id: 'note-1', body: 'Khách hẹn giao sau 18h', authorName: 'Admin Thử', createdAt: '2026-11-01T04:00:00.000Z' };
const order = {
  id: ORDER_ID, code: 'ABCD2345EFGH', status: 'CONFIRMED', source: 'WEB', method: 'COD', currency: 'VND', version: 1,
  createdAt: '2026-11-01T03:30:00.000Z', bankDeadlineAt: null, trackingNumber: null, deliveredAt: null, cancelledAt: null, cancelReason: null,
  recipient: { name: 'Nguyễn Thử', phone: '0901234567', email: 'thu@example.test' },
  address: { province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Phường Bến Nghé', addressLine: '12 Nguyễn Huệ' },
  customerNote: 'Gọi trước khi giao', subtotalVnd: 700000, shippingFeeVnd: 30000, totalVnd: 730000,
  items: [{ variantId: 'v1', productName: 'Áo hoodie', sku: 'AO-M-DEN', size: 'M', color: 'Đen', unitPriceVnd: 350000, quantity: 2, lineTotalVnd: 700000 }],
  history: [
    { id: 'h1', fromStatus: null, toStatus: 'PENDING', actorName: 'Khách đặt hàng', reason: null, version: 0, createdAt: '2026-11-01T03:30:00.000Z' },
    { id: 'h2', fromStatus: 'PENDING', toStatus: 'CONFIRMED', actorName: 'Admin Thử', reason: 'Đã gọi khách', version: 1, createdAt: '2026-11-01T03:40:00.000Z' },
  ],
  notes: [] as Array<typeof note>,
};

afterEach(() => vi.restoreAllMocks());

type Answer = (url: string, options?: client.RequestOptions) => Promise<unknown>;

function renderPage(answer: Answer, user: User | null = admin) {
  vi.spyOn(catalogApi, 'categories').mockResolvedValue([]);
  vi.spyOn(authApi, 'me').mockResolvedValue(user);
  const request = vi.spyOn(client, 'request').mockImplementation((url: string, options?: client.RequestOptions) => answer(url, options));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[`/admin/orders/${ORDER_ID}`]}><App /></MemoryRouter>
  </QueryClientProvider>);
  return request;
}

function noteCalls(request: ReturnType<typeof renderPage>) {
  return request.mock.calls.filter(([url]) => String(url).endsWith('/notes'));
}

describe('admin order detail', () => {
  it('shows the snapshot an admin works from', async () => {
    const request = renderPage(() => Promise.resolve(order));
    expect(await screen.findByRole('heading', { name: 'ABCD2345EFGH', level: 1 })).toBeVisible();
    expect(request).toHaveBeenCalledWith(`/admin/orders/${ORDER_ID}`);
    expect(document.title).toBe('Đơn ABCD2345EFGH | Quản trị | RMG Labels');
    const recipient = within(screen.getByRole('region', { name: 'Người nhận' }));
    expect(recipient.getByText('Nguyễn Thử')).toBeVisible();
    expect(recipient.getByRole('link', { name: '0901234567' })).toHaveAttribute('href', 'tel:0901234567');
    expect(recipient.getByText('thu@example.test')).toBeVisible();
    expect(recipient.getByText('12 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh')).toBeVisible();
    expect(recipient.getByText('Gọi trước khi giao')).toBeVisible();
    const items = within(screen.getByRole('region', { name: 'Sản phẩm' }));
    expect(items.getByText('Áo hoodie')).toBeVisible();
    expect(items.getByText(/AO-M-DEN · M · Đen/)).toBeVisible();
    expect(items.getByText(/350\.000\s*₫ × 2/)).toBeVisible();
    expect(items.getByText(/^730\.000\s*₫$/)).toBeVisible();
    const history = within(screen.getByRole('region', { name: 'Lịch sử trạng thái' }));
    expect(history.getByText(/Chờ xác nhận → Đã xác nhận/)).toBeVisible();
    expect(history.getByText(/Admin Thử/)).toBeVisible();
    expect(history.getByText(/Đã gọi khách/)).toBeVisible();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Về danh sách đơn' })).toHaveAttribute('href', '/admin/orders');
  });

  it('leaves out contact lines the order does not have', async () => {
    renderPage(() => Promise.resolve({ ...order, recipient: { ...order.recipient, email: null }, customerNote: null,
      address: { ...order.address, district: '' } }));
    const recipient = within(await screen.findByRole('region', { name: 'Người nhận' }));
    expect(recipient.getByText('12 Nguyễn Huệ, Phường Bến Nghé, TP. Hồ Chí Minh')).toBeVisible();
    expect(recipient.queryByText(/Ghi chú của khách/)).not.toBeInTheDocument();
  });

  it('says an unknown order is not found and offers only the way back', async () => {
    renderPage(() => Promise.reject(new client.ApiError('NOT_FOUND', 'Không tìm thấy đơn hàng.', 404)));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy đơn hàng.');
    expect(screen.queryByRole('button', { name: 'Tải lại đơn hàng' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Về danh sách đơn' })).toBeVisible();
  });

  it('explains a failed load and retries on request', async () => {
    const user = userEvent.setup();
    let calls = 0;
    renderPage(() => {
      calls += 1;
      return calls === 1 ? Promise.reject(new client.ApiError('SERVICE_UNAVAILABLE', 'Dịch vụ chưa sẵn sàng.', 503)) : Promise.resolve(order);
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Dịch vụ chưa sẵn sàng.');
    await user.click(screen.getByRole('button', { name: 'Tải lại đơn hàng' }));
    expect(await screen.findByRole('heading', { name: 'ABCD2345EFGH', level: 1 })).toBeVisible();
  });

  it('keeps a customer out without loading the order', async () => {
    const request = renderPage(() => Promise.resolve(order), customer);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'ABCD2345EFGH' })).not.toBeInTheDocument());
    expect(request).not.toHaveBeenCalledWith(`/admin/orders/${ORDER_ID}`);
  });
});

describe('internal notes', () => {
  // A small server: notes persist across the detail refetch that follows a save.
  function server(notes: Array<typeof note> = []): Answer {
    return (url, options) => {
      if (options?.method === 'POST') {
        const saved = { ...note, id: `note-${notes.length + 1}`, body: (options.body as { body: string }).body };
        notes.push(saved);
        return Promise.resolve(saved);
      }
      return Promise.resolve({ ...order, notes: [...notes] });
    };
  }

  it('lists notes with author, and says they stay internal', async () => {
    renderPage(server([note]));
    const notes = within(await screen.findByRole('region', { name: 'Ghi chú nội bộ' }));
    expect(notes.getByText('Khách hẹn giao sau 18h')).toBeVisible();
    expect(notes.getByText(/Admin Thử/)).toBeVisible();
    expect(notes.getByText(/Khách không thấy ghi chú này/)).toBeVisible();
  });

  it('saves a trimmed note with a key, clears the draft and shows it after the refetch', async () => {
    const user = userEvent.setup();
    const request = renderPage(server());
    const field = await screen.findByLabelText('Thêm ghi chú');
    await user.type(field, '  Đã gọi, khách đồng ý  ');
    await user.click(screen.getByRole('button', { name: 'Lưu ghi chú' }));
    expect(await screen.findByText('Đã gọi, khách đồng ý')).toBeVisible();
    expect(field).toHaveValue('');
    const [call] = noteCalls(request);
    expect(call?.[0]).toBe(`/admin/orders/${ORDER_ID}/notes`);
    expect(call?.[1]).toMatchObject({ method: 'POST', body: { body: 'Đã gọi, khách đồng ý' } });
    expect(call?.[1]?.idempotencyKey).toEqual(expect.any(String));
  });

  it('uses a fresh key for the next note', async () => {
    const user = userEvent.setup();
    const request = renderPage(server());
    const field = await screen.findByLabelText('Thêm ghi chú');
    await user.type(field, 'Ghi chú một');
    await user.click(screen.getByRole('button', { name: 'Lưu ghi chú' }));
    await screen.findByText('Ghi chú một');
    await user.type(field, 'Ghi chú hai');
    await user.click(screen.getByRole('button', { name: 'Lưu ghi chú' }));
    await screen.findByText('Ghi chú hai');
    const [first, second] = noteCalls(request);
    expect(first?.[1]?.idempotencyKey).not.toBe(second?.[1]?.idempotencyKey);
  });

  it('refuses a blank note without calling the API', async () => {
    const user = userEvent.setup();
    const request = renderPage(server());
    await screen.findByLabelText('Thêm ghi chú');
    await user.click(screen.getByRole('button', { name: 'Lưu ghi chú' }));
    expect(await screen.findByText('Nhập nội dung ghi chú.')).toBeVisible();
    expect(noteCalls(request)).toHaveLength(0);
  });

  it('sends once while a save is in flight', async () => {
    const user = userEvent.setup();
    let finish: (value: unknown) => void = () => undefined;
    const request = renderPage((_url, options) => options?.method === 'POST'
      ? new Promise((resolve) => { finish = resolve; })
      : Promise.resolve(order));
    await user.type(await screen.findByLabelText('Thêm ghi chú'), 'Một lần');
    const save = screen.getByRole('button', { name: 'Lưu ghi chú' });
    await Promise.all([user.click(save), user.click(save)]);
    expect(noteCalls(request)).toHaveLength(1);
    expect(save).toBeDisabled();
    finish(note);
    await waitFor(() => expect(screen.getByLabelText('Thêm ghi chú')).toHaveValue(''));
  });

  it('locks the text after a lost response and resends the same key and content', async () => {
    const user = userEvent.setup();
    const backend = server();
    let attempts = 0;
    const request = renderPage((url, options) => {
      if (options?.method !== 'POST') return backend(url, options);
      attempts += 1;
      return attempts === 1 ? Promise.reject(new client.ApiError('NETWORK_ERROR', 'Không thể kết nối.', 0)) : backend(url, options);
    });
    const field = await screen.findByLabelText('Thêm ghi chú');
    await user.type(field, 'Ghi chú mất phản hồi');
    await user.click(screen.getByRole('button', { name: 'Lưu ghi chú' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Không thể kết nối/);
    expect(field).toHaveValue('Ghi chú mất phản hồi');
    expect(field).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Gửi lại' }));
    expect(await screen.findByText('Ghi chú mất phản hồi', { selector: 'p' })).toBeVisible();
    const [first, second] = noteCalls(request);
    expect(second?.[1]?.idempotencyKey).toBe(first?.[1]?.idempotencyKey);
    expect(second?.[1]?.body).toEqual(first?.[1]?.body);
    await waitFor(() => expect(field).toBeEnabled());
    expect(field).toHaveValue('');
  });

  it('keeps the draft editable when the server refuses it', async () => {
    const user = userEvent.setup();
    renderPage((_url, options) => options?.method === 'POST'
      ? Promise.reject(new client.ApiError('VALIDATION_ERROR', 'Ghi chú không hợp lệ.', 400))
      : Promise.resolve(order));
    const field = await screen.findByLabelText('Thêm ghi chú');
    await user.type(field, 'Bị từ chối');
    await user.click(screen.getByRole('button', { name: 'Lưu ghi chú' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ghi chú không hợp lệ.');
    expect(field).toHaveValue('Bị từ chối');
    expect(field).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Gửi lại' })).not.toBeInTheDocument();
  });
});

describe('confirming an order', () => {
  const pending = { ...order, status: 'PENDING', version: 0, history: [order.history[0]!] };
  const confirmed = { ...pending, status: 'CONFIRMED', version: 1, history: order.history };
  const transition = { id: ORDER_ID, code: order.code, status: 'CONFIRMED', version: 1 };

  // A small server: the order stays pending until a confirmation is accepted.
  function server(onConfirm: () => Promise<unknown> = () => Promise.resolve(transition)): Answer {
    let current: typeof pending = pending;
    return async (_url, options) => {
      if (options?.method !== 'POST') return current;
      const answer = await onConfirm();
      current = confirmed;
      return answer;
    };
  }
  const confirmCalls = (request: ReturnType<typeof renderPage>) => request.mock.calls.filter(([url]) => String(url).endsWith('/confirm'));

  async function openDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Xác nhận đơn' }));
    return screen.findByRole('dialog', { name: `Xác nhận đơn ${order.code}?` });
  }

  it.each([
    ['already confirmed', order],
    ['a bank transfer', { ...pending, method: 'BANK_TRANSFER' }],
  ])('offers no confirmation for an order that is %s', async (_label, shown) => {
    renderPage(() => Promise.resolve(shown));
    await screen.findByRole('heading', { name: order.code, level: 1 });
    expect(screen.queryByRole('button', { name: 'Xác nhận đơn' })).not.toBeInTheDocument();
  });

  it('asks first, and sends nothing when the admin backs out', async () => {
    const user = userEvent.setup();
    const request = renderPage(server());
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Để sau' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(confirmCalls(request)).toHaveLength(0);
  });

  it('sends the viewed version with a key, then shows the new status and history', async () => {
    const user = userEvent.setup();
    const request = renderPage(server());
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Xác nhận đơn' })).not.toBeInTheDocument());
    const [call] = confirmCalls(request);
    expect(call?.[0]).toBe(`/admin/orders/${ORDER_ID}/confirm`);
    expect(call?.[1]).toMatchObject({ method: 'POST', body: { expectedVersion: 0 } });
    expect(call?.[1]?.idempotencyKey).toEqual(expect.any(String));
    expect(await within(screen.getByRole('region', { name: 'Lịch sử trạng thái' })).findByText(/Chờ xác nhận → Đã xác nhận/)).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sends once while a confirmation is in flight', async () => {
    const user = userEvent.setup();
    let finish: (value: unknown) => void = () => undefined;
    const request = renderPage(server(() => new Promise((resolve) => { finish = resolve; })));
    const dialog = await openDialog(user);
    const send = within(dialog).getByRole('button', { name: 'Xác nhận' });
    await Promise.all([user.click(send), user.click(send)]);
    expect(confirmCalls(request)).toHaveLength(1);
    expect(send).toBeDisabled();
    finish(transition);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('explains a conflict and reloads the order instead of retrying', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const request = renderPage((_url, options) => {
      if (options?.method === 'POST') return Promise.reject(new client.ApiError('CONFLICT', 'Đơn đã thay đổi. Hãy tải lại đơn rồi thử lại.', 409));
      attempts += 1;
      return Promise.resolve(attempts === 1 ? pending : confirmed);
    });
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Đơn đã thay đổi.');
    expect(within(dialog).queryByRole('button', { name: 'Gửi lại' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Tải lại đơn' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await within(screen.getByRole('region', { name: 'Lịch sử trạng thái' })).findByText(/Chờ xác nhận → Đã xác nhận/)).toBeVisible();
    expect(confirmCalls(request)).toHaveLength(1);
  });

  it('resends the same key and version after a lost response', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const request = renderPage(server(() => {
      attempts += 1;
      return attempts === 1 ? Promise.reject(new client.ApiError('NETWORK_ERROR', 'Không thể kết nối.', 0)) : Promise.resolve(transition);
    }));
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Không thể kết nối.');
    await user.click(within(dialog).getByRole('button', { name: 'Gửi lại' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Xác nhận đơn' })).not.toBeInTheDocument());
    const [first, second] = confirmCalls(request);
    expect(second?.[1]?.idempotencyKey).toBe(first?.[1]?.idempotencyKey);
    expect(second?.[1]?.body).toEqual(first?.[1]?.body);
  });

  it('reloads the order when the admin leaves after a lost response, since it may have gone through', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const request = renderPage((url, options) => {
      if (options?.method === 'POST') return Promise.reject(new client.ApiError('NETWORK_ERROR', 'Không thể kết nối.', 0));
      attempts += 1;
      return Promise.resolve(attempts === 1 ? pending : confirmed);
    });
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận' }));
    await within(dialog).findByRole('alert');
    await user.click(within(dialog).getByRole('button', { name: 'Để sau' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Xác nhận đơn' })).not.toBeInTheDocument());
    expect(request.mock.calls.filter(([url]) => url === `/admin/orders/${ORDER_ID}`)).toHaveLength(2);
  });
});

describe('packing an order', () => {
  const packed = { ...order, status: 'PACKING', version: 2, history: [...order.history,
    { id: 'h3', fromStatus: 'CONFIRMED', toStatus: 'PACKING', actorName: 'Admin Thử', reason: null, version: 2, createdAt: '2026-11-01T05:00:00.000Z' }] };
  const transition = { id: ORDER_ID, code: order.code, status: 'PACKING', version: 2 };

  // A small server: the order stays confirmed until packing is accepted.
  function server(): Answer {
    let current: unknown = order;
    return (_url, options) => {
      if (options?.method !== 'POST') return Promise.resolve(current);
      current = packed;
      return Promise.resolve(transition);
    };
  }
  const packCalls = (request: ReturnType<typeof renderPage>) => request.mock.calls.filter(([url]) => String(url).endsWith('/pack'));

  async function openDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Đóng gói' }));
    return screen.findByRole('dialog', { name: `Đóng gói đơn ${order.code}?` });
  }

  it.each(['PENDING', 'PACKING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'DELIVERY_FAILED', 'RETURNED_TO_SHOP'])('offers no packing for a %s order', async (status) => {
    renderPage(() => Promise.resolve({ ...order, status }));
    await screen.findByRole('heading', { name: order.code, level: 1 });
    expect(screen.queryByRole('button', { name: 'Đóng gói' })).not.toBeInTheDocument();
  });

  it('asks first, and sends nothing when the admin backs out', async () => {
    const user = userEvent.setup();
    const request = renderPage(server());
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Để sau' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(packCalls(request)).toHaveLength(0);
  });

  it('sends the viewed version with a key, then leaves only the way to cancel', async () => {
    const user = userEvent.setup();
    const request = renderPage(server());
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Đóng gói' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Đóng gói' })).not.toBeInTheDocument());
    const [call] = packCalls(request);
    expect(call?.[0]).toBe(`/admin/orders/${ORDER_ID}/pack`);
    expect(call?.[1]).toMatchObject({ method: 'POST', body: { expectedVersion: 1 } });
    expect(call?.[1]?.idempotencyKey).toEqual(expect.any(String));
    expect(await within(screen.getByRole('region', { name: 'Lịch sử trạng thái' })).findByText(/Đã xác nhận → Đang đóng gói/)).toBeVisible();
    expect(await screen.findByRole('button', { name: 'Hủy đơn' })).toBeVisible();
  });

  it('explains a conflict and reloads the order instead of retrying', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const request = renderPage((_url, options) => {
      if (options?.method === 'POST') return Promise.reject(new client.ApiError('CONFLICT', 'Đơn đã thay đổi. Hãy tải lại đơn rồi thử lại.', 409));
      attempts += 1;
      return Promise.resolve(attempts === 1 ? order : packed);
    });
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Đóng gói' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Đơn đã thay đổi.');
    await user.click(within(dialog).getByRole('button', { name: 'Tải lại đơn' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await within(screen.getByRole('region', { name: 'Lịch sử trạng thái' })).findByText(/Đã xác nhận → Đang đóng gói/)).toBeVisible();
    expect(packCalls(request)).toHaveLength(1);
  });

  it('resends the same key and version after a lost response', async () => {
    const user = userEvent.setup();
    const backend = server();
    let attempts = 0;
    const request = renderPage((url, options) => {
      if (options?.method !== 'POST') return backend(url, options);
      attempts += 1;
      return attempts === 1 ? Promise.reject(new client.ApiError('NETWORK_ERROR', 'Không thể kết nối.', 0)) : backend(url, options);
    });
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Đóng gói' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Không thể kết nối.');
    await user.click(within(dialog).getByRole('button', { name: 'Gửi lại' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Đóng gói' })).not.toBeInTheDocument());
    const [first, second] = packCalls(request);
    expect(second?.[1]?.idempotencyKey).toBe(first?.[1]?.idempotencyKey);
    expect(second?.[1]?.body).toEqual(first?.[1]?.body);
  });
});

describe('handing an order over', () => {
  const TRACKING = 'GHN-123.ABC_9';
  const packing = { ...order, status: 'PACKING', version: 2 };
  const shipped = { ...packing, status: 'SHIPPED', version: 3, trackingNumber: TRACKING, history: [...order.history,
    { id: 'h3', fromStatus: 'PACKING', toStatus: 'SHIPPED', actorName: 'Admin Thử', reason: null, version: 3, createdAt: '2026-11-01T05:00:00.000Z' }] };
  const transition = { id: ORDER_ID, code: order.code, status: 'SHIPPED', version: 3 };

  // A small server: the order stays packing until the handover is accepted.
  function server(): Answer {
    let current: unknown = packing;
    return (_url, options) => {
      if (options?.method !== 'POST') return Promise.resolve(current);
      current = shipped;
      return Promise.resolve(transition);
    };
  }
  const shipCalls = (request: ReturnType<typeof renderPage>) => request.mock.calls.filter(([url]) => String(url).endsWith('/ship'));

  async function openDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Bàn giao' }));
    return screen.findByRole('dialog', { name: `Bàn giao đơn ${order.code}?` });
  }

  it.each(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'DELIVERY_FAILED', 'RETURNED_TO_SHOP'])('offers no handover for a %s order', async (status) => {
    renderPage(() => Promise.resolve({ ...order, status }));
    await screen.findByRole('heading', { name: order.code, level: 1 });
    expect(screen.queryByRole('button', { name: 'Bàn giao' })).not.toBeInTheDocument();
  });

  it('warns that this cannot be undone, and sends nothing when the admin backs out', async () => {
    const user = userEvent.setup();
    const request = renderPage(server());
    const dialog = await openDialog(user);
    expect(within(dialog).getByText(/không hủy được/)).toBeVisible();
    expect(within(dialog).getByText(/Khách sẽ thấy mã này/)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Để sau' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(shipCalls(request)).toHaveLength(0);
  });

  it.each([['nothing', ''], ['too few characters', 'ab'], ['a space inside', 'GHN 123'], ['other characters', 'GHN<123>']])('asks for a real tracking number when given %s', async (_label, typed) => {
    const user = userEvent.setup();
    const request = renderPage(server());
    const dialog = await openDialog(user);
    if (typed) await user.type(within(dialog).getByLabelText(/Mã vận đơn/), typed);
    await user.click(within(dialog).getByRole('button', { name: 'Bàn giao' }));
    expect(await within(dialog).findByText('Chỉ gồm chữ, số, - _ . (3–100 ký tự).')).toBeVisible();
    expect(shipCalls(request)).toHaveLength(0);
  });

  it('sends the trimmed number and viewed version with a key, then shows it with no action left', async () => {
    const user = userEvent.setup();
    const request = renderPage(server());
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(/Mã vận đơn/), `  ${TRACKING}  `);
    await user.click(within(dialog).getByRole('button', { name: 'Bàn giao' }));
    expect(await screen.findByText(`Mã vận đơn: ${TRACKING}`)).toBeVisible();
    const [call] = shipCalls(request);
    expect(call?.[0]).toBe(`/admin/orders/${ORDER_ID}/ship`);
    expect(call?.[1]).toMatchObject({ method: 'POST', body: { expectedVersion: 2, trackingNumber: TRACKING } });
    expect(call?.[1]?.idempotencyKey).toEqual(expect.any(String));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Bàn giao' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hủy đơn' })).not.toBeInTheDocument();
  });

  it('explains a conflict and reloads the order instead of retrying', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const request = renderPage((_url, options) => {
      if (options?.method === 'POST') return Promise.reject(new client.ApiError('CONFLICT', 'Đơn đã thay đổi. Hãy tải lại đơn rồi thử lại.', 409));
      attempts += 1;
      return Promise.resolve(attempts === 1 ? packing : shipped);
    });
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(/Mã vận đơn/), TRACKING);
    await user.click(within(dialog).getByRole('button', { name: 'Bàn giao' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Đơn đã thay đổi.');
    expect(within(dialog).queryByRole('button', { name: 'Gửi lại' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Tải lại đơn' }));
    expect(await screen.findByText(`Mã vận đơn: ${TRACKING}`)).toBeVisible();
    expect(shipCalls(request)).toHaveLength(1);
  });

  it('locks the number after a lost response and resends the same key and content', async () => {
    const user = userEvent.setup();
    const backend = server();
    let attempts = 0;
    const request = renderPage((url, options) => {
      if (options?.method !== 'POST') return backend(url, options);
      attempts += 1;
      return attempts === 1 ? Promise.reject(new client.ApiError('NETWORK_ERROR', 'Không thể kết nối.', 0)) : backend(url, options);
    });
    const dialog = await openDialog(user);
    const field = within(dialog).getByLabelText(/Mã vận đơn/);
    await user.type(field, TRACKING);
    await user.click(within(dialog).getByRole('button', { name: 'Bàn giao' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Không thể kết nối.');
    expect(field).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Gửi lại' }));
    expect(await screen.findByText(`Mã vận đơn: ${TRACKING}`)).toBeVisible();
    const [first, second] = shipCalls(request);
    expect(second?.[1]?.idempotencyKey).toBe(first?.[1]?.idempotencyKey);
    expect(second?.[1]?.body).toEqual(first?.[1]?.body);
  });
});

describe('recording a delivery', () => {
  // The handover happened at 10:30:40 Vietnam time on 1 Nov; the clock now reads 09:15:30 on 3 Nov there.
  const NOW = new Date('2026-11-03T02:15:30.000Z');
  const shippedHistory = [...order.history,
    { id: 'h3', fromStatus: 'PACKING', toStatus: 'SHIPPED', actorName: 'Admin Thử', reason: null, version: 3, createdAt: '2026-11-01T03:30:40.000Z' }];
  const shipped = { ...order, status: 'SHIPPED', version: 3, trackingNumber: 'GHN-123', history: shippedHistory };
  const delivered = { ...shipped, status: 'DELIVERED', version: 4, deliveredAt: '2026-11-02T03:00:00.000Z', history: [...shippedHistory,
    { id: 'h4', fromStatus: 'SHIPPED', toStatus: 'DELIVERED', actorName: 'Admin Thử', reason: null, version: 4, createdAt: '2026-11-03T02:15:30.000Z' }] };
  const transition = { id: ORDER_ID, code: order.code, status: 'DELIVERED', version: 4 };

  // Only Date is faked: timers keep running, so the page and user-event behave as usual.
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'], now: NOW }));
  afterEach(() => vi.useRealTimers());

  // A small server: the order stays shipped until the delivery is accepted.
  function server(): Answer {
    let current: unknown = shipped;
    return (_url, options) => {
      if (options?.method !== 'POST') return Promise.resolve(current);
      current = delivered;
      return Promise.resolve(transition);
    };
  }
  const deliverCalls = (request: ReturnType<typeof renderPage>) => request.mock.calls.filter(([url]) => String(url).endsWith('/deliver'));
  const setTime = (dialog: HTMLElement, value: string) => fireEvent.change(within(dialog).getByLabelText(/Thời điểm giao/), { target: { value } });

  async function openDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Giao thành công' }));
    return screen.findByRole('dialog', { name: `Ghi đơn ${order.code} đã giao?` });
  }

  it.each(['PENDING', 'CONFIRMED', 'PACKING', 'DELIVERED', 'CANCELLED', 'DELIVERY_FAILED', 'RETURNED_TO_SHOP'])('offers no delivery for a %s order', async (status) => {
    renderPage(() => Promise.resolve({ ...order, status }));
    await screen.findByRole('heading', { name: order.code, level: 1 });
    expect(screen.queryByRole('button', { name: 'Giao thành công' })).not.toBeInTheDocument();
  });

  it('starts at the current Vietnam time, says COD is not collected yet, and sends nothing when the admin backs out', async () => {
    const user = userEvent.setup();
    const request = renderPage(server());
    const dialog = await openDialog(user);
    expect(within(dialog).getByLabelText(/Thời điểm giao/)).toHaveValue('2026-11-03T09:15');
    expect(within(dialog).getByText(/chưa được ghi nhận/)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Để sau' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(deliverCalls(request)).toHaveLength(0);
  });

  it.each([
    ['an empty time', '', 'Chọn thời điểm giao.'],
    ['a future time', '2026-11-03T09:16', 'Thời điểm giao không được ở tương lai.'],
    ['a time before the handover', '2026-11-01T10:29', 'Thời điểm giao không được trước lúc bàn giao.'],
  ])('refuses %s without calling the API', async (_label, value, message) => {
    const user = userEvent.setup();
    const request = renderPage(server());
    const dialog = await openDialog(user);
    setTime(dialog, value);
    await user.click(within(dialog).getByRole('button', { name: 'Giao thành công' }));
    expect(await within(dialog).findByText(message)).toBeVisible();
    expect(deliverCalls(request)).toHaveLength(0);
  });

  it('accepts the minute of the handover, since the field has no seconds', async () => {
    const user = userEvent.setup();
    const request = renderPage(server());
    const dialog = await openDialog(user);
    setTime(dialog, '2026-11-01T10:30');
    await user.click(within(dialog).getByRole('button', { name: 'Giao thành công' }));
    await waitFor(() => expect(deliverCalls(request)).toHaveLength(1));
    expect(deliverCalls(request)[0]?.[1]?.body).toEqual({ expectedVersion: 3, deliveredAt: '2026-11-01T03:30:00.000Z' });
  });

  it('sends the chosen Vietnam time with the viewed version and a key, then shows it with no action left', async () => {
    const user = userEvent.setup();
    const request = renderPage(server());
    const dialog = await openDialog(user);
    setTime(dialog, '2026-11-02T10:00');
    await user.click(within(dialog).getByRole('button', { name: 'Giao thành công' }));
    expect(await screen.findByText(/^Đã giao lúc: 10:00/)).toBeVisible();
    const [call] = deliverCalls(request);
    expect(call?.[0]).toBe(`/admin/orders/${ORDER_ID}/deliver`);
    expect(call?.[1]).toMatchObject({ method: 'POST', body: { expectedVersion: 3, deliveredAt: '2026-11-02T03:00:00.000Z' } });
    expect(call?.[1]?.idempotencyKey).toEqual(expect.any(String));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Giao thành công' })).not.toBeInTheDocument();
  });

  it('locks the time after a lost response and resends the same key and content', async () => {
    const user = userEvent.setup();
    const backend = server();
    let attempts = 0;
    const request = renderPage((url, options) => {
      if (options?.method !== 'POST') return backend(url, options);
      attempts += 1;
      return attempts === 1 ? Promise.reject(new client.ApiError('NETWORK_ERROR', 'Không thể kết nối.', 0)) : backend(url, options);
    });
    const dialog = await openDialog(user);
    setTime(dialog, '2026-11-02T10:00');
    await user.click(within(dialog).getByRole('button', { name: 'Giao thành công' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Không thể kết nối.');
    expect(within(dialog).getByLabelText(/Thời điểm giao/)).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Gửi lại' }));
    expect(await screen.findByText(/^Đã giao lúc: 10:00/)).toBeVisible();
    const [first, second] = deliverCalls(request);
    expect(second?.[1]?.idempotencyKey).toBe(first?.[1]?.idempotencyKey);
    expect(second?.[1]?.body).toEqual(first?.[1]?.body);
  });
});

describe('cancelling an order', () => {
  const REASON = 'Khách đặt nhầm size';
  const transition = { id: ORDER_ID, code: order.code, status: 'CANCELLED', version: 2 };
  const cancelled = { ...order, status: 'CANCELLED', version: 2, cancelledAt: '2026-11-01T05:00:00.000Z', cancelReason: REASON,
    history: [...order.history, { id: 'h3', fromStatus: 'CONFIRMED', toStatus: 'CANCELLED', actorName: 'Admin Thử', reason: REASON, version: 2,
      createdAt: '2026-11-01T05:00:00.000Z' }] };

  // A small server: the order stays open until a cancellation is accepted.
  function server(onCancel: () => Promise<unknown> = () => Promise.resolve(transition)): Answer {
    let current: unknown = order;
    return async (_url, options) => {
      if (options?.method !== 'POST') return current;
      const answer = await onCancel();
      current = cancelled;
      return answer;
    };
  }
  const cancelCalls = (request: ReturnType<typeof renderPage>) => request.mock.calls.filter(([url]) => String(url).endsWith('/cancel'));

  async function openDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Hủy đơn' }));
    return screen.findByRole('dialog', { name: `Hủy đơn ${order.code}?` });
  }

  it.each(['PENDING', 'CONFIRMED', 'PACKING'])('offers to cancel a %s order', async (status) => {
    renderPage(() => Promise.resolve({ ...order, status }));
    expect(await screen.findByRole('button', { name: 'Hủy đơn' })).toBeVisible();
  });

  it.each(['SHIPPED', 'DELIVERED', 'CANCELLED', 'DELIVERY_FAILED', 'RETURNED_TO_SHOP'])('offers no cancellation for a %s order', async (status) => {
    renderPage(() => Promise.resolve({ ...order, status }));
    await screen.findByRole('heading', { name: order.code, level: 1 });
    expect(screen.queryByRole('button', { name: 'Hủy đơn' })).not.toBeInTheDocument();
  });

  it('warns that the customer sees the reason, and sends nothing when the admin backs out', async () => {
    const user = userEvent.setup();
    const request = renderPage(server());
    const dialog = await openDialog(user);
    expect(within(dialog).getByText(/Khách sẽ thấy lý do này/)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Để sau' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(cancelCalls(request)).toHaveLength(0);
  });

  it.each([['nothing', ''], ['only spaces', '     '], ['too few characters', ' ab ']])('asks for a real reason when given %s', async (_label, typed) => {
    const user = userEvent.setup();
    const request = renderPage(server());
    const dialog = await openDialog(user);
    if (typed) await user.type(within(dialog).getByLabelText(/Lý do hủy/), typed);
    await user.click(within(dialog).getByRole('button', { name: 'Hủy đơn' }));
    expect(await within(dialog).findByText('Nhập lý do từ 3 đến 500 ký tự.')).toBeVisible();
    expect(within(dialog).getByText(/Khách sẽ thấy lý do này/)).toBeVisible();
    expect(cancelCalls(request)).toHaveLength(0);
  });

  it('sends the trimmed reason and viewed version with a key, then shows the cancelled order', async () => {
    const user = userEvent.setup();
    const request = renderPage(server());
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(/Lý do hủy/), `  ${REASON}  `);
    await user.click(within(dialog).getByRole('button', { name: 'Hủy đơn' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Hủy đơn' })).not.toBeInTheDocument());
    const [call] = cancelCalls(request);
    expect(call?.[0]).toBe(`/admin/orders/${ORDER_ID}/cancel`);
    expect(call?.[1]).toMatchObject({ method: 'POST', body: { expectedVersion: 1, reason: REASON } });
    expect(call?.[1]?.idempotencyKey).toEqual(expect.any(String));
    expect(await screen.findByText(`Lý do hủy: ${REASON}`)).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'Lịch sử trạng thái' })).getByText(/Đã xác nhận → Đã hủy/)).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sends once while a cancellation is in flight', async () => {
    const user = userEvent.setup();
    let finish: (value: unknown) => void = () => undefined;
    const request = renderPage(server(() => new Promise((resolve) => { finish = resolve; })));
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(/Lý do hủy/), REASON);
    const send = within(dialog).getByRole('button', { name: 'Hủy đơn' });
    await Promise.all([user.click(send), user.click(send)]);
    expect(cancelCalls(request)).toHaveLength(1);
    expect(send).toBeDisabled();
    finish(transition);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('explains a conflict and reloads the order instead of retrying', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const request = renderPage((_url, options) => {
      if (options?.method === 'POST') return Promise.reject(new client.ApiError('CONFLICT', 'Đơn đã thay đổi. Hãy tải lại đơn rồi thử lại.', 409));
      attempts += 1;
      return Promise.resolve(attempts === 1 ? order : cancelled);
    });
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(/Lý do hủy/), REASON);
    await user.click(within(dialog).getByRole('button', { name: 'Hủy đơn' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Đơn đã thay đổi.');
    expect(within(dialog).queryByRole('button', { name: 'Gửi lại' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Tải lại đơn' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText(`Lý do hủy: ${REASON}`)).toBeVisible();
    expect(cancelCalls(request)).toHaveLength(1);
  });

  it('locks the reason after a lost response and resends the same key and content', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const request = renderPage(server(() => {
      attempts += 1;
      return attempts === 1 ? Promise.reject(new client.ApiError('NETWORK_ERROR', 'Không thể kết nối.', 0)) : Promise.resolve(transition);
    }));
    const dialog = await openDialog(user);
    const field = within(dialog).getByLabelText(/Lý do hủy/);
    await user.type(field, REASON);
    await user.click(within(dialog).getByRole('button', { name: 'Hủy đơn' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Không thể kết nối.');
    expect(field).toBeDisabled();
    expect(field).toHaveValue(REASON);
    await user.click(within(dialog).getByRole('button', { name: 'Gửi lại' }));
    expect(await screen.findByText(`Lý do hủy: ${REASON}`)).toBeVisible();
    const [first, second] = cancelCalls(request);
    expect(second?.[1]?.idempotencyKey).toBe(first?.[1]?.idempotencyKey);
    expect(second?.[1]?.body).toEqual(first?.[1]?.body);
  });

  it('reloads the order when the admin leaves after a lost response, since it may have gone through', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const request = renderPage((_url, options) => {
      if (options?.method === 'POST') return Promise.reject(new client.ApiError('NETWORK_ERROR', 'Không thể kết nối.', 0));
      attempts += 1;
      return Promise.resolve(attempts === 1 ? order : cancelled);
    });
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(/Lý do hủy/), REASON);
    await user.click(within(dialog).getByRole('button', { name: 'Hủy đơn' }));
    await within(dialog).findByRole('alert');
    await user.click(within(dialog).getByRole('button', { name: 'Để sau' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Hủy đơn' })).not.toBeInTheDocument());
    expect(request.mock.calls.filter(([url]) => url === `/admin/orders/${ORDER_ID}`)).toHaveLength(2);
  });
});

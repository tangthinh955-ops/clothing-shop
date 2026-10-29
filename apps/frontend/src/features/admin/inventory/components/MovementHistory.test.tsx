import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { InventoryItem, MovementList } from '../api/inventory.api';
import { inventoryApi } from '../api/inventory.api';
import { MovementHistory } from './MovementHistory';

const variantIdFixture = '1a02c70e-28ec-4f92-b3ec-1241a80a2f01';
const stock: InventoryItem = { variantId: variantIdFixture, sku: 'AO-M-DEN', size: 'M', color: 'đen',
  productName: 'Áo cotton', onHand: 12, reserved: 2, available: 10, version: 3 };

const movement = (id: string, overrides: Partial<MovementList['items'][number]> = {}) => ({
  id, variantId: variantIdFixture, delta: 5, reason: 'Nhập kho e2e', before: 12, after: 17, reserved: 2, version: 4,
  createdAt: '2026-10-29T02:00:00.000Z', actor: { name: 'Admin thử' }, variant: { sku: 'AO-M-DEN' },
  ...overrides,
});
const firstPage: MovementList = { items: [movement('m1')], total: 1, page: 1, pageSize: 10 };

type MovementsFn = (variantId: string, page: number) => Promise<MovementList>;
type MovementSpy = Mock<MovementsFn>;

afterEach(() => vi.restoreAllMocks());

// Spies the feature API so the dialog's list behavior stays isolated from HTTP details.
function openHistory(results: Array<() => Promise<MovementList>>, onClose: () => void = vi.fn()) {
  let attempt = 0;
  const spy: MovementSpy = vi.fn<MovementsFn>(() => {
    const next = results[Math.min(attempt, results.length - 1)]!; // bounded clamp above keeps the index in range
    attempt += 1;
    return next();
  });
  vi.spyOn(inventoryApi, 'movements').mockImplementation(spy);
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={cache}>
      <MovementHistory item={stock} onClose={onClose} />
    </QueryClientProvider>,
  );
  return {
    spy, onClose,
    rerenderItem: (item: InventoryItem) => view.rerender(
      <QueryClientProvider client={cache}><MovementHistory item={item} onClose={onClose} /></QueryClientProvider>,
    ),
  };
}

describe('inventory movement history dialog', () => {
  it('loads the first page of movements for the row and shows the dialog title', async () => {
    const { spy } = openHistory([() => Promise.resolve(firstPage)]);
    expect(await screen.findByRole('dialog', { name: 'Lịch sử AO-M-DEN' })).toBeVisible();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toBe(variantIdFixture); // asserted single call above
    expect(spy.mock.calls[0]![1]).toBe(1);
    expect(await screen.findByText('Tìm thấy 1 giao dịch.', { exact: true })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Trang 2' })).not.toBeInTheDocument();
  });

  it('shows time, delta marker, before → after, reason and actor per row', async () => {
    openHistory([() => Promise.resolve(firstPage)]);
    const list = await screen.findByRole('list', { name: 'Lịch sử AO-M-DEN' });
    expect(within(list).getByText('+5')).toBeVisible();
    expect(within(list).getByText('12 → 17', { exact: true })).toBeVisible();
    expect(within(list).getByText('Lý do: Nhập kho e2e')).toBeVisible();
    expect(within(list).getByText('Người thực hiện: Admin thử')).toBeVisible();
    const stamp = list.querySelector('time');
    expect(stamp).not.toBeNull();
    expect(stamp).toHaveAttribute('datetime', '2026-10-29T02:00:00.000Z');
  });

  it('marks negative deltas as exports to adjusted stock', async () => {
    openHistory([() => Promise.resolve({
      ...firstPage, items: [movement('m1', { delta: -3, before: 17, after: 14 })],
    })]);
    const list = await screen.findByRole('list', { name: 'Lịch sử AO-M-DEN' });
    expect(within(list).getByText('-3')).toBeVisible();
    expect(within(list).getByText('17 → 14', { exact: true })).toBeVisible();
  });

  it('explains a variant without any movement yet', async () => {
    openHistory([() => Promise.resolve({ ...firstPage, items: [], total: 0 })]);
    expect(await screen.findByText('Chưa có giao dịch cho SKU này.')).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Lịch sử AO-M-DEN' })).not.toBeInTheDocument();
  });

  it('keeps the loading status until rows arrive', async () => {
    let finish: (value: MovementList) => void = () => { throw new Error('Movements not requested'); };
    openHistory([() => new Promise<MovementList>((resolve) => { finish = resolve; })]);
    expect(await screen.findByText('Đang tải lịch sử…')).toHaveAttribute('role', 'status');
    await act(async () => finish(firstPage));
    expect(await screen.findByRole('list', { name: 'Lịch sử AO-M-DEN' })).toBeVisible();
  });

  it('surfaces an error and retries the same page', async () => {
    const { spy } = openHistory([
      () => Promise.reject(new Error('Mất kết nối lịch sử.')),
      () => Promise.resolve(firstPage),
    ]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa tải được lịch sử. Vui lòng thử lại.');
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại lịch sử' }));
    expect(await screen.findByRole('list', { name: 'Lịch sử AO-M-DEN' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(spy.mock.calls.map((call) => call[1])).toEqual([1, 1]);
  });

  it('pages through history keeping the dialog open', async () => {
    const rows = Array.from({ length: 10 }, (_, index) => movement(`p1-${index}`, { reason: `Đợt trang 1 #${index}`, before: index }));
    const secondRows = [movement('p2-0', { reason: 'Đợt trang 2 A' }), movement('p2-1', { reason: 'Đợt trang 2 B' })];
    const { spy } = openHistory([
      () => Promise.resolve({ items: rows, total: 12, page: 1, pageSize: 10 }),
      () => Promise.resolve({ items: secondRows, total: 12, page: 2, pageSize: 10 }),
    ]);
    const list = await screen.findByRole('list', { name: 'Lịch sử AO-M-DEN' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(10);
    await userEvent.click(screen.getByRole('button', { name: 'Trang 2' }));
    expect(await screen.findByText('Lý do: Đợt trang 2 A')).toBeVisible();
    expect(screen.queryByText('Lý do: Đợt trang 1 #0')).not.toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Lịch sử AO-M-DEN' })).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('dialog', { name: 'Lịch sử AO-M-DEN' })).toBeVisible();
    expect(spy.mock.calls).toHaveLength(2);
    expect(spy.mock.calls[1]![1]).toBe(2); // asserted two calls above
  });

  it('keeps the current rows and pager on screen while the next page loads', async () => {
    const rows = Array.from({ length: 10 }, (_, index) => movement(`p1-${index}`, { reason: `Đợt trang 1 #${index}` }));
    let finish: (value: MovementList) => void = () => { throw new Error('Page 2 not requested'); };
    openHistory([
      () => Promise.resolve({ items: rows, total: 12, page: 1, pageSize: 10 }),
      () => new Promise<MovementList>((resolve) => { finish = resolve; }),
    ]);
    await screen.findByRole('list', { name: 'Lịch sử AO-M-DEN' });
    await userEvent.click(screen.getByRole('button', { name: 'Trang 2' }));
    expect(screen.queryByText('Đang tải lịch sử…')).not.toBeInTheDocument();
    expect(screen.getByText('Lý do: Đợt trang 1 #0')).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Phân trang lịch sử' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Đang ở trang 2' })).toBeDisabled();
    await act(async () => finish({ items: [movement('p2-0', { reason: 'Đợt trang 2 A' })], total: 12, page: 2, pageSize: 10 }));
    expect(await screen.findByText('Lý do: Đợt trang 2 A')).toBeVisible();
    expect(screen.queryByText('Lý do: Đợt trang 1 #0')).not.toBeInTheDocument();
  });

  it('reopening after a close loads fresh rows instead of flashing the old count', async () => {
    let finish: (value: MovementList) => void = () => { throw new Error('Reopen not requested'); };
    vi.spyOn(inventoryApi, 'movements')
      .mockImplementationOnce(() => Promise.resolve(firstPage))
      .mockImplementationOnce(() => new Promise<MovementList>((resolve) => { finish = resolve; }));
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const dialog = () => <QueryClientProvider client={cache}><MovementHistory item={stock} onClose={vi.fn()} /></QueryClientProvider>;
    const first = render(dialog());
    expect(await screen.findByText('Tìm thấy 1 giao dịch.', { exact: true })).toBeVisible();
    first.unmount();
    // The admin adjusts stock between closing and reopening; give the closed query time to be released.
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    render(dialog());
    expect(await screen.findByText('Đang tải lịch sử…')).toBeVisible();
    expect(screen.queryByText('Tìm thấy 1 giao dịch.', { exact: true })).not.toBeInTheDocument();
    await act(async () => finish({ ...firstPage, items: [movement('m2', { delta: 5, before: 17, after: 22 }), movement('m1')], total: 2 }));
    expect(await screen.findByText('Tìm thấy 2 giao dịch.', { exact: true })).toBeVisible();
  });

  it('closes through the close button without refetching', async () => {
    const { onClose } = openHistory([() => Promise.resolve(firstPage)]);
    await screen.findByRole('list', { name: 'Lịch sử AO-M-DEN' });
    expect(screen.getByRole('button', { name: 'Đóng' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the loaded page when the parent row refreshes with the same variant', async () => {
    const { spy, rerenderItem } = openHistory([() => Promise.resolve(firstPage)]);
    await screen.findByRole('list', { name: 'Lịch sử AO-M-DEN' });
    rerenderItem({ ...stock, onHand: 99, available: 97 });
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(within(screen.getByRole('list', { name: 'Lịch sử AO-M-DEN' })).getAllByRole('listitem')).toHaveLength(1);
  });
});

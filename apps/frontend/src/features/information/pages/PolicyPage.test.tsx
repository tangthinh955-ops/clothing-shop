import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../app/App';
import { authApi } from '../../auth/api/auth.api';

afterEach(() => vi.restoreAllMocks());

function renderPolicy(path: string) {
  vi.spyOn(authApi, 'me').mockResolvedValue(null);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}><App /></MemoryRouter>
  </QueryClientProvider>);
}

describe('real shop policies', () => {
  it.each([
    { path: '/shipping', title: 'Giao hàng', facts: [/30\.000đ/, /TP\. Hồ Chí Minh.*1–2 ngày/, /kiểm hàng/] },
    { path: '/returns-policy', title: 'Đổi & trả', facts: [/7 ngày/, /còn tag/, /khách trả phí vận chuyển hai chiều/, /shop chịu phí/] },
    { path: '/payment', title: 'Thanh toán', facts: [/COD/, /VietQR/, /2 giờ/, /mã đơn/] },
    { path: '/privacy', title: 'Chính sách bảo mật', facts: [/số điện thoại/, /đơn vị vận chuyển/, /không bán/, /xem hoặc xóa/] },
  ])('$path states the agreed policy', async ({ path, title, facts }) => {
    renderPolicy(path);
    expect(await screen.findByRole('heading', { name: title, level: 1 })).toBeVisible();
    const main = screen.getByRole('main');
    for (const fact of facts) expect(main.textContent).toMatch(fact);
    expect(main.textContent).not.toMatch(/demo|giả định|chưa được shop duyệt/i);
  });

  it('lists the seller on the contact page and only shows contact channels that exist', async () => {
    renderPolicy('/contact');
    expect(await screen.findByRole('heading', { name: 'Liên hệ', level: 1 })).toBeVisible();
    const main = screen.getByRole('main');
    expect(main.textContent).toMatch(/RMG Labels/);
    expect(main.textContent).toMatch(/Cá nhân kinh doanh/);
    expect(main.textContent).toMatch(/TP\. Hồ Chí Minh/);
    expect(screen.getAllByRole('link', { name: 'Instagram @rmglabels' }).length).toBeGreaterThan(0);
    expect(main.textContent).not.toMatch(/sẽ được bổ sung|đang cập nhật/i);
  });
});

import { expect, test } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../backend/dist/modules/prisma/prisma.service.js';
import { readEnvironment } from '../../backend/dist/config/environment.js';

// M4.4.1 guest order access E2E: the real COD confirmation link opens the private order view in a
// fresh browser page, survives a refresh, keeps the token out of URLs and storage, and answers
// wrong accesses with one uniform error.

const tag = randomUUID();
const SLUG = `access-${tag}`;
const NAME = `Áo link đơn ${tag.slice(0, 8)}`;
let db: PrismaService;
let categoryId = '';
let productId = '';
let variantId = '';
const trackedOrderCodes: string[] = [];

const UNIFORM_404 = 'Không tìm thấy đơn hàng. Kiểm tra lại mã đơn hoặc đường dẫn đã nhận từ shop.';
// Backend note limit is exactly 500; the E2E run shares one throttled POST /orders budget per IP,
// so the note case rides the same real checkout as the link test instead of adding another POST.
const NOTE_500 = 'Ghi chú giao sau 18h: '.padEnd(499, 'x') + '.';

function assertOwnedDatabase() {
  const url = new URL(process.env['DATABASE_URL'] ?? '');
  const database = decodeURIComponent(url.pathname.slice(1));
  if (process.env['NODE_ENV'] !== 'test' || !['postgres:', 'postgresql:'].includes(url.protocol)
    || database !== process.env['CLOTHING_TEST_DATABASE'] || !/^clothing_e2e_[0-9a-f]{16}_test$/.test(database)) {
    throw new Error('Order access E2E requires the isolated test runner database.');
  }
}

test.beforeAll(async () => {
  assertOwnedDatabase();
  db = new PrismaService(readEnvironment(process.env));
  await db.shopSettings.create({ data: { id: 'default', shippingFeeVnd: 30000, bankDeadlineMinutes: 120 } });
  const category = await db.category.create({ data: { name: 'Danh mục link đơn thử', slug: `acc-${tag}`, active: true } });
  categoryId = category.id;
  const product = await db.product.create({ data: { name: NAME, slug: SLUG, description: '', categoryId,
    status: 'PUBLISHED', priceFrom: 200000, variants: { create: [
      { sku: `ACC-${tag.toUpperCase()}`, size: 'M', color: 'Đen', price: 200000, active: true,
        inventory: { create: { onHand: 4, reserved: 0 } } }] } },
    include: { variants: true } });
  productId = product.id;
  variantId = product.variants[0]!.id;
});

test.afterAll(async () => {
  if (!db) return;
  assertOwnedDatabase();
  try {
    for (const code of trackedOrderCodes) {
      const order = await db.order.findFirst({ where: { code }, select: { id: true } });
      if (!order) continue;
      await db.orderStatusHistory.deleteMany({ where: { orderId: order.id } });
      await db.orderItem.deleteMany({ where: { orderId: order.id } });
      await db.idempotencyRecord.deleteMany({ where: { resourceId: order.id } });
      await db.order.delete({ where: { id: order.id } });
    }
    await db.checkoutQuote.deleteMany({});
    await db.inventoryMovement.deleteMany({ where: { variant: { productId } } });
    await db.inventory.deleteMany({ where: { variant: { productId } } });
    await db.variant.deleteMany({ where: { productId } });
    await db.product.deleteMany({ where: { id: productId } });
    await db.category.deleteMany({ where: { id: categoryId } });
    await db.shopSettings.deleteMany({ where: { id: 'default' } });
  } finally { await db.$disconnect(); }
});

async function addToCart(page: import('@playwright/test').Page) {
  await page.goto(`/products/${SLUG}`);
  await page.getByRole('group', { name: 'Chọn màu' }).getByRole('button', { name: 'Đen', exact: true }).click();
  await page.getByRole('group', { name: 'Chọn size' }).getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm vào giỏ' }).click();
  await page.getByRole('button', { name: 'Đóng giỏ hàng' }).click();
}

/** Captures the lookup token only from the create response; it never enters any URL the app calls. */
function trackCreatedOrder(page: import('@playwright/test').Page, captured: { token: string; code: string }) {
  void page.route('**/api/v1/orders', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const response = await route.fetch();
    const body = (await response.body()).toString();
    const parsed = JSON.parse(body) as { lookupToken?: string; order?: { code?: string } };
    captured.token = parsed.lookupToken ?? '';
    captured.code = parsed.order?.code ?? '';
    return route.fulfill({ response });
  });
}

/** Places a real COD order through the checkout page and waits for the confirmation. */
async function checkoutAndOrder(page: import('@playwright/test').Page, phone = '0901234567', note = '') {
  await addToCart(page);
  await page.goto('/cart');
  await page.getByRole('link', { name: 'Xem phí và tổng tiền' }).click();
  await page.getByRole('button', { name: 'Lấy báo giá' }).click();
  await page.getByLabel('Họ tên', { exact: true }).fill('Nguyễn Thử Link');
  await page.getByLabel('Số điện thoại', { exact: true }).fill(phone);
  await page.getByLabel('Tỉnh/thành', { exact: true }).fill('TP. Hồ Chí Minh');
  await page.getByLabel('Phường/xã', { exact: true }).fill('Phường Bến Nghé');
  await page.getByLabel('Địa chỉ cụ thể', { exact: true }).fill('12 Nguyễn Huệ, Quận 1');
  if (note) await page.getByLabel('Ghi chú (không bắt buộc)').fill(note);
  await page.getByRole('button', { name: 'Đặt hàng COD' }).click();
  await expect(page.getByText(/Đã tạo đơn hàng COD/)).toBeVisible();
}

test('the COD confirmation link opens the private order view in a fresh page and survives refresh', async ({ page }, info) => {
  test.setTimeout(60000);
  const captured = { token: '', code: '' };
  trackCreatedOrder(page, captured);
  await checkoutAndOrder(page, '0901234567', NOTE_500);
  const token = captured.token;
  const code = captured.code;
  expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);
  trackedOrderCodes.push(code);

  const link = page.getByRole('link', { name: 'Xem đơn hàng' });
  const href = await link.getAttribute('href');
  // fragment carries the token; query string stays free of it
  expect(href).toBe(`/orders/${code}#t=${token}`);

  const orderPage = await page.context().newPage();
  const accessRequests: Array<{ url: string; tokenHeader: string }> = [];
  await orderPage.route('**/api/v1/orders/**', async (route) => {
    const request = route.request();
    accessRequests.push({ url: request.url(), tokenHeader: request.headers()['x-order-token'] ?? '' });
    return route.fallback();
  });
  await orderPage.goto(new URL(href!, page.url()).toString());
  await expect(orderPage.getByText(code)).toBeVisible();
  await expect(orderPage.getByText(/chưa thu tiền/i)).toBeVisible();
  await expect(orderPage.getByText(NAME)).toBeVisible();
  await expect(orderPage.getByText(/230\.000/)).toBeVisible();
  await expect(orderPage.getByText(/Nguyễn Thử Link/)).toBeVisible();
  // the committed 500-character note (backend limit) renders verbatim, not as an error state
  await expect(orderPage.getByText(/^Ghi chú: /)).toHaveText(`Ghi chú: ${NOTE_500}`);
  // every load sends the private GET: token only in the header, never in any URL
  expect(accessRequests.length).toBeGreaterThan(0);
  for (const request of accessRequests) {
    expect(request.url, 'no query string in the access URL').not.toContain('?');
    expect(request.url, 'token never rides in the access URL').not.toContain(token);
    expect(request.tokenHeader, 'the token travels in X-Order-Token').toBe(token);
  }

  // refresh keeps working because the fragment stays in the address
  await orderPage.reload();
  await expect(orderPage.getByText(code)).toBeVisible();
  await expect(orderPage.getByText(NAME)).toBeVisible();
  await expect(orderPage.getByText(/^Ghi chú: /)).toHaveText(`Ghi chú: ${NOTE_500}`);

  // no token in web storage of either page
  expect(await page.evaluate(() => JSON.stringify(window.localStorage))).not.toContain(token);
  expect(await orderPage.evaluate(() => JSON.stringify(window.localStorage))).not.toContain(token);
  expect(await orderPage.evaluate(() => JSON.stringify(window.sessionStorage))).not.toContain(token);
  expect(await page.evaluate(() => JSON.stringify(window.sessionStorage))).not.toContain(token);

  // mobile 390px keeps the order view inside the viewport
  await orderPage.setViewportSize({ width: 390, height: 844 });
  expect(await orderPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await orderPage.screenshot({ path: info.outputPath('order-access-mobile.png'), fullPage: true });
  await orderPage.close();
});

test('foreign, malformed and missing private access link fragment all fail uniformly without PII', async ({ page }) => {
  // build a committed fixture order in the shared DB, deterministically identified by its token hash
  const fixtureCode = 'ACCFIXTURE3X';
  const fixtureToken = 'F'.repeat(32);
  await db.order.create({ data: {
    code: fixtureCode, status: 'PENDING', source: 'WEB', userId: null, quoteId: null,
    recipientName: 'Lê Thử Riêng', phone: '0918000999', email: 'access-fixture@example.test',
    province: 'TP. Hồ Chí Minh', district: '', ward: 'Phường Bến Nghé', addressLine: '12 Nguyễn Huệ',
    note: null, method: 'COD', currency: 'VND', subtotalVnd: 200000, shippingFeeVnd: 30000,
    totalVnd: 230000, settingsVersion: 0, lookupTokenHash: createHash('sha256').update(fixtureToken).digest('hex'),
    version: 0,
    items: { create: [{ variantId, productName: 'Áo fixture riêng', sku: 'ACC-FIX-01', size: 'M',
      color: 'Đen', unitPriceVnd: 200000, quantity: 1, lineTotalVnd: 200000 }] },
    history: { create: [{ fromStatus: null, toStatus: 'PENDING', actorType: 'GUEST', actorId: null, version: 0 }] },
  } });
  trackedOrderCodes.push(fixtureCode);

  for (const fragment of ['#t=' + 'ff'.repeat(16), '#t=nope', '']) {
    await page.goto(`/orders/${fixtureCode}${fragment}`);
    await expect(page.getByText(UNIFORM_404)).toBeVisible();
    expect(await page.content()).not.toContain('Lê Thử Riêng');
  }
  // a plausible token owned by another order cannot open this order either
  await page.goto(`/orders/${fixtureCode}#t=${'A'.repeat(32)}`);
  await expect(page.getByText(UNIFORM_404)).toBeVisible();
  expect(await page.content()).not.toContain('Lê Thử Riêng');
  // positive control: its own token really opens this fixture, so the failures above were rejections
  await page.goto(`/orders/${fixtureCode}#t=${fixtureToken}`);
  await expect(page.getByText(/Lê Thử Riêng/)).toBeVisible();
  await expect(page.getByText(/Áo fixture riêng/)).toBeVisible();
  await expect(page.getByText(/Khách đặt hàng/)).toBeVisible();
});

test('a replay answer without a token never fabricates a private link', async ({ page }) => {
  await page.route('**/api/v1/orders', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    // The replay echoes the exact command the shopper sent (parse validates line-by-line) but
    // carries no lookupToken — exactly what the server answers on a safe resend.
    const command: { items?: Array<{ variantId?: string; quantity?: number }> }
      = JSON.parse(route.request().postData() ?? '{}');
    const line = command.items?.[0] ?? { variantId: '00000000-0000-4000-8000-000000000000', quantity: 1 };
    const unitPriceVnd = 200000;
    const subtotal = unitPriceVnd * (line.quantity ?? 1);
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
      order: { code: 'RF' + tag.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10), status: 'PENDING',
        method: 'COD', currency: 'VND',
        items: [{ variantId: line.variantId!, productName: 'Áo replay thử', sku: 'ACC-REPLAY-01', size: 'M',
          color: 'Đen', unitPriceVnd, quantity: line.quantity ?? 1, lineTotalVnd: subtotal }],
        subtotal, shippingFee: 0, total: subtotal }, replay: true }) });
  });
  await checkoutAndOrder(page);
  await expect(page.getByRole('link', { name: 'Xem đơn hàng' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sao chép link riêng' })).toHaveCount(0);
});

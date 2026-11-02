import { expect, test, type Page } from '@playwright/test';
import { hash } from 'argon2';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../backend/dist/modules/prisma/prisma.service.js';
import { readEnvironment } from '../../backend/dist/config/environment.js';

// M4.5.1 admin order list: an order a guest really places through checkout shows up for the admin,
// who can filter and search it; a customer account stays out. Runs only through tools/test-e2e.mjs.

const tag = randomUUID();
const SLUG = `admin-orders-${tag}`;
const NAME = `Áo đơn quản trị ${tag.slice(0, 8)}`;
const SKU = `ADO-${tag.toUpperCase()}`;
const PHONE = '0917000555';
const RECIPIENT = 'Nguyễn Thử Đơn Admin';
const adminEmail = `${tag}-admin@example.test`;
const customerEmail = `${tag}-customer@example.test`;
const password = 'admin-orders-e2e-only-password-123!';

let db: PrismaService;
let categoryId = '';
let productId = '';

function assertOwnedDatabase() {
  const url = new URL(process.env['DATABASE_URL'] ?? '');
  const database = decodeURIComponent(url.pathname.slice(1));
  if (process.env['NODE_ENV'] !== 'test' || !['postgres:', 'postgresql:'].includes(url.protocol)
    || database !== process.env['CLOTHING_TEST_DATABASE'] || !/^clothing_e2e_[0-9a-f]{16}_test$/.test(database)) {
    throw new Error('Admin orders E2E requires the isolated test runner database.');
  }
}

test.beforeAll(async () => {
  assertOwnedDatabase();
  db = new PrismaService(readEnvironment(process.env));
  const passwordHash = await hash(password);
  await db.user.createMany({ data: [
    { email: adminEmail, name: 'Admin đơn thử', role: 'ADMIN', passwordHash, emailVerifiedAt: new Date() },
    { email: customerEmail, name: 'Khách đơn thử', role: 'CUSTOMER', passwordHash, emailVerifiedAt: new Date() },
  ] });
  await db.shopSettings.create({ data: { id: 'default', shippingFeeVnd: 30000, bankDeadlineMinutes: 120 } });
  const category = await db.category.create({ data: { name: 'Danh mục đơn quản trị', slug: `ado-${tag}`, active: true } });
  categoryId = category.id;
  const product = await db.product.create({ data: { name: NAME, slug: SLUG, description: '', categoryId,
    status: 'PUBLISHED', priceFrom: 200000, variants: { create: [
      { sku: SKU, size: 'M', color: 'Đen', price: 200000, active: true, inventory: { create: { onHand: 5, reserved: 0 } } }] } } });
  productId = product.id;
});

test.afterAll(async () => {
  if (!db) return;
  assertOwnedDatabase();
  try {
    const orders = await db.order.findMany({ where: { items: { some: { sku: SKU } } }, select: { id: true } });
    for (const { id } of orders) {
      await db.orderStatusHistory.deleteMany({ where: { orderId: id } });
      await db.orderItem.deleteMany({ where: { orderId: id } });
      await db.idempotencyRecord.deleteMany({ where: { resourceId: id } });
      await db.order.delete({ where: { id } });
    }
    await db.inventoryMovement.deleteMany({ where: { variant: { productId } } });
    await db.inventory.deleteMany({ where: { variant: { productId } } });
    await db.variant.deleteMany({ where: { productId } });
    await db.product.deleteMany({ where: { id: productId } });
    await db.category.deleteMany({ where: { id: categoryId } });
    await db.shopSettings.deleteMany({ where: { id: 'default' } });
    await db.user.deleteMany({ where: { email: { in: [adminEmail, customerEmail] } } });
  } finally { await db.$disconnect(); }
});

async function placeCodOrder(page: Page): Promise<string> {
  await page.goto(`/products/${SLUG}`);
  await page.getByRole('group', { name: 'Chọn màu' }).getByRole('button', { name: 'Đen', exact: true }).click();
  await page.getByRole('group', { name: 'Chọn size' }).getByRole('button', { name: 'M', exact: true }).click();
  await page.getByLabel('Số lượng', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Thêm vào giỏ' }).click();
  await page.getByRole('button', { name: 'Đóng giỏ hàng' }).click();
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Lấy báo giá' }).click();
  await expect(page.getByRole('heading', { name: 'Thông tin nhận hàng' })).toBeVisible();
  await page.getByLabel('Họ tên', { exact: true }).fill(RECIPIENT);
  await page.getByLabel('Số điện thoại', { exact: true }).fill(PHONE);
  await page.getByLabel('Tỉnh/thành', { exact: true }).fill('TP. Hồ Chí Minh');
  await page.getByLabel('Phường/xã', { exact: true }).fill('Phường Bến Nghé');
  await page.getByLabel('Địa chỉ cụ thể', { exact: true }).fill('12 Nguyễn Huệ, Quận 1');
  await page.getByRole('button', { name: 'Đặt hàng COD' }).click();
  await expect(page.getByText(/Đã tạo đơn hàng COD/)).toBeVisible();
  const code = await page.getByText(/^[A-HJ-NP-Z2-9]{12}$/).first().textContent();
  if (!code) throw new Error('The confirmation screen did not show an order code.');
  return code;
}

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await Promise.all([
    page.waitForResponse((answer) => new URL(answer.url()).pathname === '/api/v1/auth/login' && answer.ok()),
    page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(),
  ]);
}

test('a guest order reaches the admin list, which filters and searches it', async ({ page, browser }, info) => {
  test.setTimeout(60000);
  const code = await placeCodOrder(page);

  const adminContext = await browser.newContext({ baseURL: info.project.use.baseURL ?? 'http://127.0.0.1:5174',
    extraHTTPHeaders: info.project.use.extraHTTPHeaders ?? {} });
  const admin = await adminContext.newPage();
  try {
    await login(admin, adminEmail);
    await admin.goto('/admin');
    await admin.getByRole('link', { name: 'Đơn hàng', exact: true }).click();
    await expect(admin).toHaveURL(/\/admin\/orders$/);

    const row = admin.getByRole('listitem', { name: code, exact: true });
    await expect(row).toContainText('Chờ xác nhận');
    await expect(row).toContainText(RECIPIENT);
    await expect(row).toContainText(PHONE);
    await expect(row).toContainText(/430\.000\s*₫/);
    await expect(row).toContainText('2 sản phẩm');
    await expect(row).not.toContainText('Nguyễn Huệ');

    // The filter lives on the URL and survives a reload; an order in another state is filtered out.
    await admin.getByLabel('Trạng thái').selectOption('CANCELLED');
    await expect(admin).toHaveURL(/status=CANCELLED/);
    await expect(admin.getByText('Không có đơn phù hợp bộ lọc.')).toBeVisible();
    await admin.reload();
    await expect(admin.getByLabel('Trạng thái')).toHaveValue('CANCELLED');
    await admin.getByRole('button', { name: 'Xóa lọc' }).click();
    await expect(row).toBeVisible();

    await admin.getByLabel('Tìm theo mã đơn, SĐT hoặc tên').fill(`+84 ${PHONE.slice(1)}`);
    await admin.keyboard.press('Enter');
    await expect(admin).toHaveURL(/q=/);
    await expect(row).toBeVisible();

    await admin.setViewportSize({ width: 390, height: 844 });
    expect(await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await admin.screenshot({ path: info.outputPath('admin-orders-mobile.png'), fullPage: true, animations: 'disabled' });

    // M4.5.2: the code opens the full snapshot; a note survives a reload and the way back keeps the search.
    await admin.setViewportSize({ width: 1280, height: 720 });
    await admin.getByRole('link', { name: code, exact: true }).click();
    await expect(admin.getByRole('heading', { name: code, level: 1 })).toBeVisible();
    const recipient = admin.getByRole('region', { name: 'Người nhận' });
    await expect(recipient).toContainText(RECIPIENT);
    await expect(recipient).toContainText('12 Nguyễn Huệ, Quận 1, Phường Bến Nghé, TP. Hồ Chí Minh');
    await expect(admin.getByRole('region', { name: 'Sản phẩm' })).toContainText(`${SKU} · M · Đen`);
    await expect(admin.getByRole('region', { name: 'Lịch sử trạng thái' })).toContainText('Khách đặt hàng');

    const note = `Ghi chú thử ${tag.slice(0, 8)}`;
    await admin.getByLabel('Thêm ghi chú').fill(note);
    await admin.getByRole('button', { name: 'Lưu ghi chú' }).click();
    const notes = admin.getByRole('region', { name: 'Ghi chú nội bộ' });
    await expect(notes.getByText(note, { exact: true })).toBeVisible();
    await expect(admin.getByLabel('Thêm ghi chú')).toHaveValue('');
    await admin.reload();
    await expect(notes.getByText(note, { exact: true })).toBeVisible();
    await expect(notes).toContainText('Admin đơn thử');

    // M4.5.3: confirming moves the order on, records who did it, and keeps the same stock on hold.
    const held = await db.inventory.findFirstOrThrow({ where: { variant: { productId } }, select: { onHand: true, reserved: true } });
    await admin.getByRole('button', { name: 'Xác nhận đơn' }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click();
    await expect(admin.getByRole('button', { name: 'Xác nhận đơn' })).toHaveCount(0);
    const history = admin.getByRole('region', { name: 'Lịch sử trạng thái' });
    await expect(history).toContainText('Chờ xác nhận → Đã xác nhận');
    await expect(history).toContainText('Admin đơn thử');
    await admin.reload();
    await expect(history).toContainText('Chờ xác nhận → Đã xác nhận');
    await expect(admin.getByRole('button', { name: 'Xác nhận đơn' })).toHaveCount(0);
    expect(await db.inventory.findFirstOrThrow({ where: { variant: { productId } }, select: { onHand: true, reserved: true } })).toEqual(held);

    await admin.setViewportSize({ width: 390, height: 844 });
    expect(await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await admin.screenshot({ path: info.outputPath('admin-order-detail-mobile.png'), fullPage: true, animations: 'disabled' });

    await admin.getByRole('link', { name: 'Về danh sách đơn' }).click();
    await expect(admin).toHaveURL(/\/admin\/orders\?.*q=/);
  } finally {
    await adminContext.close();
  }
});

// M4.5.7: the shop cancels an order it can no longer fill; the stock comes back and the customer sees why.
test('an admin cancels an order, which gives the stock back and tells the customer', async ({ page, browser }, info) => {
  test.setTimeout(60000);
  const held = () => db.inventory.findFirstOrThrow({ where: { variant: { productId } }, select: { onHand: true, reserved: true } });
  const before = await held();
  const code = await placeCodOrder(page);
  const orderLink = await page.getByRole('link', { name: 'Xem đơn hàng' }).getAttribute('href');
  if (!orderLink) throw new Error('The confirmation screen did not link to the order.');
  expect(await held()).toEqual({ onHand: before.onHand, reserved: before.reserved + 2 });

  const adminContext = await browser.newContext({ baseURL: info.project.use.baseURL ?? 'http://127.0.0.1:5174',
    extraHTTPHeaders: info.project.use.extraHTTPHeaders ?? {} });
  const admin = await adminContext.newPage();
  try {
    await login(admin, adminEmail);
    await admin.goto(`/admin/orders?q=${code}`);
    await admin.getByRole('link', { name: code, exact: true }).click();

    await admin.getByRole('button', { name: 'Hủy đơn', exact: true }).click();
    const dialog = admin.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Hủy đơn', exact: true }).click();
    await expect(dialog.getByText('Nhập lý do từ 3 đến 500 ký tự.')).toBeVisible();

    await admin.setViewportSize({ width: 390, height: 844 });
    expect(await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await admin.screenshot({ path: info.outputPath('admin-order-cancel-dialog-mobile.png'), animations: 'disabled' });
    await admin.setViewportSize({ width: 1280, height: 720 });

    const reason = `Hết hàng lỗi ${tag.slice(0, 8)}`;
    await dialog.getByLabel(/Lý do hủy/).fill(reason);
    await dialog.getByRole('button', { name: 'Hủy đơn', exact: true }).click();
    await expect(admin.getByRole('button', { name: 'Hủy đơn', exact: true })).toHaveCount(0);
    await expect(admin.getByText(`Lý do hủy: ${reason}`)).toBeVisible();
    const history = admin.getByRole('region', { name: 'Lịch sử trạng thái' });
    await expect(history).toContainText('Chờ xác nhận → Đã hủy');
    await expect(history).toContainText('Admin đơn thử');
    await admin.reload();
    await expect(admin.getByText(`Lý do hủy: ${reason}`)).toBeVisible();
    await expect(admin.getByRole('button', { name: 'Hủy đơn', exact: true })).toHaveCount(0);
    expect(await held()).toEqual(before);

    await page.goto(orderLink);
    await expect(page.getByText('Đã hủy').first()).toBeVisible();
    await expect(page.getByText(new RegExp(reason))).toBeVisible();
    await expect(page.getByText('Admin đơn thử')).toHaveCount(0);
  } finally {
    await adminContext.close();
  }
});

// M4.5.4: confirm, then pack; packing keeps the stock on hold, and the shop can still cancel before handover.
test('an admin packs a confirmed order and can still cancel it', async ({ page, browser }, info) => {
  test.setTimeout(60000);
  const held = () => db.inventory.findFirstOrThrow({ where: { variant: { productId } }, select: { onHand: true, reserved: true } });
  const before = await held();
  const code = await placeCodOrder(page);
  const orderLink = await page.getByRole('link', { name: 'Xem đơn hàng' }).getAttribute('href');
  if (!orderLink) throw new Error('The confirmation screen did not link to the order.');

  const adminContext = await browser.newContext({ baseURL: info.project.use.baseURL ?? 'http://127.0.0.1:5174',
    extraHTTPHeaders: info.project.use.extraHTTPHeaders ?? {} });
  const admin = await adminContext.newPage();
  try {
    await login(admin, adminEmail);
    await admin.goto(`/admin/orders?q=${code}`);
    await admin.getByRole('link', { name: code, exact: true }).click();
    await expect(admin.getByRole('button', { name: 'Đóng gói', exact: true })).toHaveCount(0);

    await admin.getByRole('button', { name: 'Xác nhận đơn' }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click();
    await admin.getByRole('button', { name: 'Đóng gói', exact: true }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Đóng gói', exact: true }).click();

    const history = admin.getByRole('region', { name: 'Lịch sử trạng thái' });
    await expect(history).toContainText('Đã xác nhận → Đang đóng gói');
    await expect(admin.getByRole('button', { name: 'Đóng gói', exact: true })).toHaveCount(0);
    await admin.reload();
    await expect(history).toContainText('Đã xác nhận → Đang đóng gói');
    expect(await held()).toEqual({ onHand: before.onHand, reserved: before.reserved + 2 });

    await page.goto(orderLink);
    await expect(page.getByText('Đang đóng gói').first()).toBeVisible();

    await admin.setViewportSize({ width: 390, height: 844 });
    expect(await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await admin.screenshot({ path: info.outputPath('admin-order-packing-mobile.png'), fullPage: true, animations: 'disabled' });
    await admin.setViewportSize({ width: 1280, height: 720 });

    await admin.getByRole('button', { name: 'Hủy đơn', exact: true }).click();
    const dialog = admin.getByRole('dialog');
    await dialog.getByLabel(/Lý do hủy/).fill('Sản phẩm bị lỗi khi đóng gói');
    await dialog.getByRole('button', { name: 'Hủy đơn', exact: true }).click();
    await expect(history).toContainText('Đang đóng gói → Đã hủy');
    expect(await held()).toEqual(before);

    await page.reload();
    await expect(page.getByText('Đã hủy').first()).toBeVisible();
  } finally {
    await adminContext.close();
  }
});

// M4.5.5: handing over takes the goods out of stock once, ends the way to cancel and tells the customer the tracking number.
test('an admin hands a packed order over, which takes it out of stock', async ({ page, browser }, info) => {
  test.setTimeout(60000);
  const held = () => db.inventory.findFirstOrThrow({ where: { variant: { productId } }, select: { onHand: true, reserved: true } });
  const before = await held();
  const code = await placeCodOrder(page);
  const orderLink = await page.getByRole('link', { name: 'Xem đơn hàng' }).getAttribute('href');
  if (!orderLink) throw new Error('The confirmation screen did not link to the order.');

  const adminContext = await browser.newContext({ baseURL: info.project.use.baseURL ?? 'http://127.0.0.1:5174',
    extraHTTPHeaders: info.project.use.extraHTTPHeaders ?? {} });
  const admin = await adminContext.newPage();
  try {
    await login(admin, adminEmail);
    await admin.goto(`/admin/orders?q=${code}`);
    await admin.getByRole('link', { name: code, exact: true }).click();
    await admin.getByRole('button', { name: 'Xác nhận đơn' }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click();
    await admin.getByRole('button', { name: 'Đóng gói', exact: true }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Đóng gói', exact: true }).click();

    await admin.getByRole('button', { name: 'Bàn giao', exact: true }).click();
    const dialog = admin.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Bàn giao', exact: true }).click();
    await expect(dialog.getByText('Chỉ gồm chữ, số, - _ . (3–100 ký tự).')).toBeVisible();

    await admin.setViewportSize({ width: 390, height: 844 });
    expect(await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await admin.screenshot({ path: info.outputPath('admin-order-ship-dialog-mobile.png'), animations: 'disabled' });
    await admin.setViewportSize({ width: 1280, height: 720 });

    const tracking = `GHN-${tag.slice(0, 8)}`;
    await dialog.getByLabel(/Mã vận đơn/).fill(tracking);
    await dialog.getByRole('button', { name: 'Bàn giao', exact: true }).click();
    await expect(admin.getByText(`Mã vận đơn: ${tracking}`)).toBeVisible();
    const history = admin.getByRole('region', { name: 'Lịch sử trạng thái' });
    await expect(history).toContainText('Đang đóng gói → Đã bàn giao vận chuyển');
    await expect(history).toContainText('Admin đơn thử');
    await expect(admin.getByRole('button', { name: 'Hủy đơn', exact: true })).toHaveCount(0);
    await admin.reload();
    await expect(admin.getByText(`Mã vận đơn: ${tracking}`)).toBeVisible();
    await expect(admin.getByRole('button', { name: 'Bàn giao', exact: true })).toHaveCount(0);
    expect(await held()).toEqual({ onHand: before.onHand - 2, reserved: before.reserved });

    await page.goto(orderLink);
    await expect(page.getByText('Đã bàn giao vận chuyển').first()).toBeVisible();
    await expect(page.getByText(`Mã vận đơn: ${tracking}`)).toBeVisible();
    await expect(page.getByText('Admin đơn thử')).toHaveCount(0);

    // M4.5.6: the delivery closes the order at the time shown in the field, read as Vietnam time, with no further stock change.
    const shippedStock = await held();
    await admin.getByRole('button', { name: 'Giao thành công', exact: true }).click();
    const deliveryDialog = admin.getByRole('dialog');
    const chosen = await deliveryDialog.getByLabel(/Thời điểm giao/).inputValue();
    await admin.setViewportSize({ width: 390, height: 844 });
    expect(await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await admin.screenshot({ path: info.outputPath('admin-order-deliver-dialog-mobile.png'), animations: 'disabled' });
    await admin.setViewportSize({ width: 1280, height: 720 });
    await deliveryDialog.getByRole('button', { name: 'Giao thành công', exact: true }).click();
    await expect(admin.getByText(/^Đã giao lúc:/)).toBeVisible();
    await expect(history).toContainText('Đã bàn giao vận chuyển → Đã giao');
    await expect(admin.getByRole('button', { name: 'Giao thành công', exact: true })).toHaveCount(0);
    const saved = await db.order.findUniqueOrThrow({ where: { code }, select: { status: true, deliveredAt: true } });
    expect(saved.status).toBe('DELIVERED');
    expect(saved.deliveredAt?.toISOString()).toBe(new Date(`${chosen}:00+07:00`).toISOString());
    expect(await held()).toEqual(shippedStock);

    await page.reload();
    await expect(page.getByText('Đã giao', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/^Đã giao lúc:/)).toBeVisible();
  } finally {
    await adminContext.close();
  }
});

test('a customer account cannot open the order list', async ({ page }) => {
  await login(page, customerEmail);
  await page.goto('/admin/orders');
  await expect(page.getByRole('heading', { name: 'Đơn hàng', level: 1 })).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/admin\/orders/);
});

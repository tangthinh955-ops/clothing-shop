import { expect, test } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../backend/dist/modules/prisma/prisma.service.js';
import { readEnvironment } from '../../backend/dist/config/environment.js';

// M4.4.2 guest order lookup E2E: the real form trades code+phone for a fresh private link, keeps
// the token out of query strings, survives a refresh, and retires the old link in the same session
// and in a brand-new window. Lookup POSTs stay at four — under the real 5/min/IP endpoint budget.

const tag = randomUUID();
const SLUG = `lookup-${tag}`;
const NAME = `Áo tra cứu ${tag.slice(0, 8)}`;
const CODE = 'LKFIXTURE2X9';
const PHONE = '0918000777';
const OLD_TOKEN = 'L'.repeat(32);
const UNIFORM_404 = 'Không tìm thấy đơn hàng. Kiểm tra lại mã đơn hoặc đường dẫn đã nhận từ shop.';
const RECIPIENT = 'Nguyễn Thử Tra Cứu';

let db: PrismaService;
let categoryId = '';
let productId = '';
const trackedOrderCodes: string[] = [];

function assertOwnedDatabase() {
  const url = new URL(process.env['DATABASE_URL'] ?? '');
  const database = decodeURIComponent(url.pathname.slice(1));
  if (process.env['NODE_ENV'] !== 'test' || !['postgres:', 'postgresql:'].includes(url.protocol)
    || database !== process.env['CLOTHING_TEST_DATABASE'] || !/^clothing_e2e_[0-9a-f]{16}_test$/.test(database)) {
    throw new Error('Order lookup E2E requires the isolated test runner database.');
  }
}

test.beforeAll(async () => {
  assertOwnedDatabase();
  db = new PrismaService(readEnvironment(process.env));
  await db.shopSettings.create({ data: { id: 'default', shippingFeeVnd: 30000, bankDeadlineMinutes: 120 } });
  const category = await db.category.create({ data: { name: 'Danh mục tra cứu thử', slug: `lk-${tag}`, active: true } });
  categoryId = category.id;
  const product = await db.product.create({ data: { name: NAME, slug: SLUG, description: '', categoryId,
    status: 'PUBLISHED', priceFrom: 200000, variants: { create: [
      { sku: `LK-${tag.toUpperCase()}`, size: 'M', color: 'Đen', price: 200000, active: true,
        inventory: { create: { onHand: 4, reserved: 0 } } }] } },
    include: { variants: true } });
  productId = product.id;
  await db.order.create({ data: {
    code: CODE, status: 'PENDING', source: 'WEB', userId: null, quoteId: null,
    recipientName: RECIPIENT, phone: PHONE, email: 'lookup-e2e@example.test',
    province: 'TP. Hồ Chí Minh', district: '', ward: 'Phường Bến Nghé', addressLine: '12 Nguyễn Huệ',
    note: null, method: 'COD', currency: 'VND', subtotalVnd: 200000, shippingFeeVnd: 30000,
    totalVnd: 230000, settingsVersion: 0,
    lookupTokenHash: createHash('sha256').update(OLD_TOKEN).digest('hex'), version: 0,
    items: { create: [{ variantId: product.variants[0]!.id, productName: NAME, sku: `LK-${tag.toUpperCase()}`,
      size: 'M', color: 'Đen', unitPriceVnd: 200000, quantity: 1, lineTotalVnd: 200000 }] },
    history: { create: [{ fromStatus: null, toStatus: 'PENDING', actorType: 'GUEST', actorId: null, version: 0 }] },
  } });
  trackedOrderCodes.push(CODE);
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
    await db.inventoryMovement.deleteMany({ where: { variant: { productId } } });
    await db.inventory.deleteMany({ where: { variant: { productId } } });
    await db.variant.deleteMany({ where: { productId } });
    await db.product.deleteMany({ where: { id: productId } });
    await db.category.deleteMany({ where: { id: categoryId } });
    await db.shopSettings.deleteMany({ where: { id: 'default' } });
  } finally { await db.$disconnect(); }
});

test('the lookup form issues a fresh link and retires the old one everywhere', async ({ page }, info) => {
  test.setTimeout(60000);
  await page.goto('/orders/lookup');

  // A real order code with a wrong phone: one uniform 404, form untouched, no sibling data.
  await page.getByLabel('Mã đơn').fill(CODE);
  await page.getByLabel('Số điện thoại').fill('0900000111');
  await page.getByRole('button', { name: 'Tra cứu' }).click();
  await expect(page.getByText(UNIFORM_404)).toBeVisible();
  await expect(page.getByLabel('Mã đơn')).toHaveValue(CODE);
  await expect(page.getByLabel('Số điện thoại')).toHaveValue('0900000111');

  // A wrong code with the +84 form of the right phone: the same uniform 404 — and the +84 form
  // passing validation proves the one server-side phone normalization (a broken rule would 400).
  await page.getByLabel('Mã đơn').fill('ZZZ2ZZZZZZZ');
  await page.getByLabel('Số điện thoại').fill('+84918000777');
  await page.getByRole('button', { name: 'Tra cứu' }).click();
  await expect(page.getByText(UNIFORM_404)).toBeVisible();
  expect(await page.content()).not.toContain(RECIPIENT);

  // The right pair (0-prefixed form) lands on the private view with a brand-new fragment token.
  await page.getByLabel('Mã đơn').fill(CODE);
  await page.getByLabel('Số điện thoại').fill(PHONE);
  await page.getByRole('button', { name: 'Tra cứu' }).click();
  await expect(page.getByText(CODE)).toBeVisible();
  await expect(page.getByText(/chưa thu tiền/i)).toBeVisible();
  await expect(page.getByText(NAME)).toBeVisible();
  const url = page.url();
  expect(url).toContain(`/orders/${CODE}#t=`); // the answer navigates, token in the fragment only
  expect(url).not.toContain('?');
  const freshToken = new URL(url).hash.slice('#t='.length);
  expect(freshToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
  expect(freshToken).not.toBe(OLD_TOKEN);

  // Refresh keeps the fresh link working because the fragment stays in the address.
  await page.reload();
  await expect(page.getByText(CODE)).toBeVisible();
  await expect(page.getByText(NAME)).toBeVisible();

  // The retired link is dead in the same session — with no PII on the failure page.
  await page.goto(`/orders/${CODE}#t=${OLD_TOKEN}`);
  await expect(page.getByText(UNIFORM_404)).toBeVisible();
  expect(await page.content()).not.toContain(RECIPIENT);

  // And in a brand-new window, while the fresh link still opens there.
  const second = await page.context().newPage();
  await second.goto(`/orders/${CODE}#t=${OLD_TOKEN}`);
  await expect(second.getByText(UNIFORM_404)).toBeVisible();
  await second.goto(`/orders/${CODE}#t=${freshToken}`);
  await expect(second.getByText(NAME)).toBeVisible();

  // Mobile 390px keeps the order view inside the viewport.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('order-lookup-mobile.png'), fullPage: true });
  await second.close();
});

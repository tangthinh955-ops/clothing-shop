import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../dist/application.js';
import { readEnvironment } from '../dist/config/environment.js';
import { InventoryOperationsService, type InventoryActor, type StockLine } from '../dist/modules/inventory/inventory-operations.service.js';
import { InventoryService } from '../dist/modules/inventory/inventory.service.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';

// Order-facing inventory operations (m4-contract §9): reserve/release/ship run inside the caller's
// transaction, lock variants in a stable order, replay by effect key and keep M3 admin flows intact.

const origin = 'http://localhost:5173';
let app: Awaited<ReturnType<typeof createApplication>>;
let db: PrismaService;
let ops: InventoryOperationsService;
let inventory: InventoryService;
const guest: InventoryActor = { type: 'GUEST' };
let adminId = '';
let categoryId = '';
let productId = '';
const variantIds: string[] = [];

const stockOf = (variantId: string) => db.inventory.findUniqueOrThrow({ where: { variantId } });
const movementCount = (variantId: string) => db.inventoryMovement.count({ where: { variantId } });

beforeAll(async () => {
  if (process.env['NODE_ENV'] !== 'test' || !new URL(process.env['DATABASE_URL'] ?? '').pathname.endsWith('_test')) throw new Error('Test DB required');
  app = await createApplication(readEnvironment({ ...process.env, APP_ORIGIN: origin }));
  db = app.get(PrismaService);
  ops = app.get(InventoryOperationsService);
  inventory = app.get(InventoryService);
  const admin = await db.user.create({ data: { email: `inv-orders-${randomUUID()}@example.test`, name: 'Admin kho thử',
    role: 'ADMIN', passwordHash: 'not-used', emailVerifiedAt: new Date() } });
  adminId = admin.id;
  const category = await db.category.create({ data: { name: 'Danh mục kho đơn thử', slug: `inv-orders-${randomUUID()}`, active: true } });
  categoryId = category.id;
  const product = await db.product.create({ data: { name: 'Áo kho đơn thử', slug: `inv-orders-${randomUUID()}`, description: '', categoryId,
    status: 'PUBLISHED', priceFrom: 200000, variants: { create: [
      { sku: `M4OA-${randomUUID()}`.toUpperCase().slice(0, 64), size: 'M', color: 'đen', price: 200000, active: true, inventory: { create: { onHand: 5, reserved: 0 } } },
      { sku: `M4OB-${randomUUID()}`.toUpperCase().slice(0, 64), size: 'L', color: 'trắng', price: 200000, active: true, inventory: { create: { onHand: 3, reserved: 0 } } },
      { sku: `M4OC-${randomUUID()}`.toUpperCase().slice(0, 64), size: 'S', color: 'xanh', price: 200000, active: true, inventory: { create: { onHand: 1, reserved: 0 } } },
      { sku: `M4OD-${randomUUID()}`.toUpperCase().slice(0, 64), size: 'XL', color: 'đỏ', price: 200000, active: true, inventory: { create: { onHand: 2, reserved: 0 } } },
      { sku: `M4OE-${randomUUID()}`.toUpperCase().slice(0, 64), size: 'XXL', color: 'vàng', price: 200000, active: true, inventory: { create: { onHand: 2, reserved: 0 } } },
      { sku: `M4OF-${randomUUID()}`.toUpperCase().slice(0, 64), size: 'FREESIZE', color: 'hồng', price: 200000, active: true, inventory: { create: { onHand: 4, reserved: 0 } } },
      { sku: `M4OG-${randomUUID()}`.toUpperCase().slice(0, 64), size: 'XS', color: 'nâu', price: 200000, active: true, inventory: { create: { onHand: 2, reserved: 0 } } },
      { sku: `M4OH-${randomUUID()}`.toUpperCase().slice(0, 64), size: '3XL', color: 'cam', price: 200000, active: true, inventory: { create: { onHand: 2, reserved: 0 } } },
      { sku: `M4OI-${randomUUID()}`.toUpperCase().slice(0, 64), size: 'M', color: 'tím', price: 200000, active: true, inventory: { create: { onHand: 2, reserved: 0 } } },
      { sku: `M4OJ-${randomUUID()}`.toUpperCase().slice(0, 64), size: 'L', color: 'xám', price: 200000, active: true, inventory: { create: { onHand: 2, reserved: 0 } } },
    ] } } });
  productId = product.id;
  const variants = await db.variant.findMany({ where: { productId }, orderBy: { sku: 'asc' }, select: { id: true } });
  variantIds.push(...variants.map((variant) => variant.id));
});

afterAll(async () => {
  if (!db) return;
  // Each step cleans independently so one failure cannot strand fixtures in the shared test database;
  // leftover counts and step errors must fail the suite instead of leaving a green run with residue.
  const problems: string[] = [];
  const attempt = (label: string, step: () => Promise<unknown>) =>
    step().catch((error: unknown) => { problems.push(`${label}: ${error instanceof Error ? error.message : String(error)}`); });
  try {
    if (productId) {
      await attempt('movements', () => db.inventoryMovement.deleteMany({ where: { variant: { productId } } }));
      await attempt('inventory', () => db.inventory.deleteMany({ where: { variant: { productId } } }));
      await attempt('variants', () => db.variant.deleteMany({ where: { productId } }));
      await attempt('product', () => db.product.deleteMany({ where: { id: productId } }));
    }
    if (categoryId) await attempt('category', () => db.category.deleteMany({ where: { id: categoryId } }));
    if (adminId) {
      await attempt('sessions', () => db.session.deleteMany({ where: { sess: { path: ['userId'], equals: adminId } } }));
      await attempt('user', () => db.user.deleteMany({ where: { id: adminId } }));
    }
    const leftovers: string[] = [];
    const expectGone = async (label: string, remaining: Promise<number>) => {
      if (await remaining > 0) leftovers.push(label);
    };
    if (productId) {
      await expectGone('movements', db.inventoryMovement.count({ where: { variant: { productId } } }));
      await expectGone('inventory rows', db.inventory.count({ where: { variant: { productId } } }));
      await expectGone('variants', db.variant.count({ where: { productId } }));
      await expectGone('product', db.product.count({ where: { id: productId } }));
    }
    if (categoryId) await expectGone('category', db.category.count({ where: { id: categoryId } }));
    if (adminId) await expectGone('user', db.user.count({ where: { id: adminId } }));
    if (problems.length || leftovers.length) {
      throw new Error(`Cleanup incomplete (failed steps: ${problems.join('; ') || 'none'}; leftovers: ${leftovers.join(', ') || 'none'})`);
    }
  } finally { await app.close(); }
});

describe('M4 inventory operations for orders', () => {
  it('reserves available stock and replays the same effect key without duplicating rows', async () => {
    const [variantA] = variantIds;
    const effect = `order:${randomUUID()}:reserve`;
    const lines: StockLine[] = [{ variantId: variantA!, quantity: 2 }];
    const first = await db.$transaction((tx) => ops.reserve(tx, effect, lines, guest, 'Đặt hàng giữ kho'));
    expect(first).toEqual([{ variantId: variantA, onHand: 5, reserved: 2, available: 3, version: 1 }]);
    const replay = await db.$transaction((tx) => ops.reserve(tx, effect, lines, guest, 'Đặt hàng giữ kho'));
    expect(replay).toEqual(first);
    expect(await stockOf(variantA!)).toMatchObject({ onHand: 5, reserved: 2, version: 1 });
    expect(await movementCount(variantA!)).toBe(1);
  });

  it('rejects the same effect key used with different content', async () => {
    const variantB = variantIds[1]!;
    const effect = `order:${randomUUID()}:reserve`;
    await db.$transaction((tx) => ops.reserve(tx, effect, [{ variantId: variantB, quantity: 1 }], guest, 'Giữ một'));
    await expect(db.$transaction((tx) => ops.reserve(tx, effect, [{ variantId: variantB, quantity: 2 }], guest, 'Giữ một')))
      .rejects.toThrow(/nội dung khác/);
    expect(await stockOf(variantB)).toMatchObject({ onHand: 3, reserved: 1 });
    expect(await movementCount(variantB)).toBe(1);
  });

  it('rejects the same effect key reused on a disjoint SKU set and leaves stock untouched', async () => {
    const variantH = variantIds[7]!;
    const variantI = variantIds[8]!;
    const effect = `order:${randomUUID()}:reserve`;
    await db.$transaction((tx) => ops.reserve(tx, effect, [{ variantId: variantH, quantity: 1 }], guest, 'Giữ hàng cho đơn'));
    const beforeI = await stockOf(variantI);
    await expect(db.$transaction((tx) => ops.reserve(tx, effect, [{ variantId: variantI, quantity: 1 }], guest, 'Giữ hàng cho đơn')))
      .rejects.toThrow(/nội dung khác/);
    expect(await stockOf(variantI)).toMatchObject({ onHand: beforeI.onHand, reserved: beforeI.reserved, version: beforeI.version });
    expect(await movementCount(variantI)).toBe(0);
    expect(await db.inventoryMovement.count({ where: { key: { startsWith: effect } } })).toBe(1);
  });

  it('lets only one of two concurrent disjoint carts sharing an effect key win', async () => {
    const variantI = variantIds[8]!;
    const variantJ = variantIds[9]!;
    const effect = `order:${randomUUID()}:reserve`;
    const [first, second] = await Promise.allSettled([
      db.$transaction((tx) => ops.reserve(tx, effect, [{ variantId: variantI, quantity: 1 }], guest, 'Giữ hàng cho đơn')),
      db.$transaction((tx) => ops.reserve(tx, effect, [{ variantId: variantJ, quantity: 1 }], guest, 'Giữ hàng cho đơn')),
    ]);
    expect([first.status, second.status].sort()).toEqual(['fulfilled', 'rejected']);
    const stockI = await stockOf(variantI);
    const stockJ = await stockOf(variantJ);
    expect(stockI.reserved + stockJ.reserved).toBe(1);
    expect(await db.inventoryMovement.count({ where: { key: { startsWith: effect } } })).toBe(1);
  });

  it('lets exactly one of two racing transactions take the last unit', async () => {
    const variantC = variantIds[2]!;
    const [first, second] = await Promise.allSettled([
      db.$transaction((tx) => ops.reserve(tx, `order:${randomUUID()}:reserve`, [{ variantId: variantC, quantity: 1 }], guest, 'Tranh chiếc cuối')),
      db.$transaction((tx) => ops.reserve(tx, `order:${randomUUID()}:reserve`, [{ variantId: variantC, quantity: 1 }], guest, 'Tranh chiếc cuối')),
    ]);
    expect([first.status, second.status].sort()).toEqual(['fulfilled', 'rejected']);
    expect(await stockOf(variantC)).toMatchObject({ onHand: 1, reserved: 1, version: 1 });
    expect(await movementCount(variantC)).toBe(1);
  });

  it('rolls back every SKU when one line lacks stock', async () => {
    const [variantA, , variantC] = variantIds;
    const effect = `order:${randomUUID()}:reserve`;
    await expect(db.$transaction((tx) => ops.reserve(tx, effect, [{ variantId: variantA!, quantity: 1 }, { variantId: variantC!, quantity: 1 }],
      guest, 'Giỏ thiếu hàng'))).rejects.toBeTruthy();
    expect(await stockOf(variantA!)).toMatchObject({ onHand: 5, reserved: 2 });
    expect(await movementCount(variantC!)).toBe(1);
    expect(await db.inventoryMovement.count({ where: { key: { startsWith: effect } } })).toBe(0);
  });

  it('releases reserved stock once and ships onHand and reserved together, both replay-safe', async () => {
    const variantF = variantIds[5]!;
    await db.$transaction((tx) => ops.reserve(tx, `order:${randomUUID()}:reserve`, [{ variantId: variantF, quantity: 2 }], guest, 'Giữ trước hủy'));
    const releaseEffect = `order:${randomUUID()}:release`;
    const released = await db.$transaction((tx) => ops.release(tx, releaseEffect, [{ variantId: variantF, quantity: 2 }], { type: 'SYSTEM' }, 'Hết hạn nhả giữ'));
    expect(released).toEqual([{ variantId: variantF, onHand: 4, reserved: 0, available: 4, version: 2 }]);
    await db.$transaction((tx) => ops.release(tx, releaseEffect, [{ variantId: variantF, quantity: 2 }], { type: 'SYSTEM' }, 'Hết hạn nhả giữ'));
    expect(await stockOf(variantF)).toMatchObject({ onHand: 4, reserved: 0 });
    expect(await movementCount(variantF)).toBe(2);
    await db.$transaction((tx) => ops.reserve(tx, `order:${randomUUID()}:reserve`, [{ variantId: variantF, quantity: 2 }], guest, 'Giữ trước xuất'));
    const shipEffect = `order:${randomUUID()}:ship`;
    const shipped = await db.$transaction((tx) => ops.ship(tx, shipEffect, [{ variantId: variantF, quantity: 2 }], guest, 'Bàn giao vận chuyển'));
    expect(shipped).toEqual([{ variantId: variantF, onHand: 2, reserved: 0, available: 2, version: 4 }]);
    await db.$transaction((tx) => ops.ship(tx, shipEffect, [{ variantId: variantF, quantity: 2 }], guest, 'Bàn giao vận chuyển'));
    expect(await stockOf(variantF)).toMatchObject({ onHand: 2, reserved: 0 });
    expect(await movementCount(variantF)).toBe(4);
  });

  it('locks variants in a stable order so opposite carts do not deadlock', async () => {
    const [, , , variantD, variantE] = variantIds;
    const [first, second] = await Promise.allSettled([
      db.$transaction((tx) => ops.reserve(tx, `order:${randomUUID()}:reserve`, [{ variantId: variantE!, quantity: 1 }, { variantId: variantD!, quantity: 1 }], guest, 'Giỏ ngược')),
      db.$transaction((tx) => ops.reserve(tx, `order:${randomUUID()}:reserve`, [{ variantId: variantD!, quantity: 1 }, { variantId: variantE!, quantity: 1 }], guest, 'Giỏ xuôi')),
    ]);
    expect([first.status, second.status]).toEqual(['fulfilled', 'fulfilled']);
    expect(await stockOf(variantD!)).toMatchObject({ onHand: 2, reserved: 2 });
    expect(await stockOf(variantE!)).toMatchObject({ onHand: 2, reserved: 2 });
  });

  it('rolls back stock and ledger together when the surrounding transaction fails', async () => {
    const variantG = variantIds[6]!;
    const effect = `order:${randomUUID()}:reserve`;
    const before = await stockOf(variantG);
    await expect(db.$transaction(async (tx) => {
      await ops.reserve(tx, effect, [{ variantId: variantG, quantity: 1 }], guest, 'Sẽ bị hủy');
      throw new Error('mô phỏng lỗi nghiệp vụ sau reserve');
    })).rejects.toThrow('mô phỏng lỗi nghiệp vụ sau reserve');
    expect(await stockOf(variantG)).toMatchObject({ onHand: before.onHand, reserved: before.reserved, version: before.version });
    expect(await db.inventoryMovement.count({ where: { key: { startsWith: effect } } })).toBe(0);
  });

  it('keeps the M3 admin adjustment working and labels guest/system actors in history', async () => {
    const variantA = variantIds[0]!;
    const current = await stockOf(variantA);
    const adjusted = await inventory.adjust(adminId, `adjust-${randomUUID()}`, { variantId: variantA, delta: 3, reason: 'Nhập hàng bổ sung', expectedVersion: current.version });
    expect(adjusted).toMatchObject({ onHand: current.onHand + 3, available: current.onHand + 3 - current.reserved });
    const history = await inventory.movements({ page: 1, pageSize: 50 });
    const shipRow = history.items.find((row) => row.source === 'ORDER_SHIP');
    expect(shipRow).toMatchObject({ actorType: 'GUEST', delta: -2 });
    expect(shipRow?.actor).toEqual({ name: 'Khách đặt hàng' });
    const systemRow = history.items.find((row) => row.source === 'ORDER_RELEASE' && row.actorType === 'SYSTEM');
    expect(systemRow?.actor).toEqual({ name: 'Hệ thống' });
    const adminRow = history.items.find((row) => row.source === 'ADMIN_ADJUSTMENT');
    expect(adminRow).toMatchObject({ actorType: 'ADMIN' });
    expect(adminRow?.actor).toEqual({ name: 'Admin kho thử' });
    const reserveRow = history.items.find((row) => row.source === 'ORDER_RESERVE');
    expect(reserveRow).toMatchObject({ delta: 0, effectKey: expect.stringMatching(/:reserve:/) });
  });
});

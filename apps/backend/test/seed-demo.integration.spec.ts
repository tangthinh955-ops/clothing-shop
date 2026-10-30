import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { hash } from 'argon2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readEnvironment } from '../dist/config/environment.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';

const run = promisify(execFile);
const demoCategorySlugs = ['demo-ao-thun', 'demo-quan-jean'];
const demoProductSlugs = ['demo-ao-an', 'demo-ao-cotton', 'demo-ao-cotton-gioi-han', 'demo-quan-jean'];
const uploadsRoot = path.resolve('../../.local/test-uploads');
const adminEmail = `demo-seed-${randomUUID()}@example.test`;
let db: PrismaService;

function assertTestDatabase() {
  if (process.env['NODE_ENV'] !== 'test' || !new URL(process.env['DATABASE_URL'] ?? '').pathname.endsWith('_test')) {
    throw new Error('Seed demo integration requires NODE_ENV=test and a PostgreSQL *_test database');
  }
}

async function snapshot() {
  const products = await db.product.findMany({
    where: { slug: { in: demoProductSlugs } },
    include: { variants: { include: { inventory: true, movements: true } }, images: { include: { asset: true } } },
  });
  const assets = await db.uploadAsset.findMany({ where: { storageKey: { startsWith: 'demo-' } } });
  for (const asset of assets) await access(path.join(uploadsRoot, asset.storageKey));
  const files = assets.map((asset) => asset.storageKey).sort();
  return {
    assetKeys: files,
    products: products.map((product) => ({
      slug: product.slug,
      status: product.status,
      priceFrom: Number(product.priceFrom),
      images: product.images.map((image) => image.asset.storageKey).sort(),
      variants: product.variants.map((variant) => ({ sku: variant.sku,
        onHand: variant.inventory?.onHand ?? 0, reserved: variant.inventory?.reserved ?? 0, version: variant.inventory?.version ?? 0,
        available: (variant.inventory?.onHand ?? 0) - (variant.inventory?.reserved ?? 0),
        movements: variant.movements.map(({ actorId, delta, reason, before, after, reserved, version }) =>
          ({ actorId, delta, reason, before, after, reserved, version })) })).sort((a, b) => a.sku.localeCompare(b.sku)),
    })).sort((a, b) => a.slug.localeCompare(b.slug)),
  };
}

async function cleanupDemoData() {
  const products = await db.product.findMany({ where: { slug: { in: demoProductSlugs } }, select: { id: true } });
  for (const product of products) {
    await db.productImage.deleteMany({ where: { productId: product.id } });
    await db.inventoryMovement.deleteMany({ where: { variant: { productId: product.id } } });
    await db.inventory.deleteMany({ where: { variant: { productId: product.id } } });
    await db.variant.deleteMany({ where: { productId: product.id } });
    await db.product.delete({ where: { id: product.id } });
  }
  const files = (await readdir(uploadsRoot).catch(() => [] as string[])).filter((file) => file.startsWith('demo-'));
  for (const file of files) await unlink(path.join(uploadsRoot, file)).catch(() => undefined);
  await db.uploadAsset.deleteMany({ where: { storageKey: { startsWith: 'demo-' } } });
  await db.category.deleteMany({ where: { slug: { in: demoCategorySlugs } } });
}

beforeAll(async () => {
  assertTestDatabase();
  db = new PrismaService(readEnvironment(process.env));
  await cleanupDemoData();
  await db.user.create({ data: { email: adminEmail, name: 'Admin demo seed', role: 'ADMIN', passwordHash: await hash('demo-seed-password-123!'), emailVerifiedAt: new Date() } });
});

afterAll(async () => {
  if (!db) return;
  try {
    await cleanupDemoData();
    const admin = await db.user.findUnique({ where: { email: adminEmail } });
    if (admin) {
      await db.session.deleteMany({ where: { sess: { path: ['userId'], equals: admin.id } } });
      await db.user.delete({ where: { id: admin.id } });
    }
  } finally { await db.$disconnect(); }
});

describe('seed demo CLI', () => {
  it('refuses to run when NODE_ENV=production, before touching any database', async () => {
    await expect(run(process.execPath, ['dist/cli/seed-demo.js'], { env: { ...process.env, NODE_ENV: 'production' } }))
      .rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('không chạy trên production') });
    expect(await db.product.count({ where: { slug: { in: demoProductSlugs } } })).toBe(0);
    expect(await db.category.count({ where: { slug: { in: demoCategorySlugs } } })).toBe(0);
  });

  it('leaves no demo image file or asset behind when a product transaction fails', async () => {
    // A user-owned variant already holds the first demo SKU, so the demo-ao-cotton transaction must roll back.
    const category = await db.category.create({ data: { name: 'Danh mục chặn seed', slug: `seed-block-${randomUUID()}` } });
    const blocker = await db.product.create({ data: {
      name: 'Hàng chặn seed', slug: `seed-block-${randomUUID()}`, description: '', categoryId: category.id, priceFrom: 100000,
      variants: { create: [{ sku: 'DEMO-CTN-S-DEN', size: 'S', color: 'đen', price: 100000, inventory: { create: {} } }] },
    } });
    try {
      await expect(run(process.execPath, ['dist/cli/seed-demo.js'])).rejects.toMatchObject({ code: 1 });
      expect(await db.product.findUnique({ where: { slug: 'demo-ao-cotton' } })).toBeNull();
      expect(await db.uploadAsset.count({ where: { storageKey: { startsWith: 'demo-ao-cotton-' } } })).toBe(0);
      const files = await readdir(uploadsRoot).catch(() => [] as string[]);
      expect(files.filter((file) => file.startsWith('demo-ao-cotton-'))).toEqual([]);
    } finally {
      await db.inventory.deleteMany({ where: { variant: { productId: blocker.id } } });
      await db.variant.deleteMany({ where: { productId: blocker.id } });
      await db.product.delete({ where: { id: blocker.id } });
      await db.category.delete({ where: { id: category.id } });
      await cleanupDemoData();
    }
  });

  it('creates the demo dataset once and repeats with no new rows or stock changes', async () => {
    const first = await run(process.execPath, ['dist/cli/seed-demo.js']);
    expect(first.stdout).toContain('Bộ dữ liệu demo đã sẵn sàng');
    expect(first.stdout).toContain('Đã tạo sản phẩm Áo cotton hợp ngày (demo-ao-cotton).');

    const afterFirst = await snapshot();
    expect(afterFirst.products.map((product) => product.slug)).toEqual(demoProductSlugs);
    expect(afterFirst.products.filter((product) => product.status === 'PUBLISHED')).toHaveLength(3);
    expect(afterFirst.products.find((product) => product.slug === 'demo-ao-an')?.status).toBe('HIDDEN');
    expect(afterFirst.products.reduce((total, product) => total + product.variants.length, 0)).toBe(7);
    expect(afterFirst.products.filter((product) => product.images.length === 2)).toHaveLength(1);
    expect(afterFirst.products.filter((product) => product.images.length === 1)).toHaveLength(1);
    expect(afterFirst.products.filter((product) => product.images.length === 0)).toHaveLength(2);
    const published = afterFirst.products.filter((product) => product.status === 'PUBLISHED');
    expect(published.filter((product) => product.images.length === 0).map((product) => product.slug)).toEqual(['demo-quan-jean']);
    expect(afterFirst.products.find((product) => product.slug === 'demo-ao-an')?.images).toHaveLength(0);
    expect(afterFirst.products.find((product) => product.slug === 'demo-ao-cotton')?.priceFrom).toBe(250000);
    expect(afterFirst.products.flatMap((product) => product.variants.map((variant) => variant.available))).toContain(0);
    expect(afterFirst.products.flatMap((product) => product.variants.map((variant) => variant.available))).toContain(1);
    const variants = afterFirst.products.flatMap((product) => product.variants);
    const owner = await db.user.findUniqueOrThrow({ where: { email: adminEmail } });
    // Demo data has no orders, so nothing may be held; stock comes from one ledger entry like a real adjustment.
    expect(variants.every((variant) => variant.reserved === 0)).toBe(true);
    for (const variant of variants) {
      if (variant.onHand === 0) {
        expect(variant.movements).toEqual([]);
        expect(variant.version).toBe(0);
      } else {
        expect(variant.movements).toEqual([{ actorId: owner.id, delta: variant.onHand, reason: 'Nhập kho demo',
          before: 0, after: variant.onHand, reserved: 0, version: 1 }]);
        expect(variant.version).toBe(1);
      }
    }
    expect(afterFirst.assetKeys.length).toBe(3);
    expect(afterFirst.assetKeys.every((key) => key.startsWith('demo-') && key.endsWith('.webp'))).toBe(true);

    const second = await run(process.execPath, ['dist/cli/seed-demo.js']);
    expect(second.stdout).toContain('Toàn bộ bộ dữ liệu demo đã có sẵn');
    expect(second.stdout).not.toContain('Đã tạo');
    const afterSecond = await snapshot();
    expect(afterSecond).toEqual(afterFirst);
  });
});

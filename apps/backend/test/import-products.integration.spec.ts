import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { hash } from 'argon2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readEnvironment } from '../dist/config/environment.js';
import { PrismaService } from '../dist/modules/prisma/prisma.service.js';
import { UploadsService } from '../dist/modules/uploads/uploads.service.js';

const run = promisify(execFile);
const uploadsRoot = path.resolve('../../.local/test-uploads');
const slugPrefix = 'import-fix-';
// uploads.service chỉ phục vụ file khi storageKey có dạng <uuid>.webp; key khác đều 404 trên /api/v1/media.
const storageKeyFormat = /^[0-9a-f-]{36}\.webp$/;
const legacyStoragePrefix = 'rmg-import-fix-';
const adminEmail = `import-fix-${randomUUID()}@example.test`;
let db: PrismaService;
let fixtureDir: string;

function assertTestDatabase() {
  if (process.env['NODE_ENV'] !== 'test' || !new URL(process.env['DATABASE_URL'] ?? '').pathname.endsWith('_test')) {
    throw new Error('Import products integration requires NODE_ENV=test and a PostgreSQL *_test database');
  }
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function fixtureCsv() {
  const header = 'name,category,color,sizes,price,stock,description,files';
  // stock để trống = 0 (không có movement); stock 5 = một bản ghi ledger như điều chỉnh thật.
  return [
    '# comment line must be ignored',
    header,
    [csvEscape('Import fix Áo một'), csvEscape('Import fix Áo thun'), csvEscape('đen'), '', csvEscape('250000'), '', csvEscape('Mô tả, có dấu phẩy.'), csvEscape('fix-a-1.jpg|fix-a-2.jpg')].join(','),
    [csvEscape('Import fix Áo hai'), csvEscape('Import fix Quần'), csvEscape('trắng'), 'S|M', csvEscape('310000'), csvEscape('5'), '', csvEscape('fix-b-1.jpg')].join(','),
    // Dòng lỗi: thiếu giá.
    [csvEscape('Import fix Áo lỗi'), csvEscape('Import fix Áo thun'), csvEscape('đen'), '', '', '', '', csvEscape('fix-missing.jpg')].join(','),
  ].join('\n');
}

async function writeFixture() {
  fixtureDir = await mkdtemp(path.join(tmpdir(), 'import-products-'));
  const colors: Record<string, string> = { 'fix-a-1.jpg': '#4a6b8a', 'fix-a-2.jpg': '#b5763a', 'fix-b-1.jpg': '#a85e6e', 'fix-missing.jpg': '#777777' };
  for (const [file, tint] of Object.entries(colors)) {
    await writeFile(path.join(fixtureDir, file), await sharp({ create: { width: 50, height: 70, channels: 3, background: tint } }).jpeg().toBuffer());
  }
  await writeFile(path.join(fixtureDir, 'products.csv'), Buffer.from(fixtureCsv(), 'utf8'));
}

async function snapshot() {
  const products = await db.product.findMany({
    where: { slug: { startsWith: slugPrefix } },
    include: { variants: { include: { inventory: true, movements: true } }, images: { include: { asset: true } } },
  });
  const owner = await db.user.findUniqueOrThrow({ where: { email: adminEmail } });
  const assets = await db.uploadAsset.findMany({ where: { ownerId: owner.id } });
  for (const asset of assets) await access(path.join(uploadsRoot, asset.storageKey));
  return {
    assetKeys: assets.map((asset) => asset.storageKey).sort(),
    products: products.map((product) => ({
      slug: product.slug,
      status: product.status,
      priceFrom: Number(product.priceFrom),
      description: product.description,
      images: product.images.map((image) => image.asset.storageKey).sort(),
      variants: product.variants.map((variant) => ({
        sku: variant.sku, size: variant.size, color: variant.color,
        onHand: variant.inventory?.onHand ?? 0, reserved: variant.inventory?.reserved ?? 0, version: variant.inventory?.version ?? 0,
        movements: variant.movements.map(({ actorId, delta, reason, before, after, reserved, version }) =>
          ({ actorId, delta, reason, before, after, reserved, version })),
      })).sort((a, b) => a.sku.localeCompare(b.sku)),
    })).sort((a, b) => a.slug.localeCompare(b.slug)),
  };
}

async function cleanup() {
  const categories = await db.category.findMany({ where: { slug: { startsWith: slugPrefix } }, select: { id: true } });
  for (const category of categories) {
    const products = await db.product.findMany({ where: { categoryId: category.id }, select: { id: true } });
    for (const product of products) {
      await db.productImage.deleteMany({ where: { productId: product.id } });
      await db.inventoryMovement.deleteMany({ where: { variant: { productId: product.id } } });
      await db.inventory.deleteMany({ where: { variant: { productId: product.id } } });
      await db.variant.deleteMany({ where: { productId: product.id } });
      await db.product.delete({ where: { id: product.id } });
    }
    await db.category.delete({ where: { id: category.id } });
  }
  // Ảnh import nay dùng key UUID nên nhận diện theo chủ sở hữu; prefix cũ chỉ để dọn rác từ lượt chạy trước khi sửa.
  const adminForAssets = await db.user.findUnique({ where: { email: adminEmail } });
  if (adminForAssets) {
    const owned = await db.uploadAsset.findMany({ where: { ownerId: adminForAssets.id }, select: { storageKey: true } });
    await db.uploadAsset.deleteMany({ where: { ownerId: adminForAssets.id } });
    for (const { storageKey } of owned) await rm(path.join(uploadsRoot, storageKey), { force: true });
  }
  const legacy = await db.uploadAsset.deleteMany({ where: { storageKey: { startsWith: legacyStoragePrefix } } });
  if (legacy.count) {
    const files = (await readdir(uploadsRoot).catch(() => [] as string[])).filter((file) => file.startsWith(legacyStoragePrefix));
    for (const file of files) await rm(path.join(uploadsRoot, file), { force: true });
  }
  const admin = await db.user.findUnique({ where: { email: adminEmail } });
  if (admin) {
    await db.session.deleteMany({ where: { sess: { path: ['userId'], equals: admin.id } } });
    await db.user.delete({ where: { id: admin.id } });
  }
  if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true });
}

beforeAll(async () => {
  assertTestDatabase();
  db = new PrismaService(readEnvironment(process.env));
  await cleanup();
  await db.user.create({ data: { email: adminEmail, name: 'Admin import fix', role: 'ADMIN', passwordHash: await hash('import-fix-password-123!'), emailVerifiedAt: new Date() } });
  await writeFixture();
});

afterAll(async () => {
  if (!db) return;
  try { await cleanup(); } finally { await db.$disconnect(); }
});

describe('import products CLI', () => {
  const env: NodeJS.ProcessEnv = { ...process.env, ADMIN_EMAIL: adminEmail };

  it('imports the CSV once, repeats with no new rows, and skips broken lines', async () => {
    const first = await run(process.execPath, ['dist/cli/import-products.js', '--dir', fixtureDir], { env });
    expect(first.stdout).toContain('Đã tạo sản phẩm Import fix Áo một');
    expect(first.stdout).toContain('Đã tạo sản phẩm Import fix Áo hai');
    expect(first.stdout).toContain('Bỏ qua dòng');
    expect(first.stdout).toContain('Import fix Áo lỗi');
    expect(first.stdout).not.toContain('Đã tạo sản phẩm Import fix Áo lỗi');

    const afterFirst = await snapshot();
    expect(afterFirst.products).toHaveLength(2);
    expect(afterFirst.products.every((product) => product.status === 'PUBLISHED')).toBe(true);
    const firstProduct = afterFirst.products.find((product) => product.slug === `${slugPrefix}ao-mot`);
    expect(firstProduct).toMatchObject({ priceFrom: 250000, description: 'Mô tả, có dấu phẩy.' });
    expect(firstProduct?.images).toHaveLength(2);
    for (const key of firstProduct?.images ?? []) expect(key).toMatch(storageKeyFormat);
    expect(afterFirst.products.find((product) => product.slug === `${slugPrefix}ao-mot`)?.variants).toEqual([
      expect.objectContaining({
        size: 'FREESIZE', color: 'đen', onHand: 0, reserved: 0, version: 0,
        movements: [],
        sku: expect.stringMatching(/^RMG[0-9A-F]{8}-FREESIZE$/),
      }),
    ]);
    const secondProduct = afterFirst.products.find((product) => product.slug === `${slugPrefix}ao-hai`);
    expect(secondProduct?.variants).toHaveLength(2);
    expect(secondProduct?.variants.map((variant) => variant.size).sort()).toEqual(['M', 'S']);
    expect(secondProduct?.variants.every((variant) => variant.onHand === 5 && variant.reserved === 0)).toBe(true);
    const owner = await db.user.findUniqueOrThrow({ where: { email: adminEmail } });
    for (const variant of secondProduct?.variants ?? []) {
      expect(variant.movements).toEqual([{
        actorId: owner.id, delta: 5, reason: 'Nhập kho lúc import', before: 0, after: 5, reserved: 0, version: 1,
      }]);
      expect(variant.version).toBe(1);
    }
    expect(afterFirst.assetKeys).toHaveLength(3);
    expect(afterFirst.assetKeys.every((key) => storageKeyFormat.test(key))).toBe(true);

    // Cùng đường đọc với GET /api/v1/media/:id — phát hiện key không phục vụ được (404) ngay trong test.
    const uploads = new UploadsService(db, readEnvironment(process.env));
    const assetOwner = await db.user.findUniqueOrThrow({ where: { email: adminEmail } });
    const ownedAssets = await db.uploadAsset.findMany({ where: { ownerId: assetOwner.id }, select: { id: true } });
    expect(ownedAssets).toHaveLength(3);
    for (const asset of ownedAssets) expect((await uploads.read(asset.id)).length).toBeGreaterThan(0);

    const categories = await db.category.findMany({ where: { slug: { startsWith: slugPrefix } } });
    expect(new Set(categories.map((category) => category.name))).toEqual(new Set(['Import fix Áo thun', 'Import fix Quần']));
    expect(categories.every((category) => category.active)).toBe(true);

    const secondRun = await run(process.execPath, ['dist/cli/import-products.js', '--dir', fixtureDir], { env });
    expect(secondRun.stdout).toContain('Toàn bộ sản phẩm trong CSV đã có sẵn');
    expect(secondRun.stdout).not.toContain('Đã tạo');
    expect(await snapshot()).toEqual(afterFirst);
  }, 60000);

  it('forwards --dir/--draft through the root npm script and resolves a relative --dir from where npm runs', async () => {
    const npmCli = process.env['npm_execpath'];
    if (!npmCli) throw new Error('Run this suite through npm so npm_execpath points at the npm CLI');
    const repoRoot = path.resolve('../..');
    const missing = path.join('.local', `import-root-${randomUUID()}`);
    // A database that does not exist: whichever folder the CLI ends up reading, it can never write anything.
    const guardUrl = new URL(process.env['DATABASE_URL'] ?? '');
    guardUrl.pathname = '/clothing_import_guard_test';
    const rootEnv: NodeJS.ProcessEnv = { ...env, DATABASE_URL: guardUrl.toString() };
    delete rootEnv['INIT_CWD'];
    const result = await run(process.execPath, [npmCli, 'run', 'import:products', '--', '--dir', missing, '--draft'], { cwd: repoRoot, env: rootEnv })
      .then(() => ({ stdout: '', stderr: '' }), (error: { stdout?: string; stderr?: string }) => ({ stdout: error.stdout ?? '', stderr: error.stderr ?? '' }));
    expect(`${result.stdout}\n${result.stderr}`).toContain(`Không đọc được ${path.join(repoRoot, missing, 'products.csv')}`);
  }, 180000);

  it('never publishes into a category that is turned off, but still imports it as a draft', async () => {
    const offDir = await mkdtemp(path.join(tmpdir(), 'import-products-off-'));
    try {
      await db.category.create({ data: { name: 'Import fix Danh mục tắt', slug: `${slugPrefix}danh-muc-tat`, active: false } });
      await writeFile(path.join(offDir, 'off-1.jpg'), await sharp({ create: { width: 50, height: 70, channels: 3, background: '#556677' } }).jpeg().toBuffer());
      await writeFile(path.join(offDir, 'products.csv'), Buffer.from([
        'name,category,color,sizes,price,stock,description,files',
        [csvEscape('Import fix Áo danh mục tắt'), csvEscape('Import fix Danh mục tắt'), csvEscape('đen'), '', csvEscape('200000'), '', '', csvEscape('off-1.jpg')].join(','),
      ].join('\n'), 'utf8'));
      const published = await run(process.execPath, ['dist/cli/import-products.js', '--dir', offDir], { env });
      expect(published.stdout).toContain('danh mục Import fix Danh mục tắt đang tắt');
      expect(await db.product.findUnique({ where: { slug: `${slugPrefix}ao-danh-muc-tat` } })).toBeNull();
      const draft = await run(process.execPath, ['dist/cli/import-products.js', '--dir', offDir, '--draft'], { env });
      expect(draft.stdout).toContain('Đã tạo sản phẩm Import fix Áo danh mục tắt');
      expect(await db.product.findUnique({ where: { slug: `${slugPrefix}ao-danh-muc-tat` } })).toMatchObject({ status: 'DRAFT' });
    } finally { await rm(offDir, { recursive: true, force: true }); }
  }, 60000);
});

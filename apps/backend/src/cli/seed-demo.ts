import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { readEnvironment } from '../config/environment.js';
import { PrismaService } from '../modules/prisma/prisma.service.js';

// Demo stock has no orders behind it, so `reserved` stays 0; sold-out variants simply have onHand 0.
interface DemoVariant { sku: string; size: string; color: string; price: number; onHand: number }
interface DemoProduct { slug: string; name: string; description: string; status: 'PUBLISHED' | 'HIDDEN'; categorySlug: string; ageDays: number;
  variants: DemoVariant[]; images: Array<{ storageKey: string; tint: string }> }

// Fixed, well-known demo slugs: the CLI skips anything that already exists, so runs are idempotent
// and user data is never overwritten.
const CATEGORIES = [
  { name: 'Áo thun demo', slug: 'demo-ao-thun' },
  { name: 'Quần jean demo', slug: 'demo-quan-jean' },
];
const PRODUCTS: DemoProduct[] = [
  { slug: 'demo-ao-cotton', name: 'Áo cotton hợp ngày', description: 'Áo cotton dày vừa, mặc cùng quần jean mỗi ngày. Bộ demo dùng ảnh thật để thấy gallery.',
    status: 'PUBLISHED', categorySlug: 'demo-ao-thun', ageDays: 0,
    variants: [
      { sku: 'DEMO-CTN-S-DEN', size: 'S', color: 'đen', price: 250000, onHand: 13 },
      { sku: 'DEMO-CTN-M-DEN', size: 'M', color: 'đen', price: 290000, onHand: 8 },
    ], images: [
      { storageKey: 'demo-ao-cotton-1.webp', tint: '#4a6b8a' },
      { storageKey: 'demo-ao-cotton-2.webp', tint: '#b5763a' },
    ] },
  { slug: 'demo-ao-cotton-gioi-han', name: 'Áo cotton giới hạn demo', description: 'Số lượng ít. Một biến thể chỉ còn một chiếc, một biến thể đã hết hàng để thử các trạng thái tồn.',
    status: 'PUBLISHED', categorySlug: 'demo-ao-thun', ageDays: 2,
    variants: [
      { sku: 'DEMO-CGH-M-TRANG', size: 'M', color: 'trắng', price: 320000, onHand: 1 },
      { sku: 'DEMO-CGH-L-HONG', size: 'L', color: 'hồng', price: 340000, onHand: 0 },
    ], images: [
      { storageKey: 'demo-ao-cotton-gioi-han-1.webp', tint: '#a85e6e' },
    ] },
  { slug: 'demo-quan-jean', name: 'Quần jean mỗi ngày', description: 'Dáng thẳng, cạp vừa. Bộ demo này cố ý không có ảnh để thử khối "Chưa có ảnh".',
    status: 'PUBLISHED', categorySlug: 'demo-quan-jean', ageDays: 4,
    variants: [
      { sku: 'DEMO-QJ-M-XANH', size: 'M', color: 'xanh', price: 500000, onHand: 10 },
      { sku: 'DEMO-QJ-S-XANH', size: 'S', color: 'xanh', price: 520000, onHand: 10 },
    ], images: [] },
  { slug: 'demo-ao-an', name: 'Áo ẩn demo', description: 'Sản phẩm ẩn để thử khách vào slug thấy "Không tìm thấy sản phẩm.".',
    status: 'HIDDEN', categorySlug: 'demo-ao-thun', ageDays: 6,
    variants: [{ sku: 'DEMO-AN-M-DEN', size: 'M', color: 'đen', price: 200000, onHand: 5 }], images: [] },
];
const IMAGE_WIDTH = 750;
const IMAGE_HEIGHT = 1000;
const DEMO_STOCK_REASON = 'Nhập kho demo';

interface CreatedAsset { id: string; file: string }

async function owner(db: PrismaService) {
  const adminEmail = process.env['ADMIN_EMAIL']?.trim().toLowerCase();
  if (adminEmail) {
    const byEmail = await db.user.findUnique({ where: { email: adminEmail } });
    if (byEmail && byEmail.role === 'ADMIN' && !byEmail.disabledAt) return byEmail;
    console.log('ADMIN_EMAIL không trùng tài khoản ADMIN nào; dùng tài khoản ADMIN mới nhất để làm chủ ảnh demo.');
  }
  return db.user.findFirst({ where: { role: 'ADMIN', disabledAt: null }, orderBy: { createdAt: 'desc' } });
}

async function webp(tint: string) {
  return sharp({ create: { width: IMAGE_WIDTH, height: IMAGE_HEIGHT, channels: 3, background: tint } })
    .webp({ quality: 85 }).toBuffer();
}

async function discard(db: PrismaService, created: CreatedAsset[]) {
  for (const asset of created) {
    await db.uploadAsset.delete({ where: { id: asset.id } }).catch(() => undefined);
    await unlink(asset.file).catch(() => undefined);
  }
}

// Same order as uploads.service and outside any DB transaction: write the file, then the row, and remove
// both again if a later step fails, so a failed run never leaves an orphan demo image behind.
async function prepareImages(db: PrismaService, ownerId: string, images: DemoProduct['images']) {
  const assetIds: string[] = [];
  const created: CreatedAsset[] = [];
  try {
    for (const image of images) {
      const existing = await db.uploadAsset.findUnique({ where: { storageKey: image.storageKey } });
      if (existing) { assetIds.push(existing.id); continue; }
      const file = path.join(uploadsRoot, image.storageKey);
      await mkdir(uploadsRoot, { recursive: true });
      await writeFile(file, await webp(image.tint));
      try {
        const row = await db.uploadAsset.create({ data: { storageKey: image.storageKey, width: IMAGE_WIDTH, height: IMAGE_HEIGHT, ownerId } });
        created.push({ id: row.id, file });
        assetIds.push(row.id);
      } catch (error) {
        await unlink(file).catch(() => undefined);
        throw error;
      }
    }
    return { assetIds, created };
  } catch (error) {
    await discard(db, created);
    throw error;
  }
}

// Stock enters the way an admin adjustment would: one ledger row from 0 that bumps the version to 1.
function demoVariant({ sku, size, color, price, onHand }: DemoVariant, actorId: string) {
  const movement = { actorId, key: `seed-demo-${sku}`, requestHash: createHash('sha256').update(`seed-demo:${sku}:${onHand}`).digest('hex'),
    delta: onHand, reason: DEMO_STOCK_REASON, before: 0, after: onHand, reserved: 0, version: 1 };
  return { sku, size, color, price, active: true,
    inventory: { create: { onHand, version: onHand > 0 ? 1 : 0 } },
    movements: { create: onHand > 0 ? [movement] : [] } };
}

// The live shop must never get demo-* products; refuse before reading config or touching the database.
if (process.env['NODE_ENV'] === 'production') {
  console.error('seed:demo chỉ dùng trên máy local để thử giao diện, không chạy trên production.');
  process.exit(1);
}

const environment = readEnvironment(process.env);
// Repo root from this compiled file (apps/backend/dist/cli) keeps the uploads folder identical to the
// dev server's (.local/uploads for dev, .local/test-uploads for test) no matter which cwd the CLI runs from.
const uploadsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '.local',
  environment.nodeEnv === 'test' ? 'test-uploads' : 'uploads');

const db = new PrismaService(environment);
try {
  const ownerUser = await owner(db);
  if (!ownerUser) {
    console.error('Cần một tài khoản ADMIN để làm chủ ảnh demo. Chạy `npm run admin:create` trước khi seed demo.');
    process.exitCode = 1;
  } else {
    const categoriesBySlug = new Map<string, string>();
    let createdCategories = 0;
    for (const category of CATEGORIES) {
      const existing = await db.category.findUnique({ where: { slug: category.slug } });
      if (existing) {
        categoriesBySlug.set(category.slug, existing.id);
        console.log(`Danh mục ${category.slug} đã có sẵn.`);
      } else {
        const row = await db.category.create({ data: { name: category.name, slug: category.slug, active: true } });
        categoriesBySlug.set(category.slug, row.id);
        createdCategories += 1;
        console.log(`Đã tạo danh mục ${category.name} (${category.slug}).`);
      }
    }
    let createdProducts = 0;
    for (const product of PRODUCTS) {
      const existing = await db.product.findUnique({ where: { slug: product.slug } });
      if (existing) { console.log(`Sản phẩm ${product.slug} đã có sẵn.`); continue; }
      createdProducts += 1;
      const category = categoriesBySlug.get(product.categorySlug);
      if (!category) throw new Error(`Danh mục demo bị thiếu cho sản phẩm ${product.slug}.`);
      const { assetIds, created } = await prepareImages(db, ownerUser.id, product.images);
      const createdAt = new Date(Date.now() - product.ageDays * 86400000);
      const priceFrom = Math.min(...product.variants.map((variant) => variant.price));
      try {
        // One nested create is atomic: product, variants, inventory, ledger rows and image links land together.
        await db.product.create({ data: {
          name: product.name, slug: product.slug, description: product.description, status: product.status,
          categoryId: category, priceFrom, createdAt,
          variants: { create: product.variants.map((variant) => demoVariant(variant, ownerUser.id)) },
          images: { create: assetIds.map((assetId, position) => ({ assetId, position })) },
        } });
      } catch (error) {
        await discard(db, created);
        throw error;
      }
      console.log(`Đã tạo sản phẩm ${product.name} (${product.slug}).`);
    }
    if (createdCategories + createdProducts > 0) {
      console.log('Bộ dữ liệu demo đã sẵn sàng. Chạy lại lệnh này là an toàn: phần đã có sẽ được bỏ qua.');
    } else {
      console.log('Toàn bộ bộ dữ liệu demo đã có sẵn. Không tạo sản phẩm/danh mục hay nhập kho thêm.');
    }
  }
} catch (error) {
  console.error(`Seed demo thất bại: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally { await db.$disconnect(); }

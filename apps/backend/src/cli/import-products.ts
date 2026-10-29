import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { readEnvironment } from '../config/environment.js';
import { PrismaService } from '../modules/prisma/prisma.service.js';

// One CSV row = one product; `sizes` (pipe-separated) becomes one variant per size with the same price.
// Everything follows the publish rules the admin UI and backend also enforce: active category,
// at least one image and at least one active variant. Broken rows are skipped, never half-imported.
interface Row {
  line: number; name: string; category: string; color: string; sizes: string[]; price: number;
  stock: number; description: string; files: string[];
}
interface CreatedAsset { id: string; file: string }

const CSV_COLUMNS = ['name', 'category', 'color', 'sizes', 'price', 'stock', 'description', 'files'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'FREESIZE'] as const;
const PRICE_RANGE = { min: 1, max: 100000000 };
const STOCK_MAX = 1000000;
const IMAGE_WIDTH = 750;
const IMAGE_HEIGHT = 1000;
const MAX_IMAGES = 8;
const IMPORT_REASON = 'Nhập kho lúc import';

// Physical line numbers are kept so skipped rows can be reported the way the user counted them.
function csvLines(text: string): Array<{ cells: string[]; line: number }> {
  const rows: Array<{ cells: string[]; line: number }> = [];
  let cell = '';
  let row: string[] = [];
  let quoted = false;
  let line = 1;
  const pushRow = () => { rows.push({ cells: row.map((value) => value.trim()).concat([cell.trim()]), line }); row = []; cell = ''; line += 1; };
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { cell += '"'; index += 1; } else { quoted = false; }
      } else cell += char;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ',') { row = row.concat([cell]); cell = ''; continue; }
    if (char === '\n' || char === '\r') { if (char === '\r' && text[index + 1] === '\n') index += 1; pushRow(); continue; }
    cell += char;
  }
  if (cell !== '' || row.length > 0) pushRow();
  return rows.filter(({ cells }) => cells.some((value) => value.trim() !== ''));
}

function slugify(input: string) {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '');
}

// The CSV carries user-decided merch data; validation accepts it or skips the row — no guessing.
function validateRow(cells: string[], line: number): Row | string {
  const [name, category, color, sizes, price, stock, description, files] = cells;
  if (!name) return 'thiếu tên sản phẩm';
  const fileList = (files ?? '').replace(/\*\|/g, '|').split('|').map((file) => file.trim()).filter((file) => file !== '');
  if (!fileList.length) return 'thiếu danh sách ảnh';
  if (fileList.length > MAX_IMAGES) return `tối đa ${MAX_IMAGES} ảnh, nhận ${fileList.length}`;
  if (!price || !/^\d+$/.test(price)) return 'thiếu giá hợp lệ (số nguyên ≥ 1)';
  const priceValue = Number(price);
  if (priceValue < PRICE_RANGE.min || priceValue > PRICE_RANGE.max) return `giá phải từ ${PRICE_RANGE.min} tới ${PRICE_RANGE.max}`;
  const sizeList = sizes ? sizes.split('|').map((value) => value.trim().toUpperCase()).filter((value) => value !== '') : [];
  if (!sizeList.length) sizeList.push('FREESIZE');
  for (const size of sizeList) if (!(SIZES as readonly string[]).includes(size)) return `size ${size} không hợp lệ (${SIZES.join(', ')})`;
  if (stock && (!/^\d+$/.test(stock) || Number(stock) > STOCK_MAX)) return `stock phải là số nguyên từ 0 tới ${STOCK_MAX}`;
  return { line, name, category: category || 'Chưa phân loại', color: (color || 'mặc định').toLowerCase(),
    sizes: [...new Set(sizeList)], price: priceValue, stock: stock ? Number(stock) : 0, description: description ?? '', files: fileList };
}

function skuFor(slug: string, size: string, singleSize: boolean) {
  const seed = singleSize ? slug : `${slug}:${size}`;
  return `RMG${createHash('sha256').update(seed).digest('hex').toUpperCase().slice(0, 8)}-${size}`;
}

function variantsFor(row: Row, slug: string, actorId: string) {
  const singleSize = row.sizes.length === 1;
  return row.sizes.map((size) => {
    const sku = skuFor(slug, size, singleSize);
    const movement = { actorId, key: `import-products-${sku}`, requestHash: createHash('sha256').update(`import-products:${slug}:${sku}:${row.stock}`).digest('hex'),
      delta: row.stock, reason: IMPORT_REASON, before: 0, after: row.stock, reserved: 0, version: 1 };
    return { sku, size, color: row.color, price: row.price, active: true,
      inventory: { create: { onHand: row.stock, version: row.stock > 0 ? 1 : 0 } },
      movements: { create: row.stock > 0 ? [movement] : [] } };
  });
}

// Same order as uploads.service and outside any DB transaction: write the file, then the row, and remove
// both again if a later step fails, so a failed import never leaves an orphan image behind.
async function prepareImages(db: PrismaService, ownerId: string, dir: string, files: string[]) {
  const assetIds: string[] = [];
  const created: CreatedAsset[] = [];
  try {
    for (const file of files) {
      // uploads.service serves a file only when the key is `<uuid>.webp`; any other shape 404s on /api/v1/media.
      const storageKey = `${randomUUID()}.webp`;
      const uploadsFile = path.join(uploadsRoot, storageKey);
      await mkdir(uploadsRoot, { recursive: true });
      await writeFile(uploadsFile, await webp(path.join(dir, file)));
      try {
        const row = await db.uploadAsset.create({ data: { storageKey, width: IMAGE_WIDTH, height: IMAGE_HEIGHT, ownerId } });
        created.push({ id: row.id, file: uploadsFile });
        assetIds.push(row.id);
      } catch (error) {
        await unlink(uploadsFile).catch(() => undefined);
        throw error;
      }
    }
    return { assetIds, created };
  } catch (error) {
    await discard(db, created);
    throw error;
  }
}

async function owner(db: PrismaService) {
  const adminEmail = process.env['ADMIN_EMAIL']?.trim().toLowerCase();
  if (adminEmail) {
    const byEmail = await db.user.findUnique({ where: { email: adminEmail } });
    if (byEmail && byEmail.role === 'ADMIN' && !byEmail.disabledAt) return byEmail;
    console.log('ADMIN_EMAIL không trùng tài khoản ADMIN nào; dùng tài khoản ADMIN mới nhất để làm chủ ảnh import.');
  }
  return db.user.findFirst({ where: { role: 'ADMIN', disabledAt: null }, orderBy: { createdAt: 'desc' } });
}

async function fileExists(target: string) {
  return access(target).then(() => true).catch(() => false);
}

async function webp(source: string) {
  return sharp(source).resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: 'cover' }).webp({ quality: 85 }).toBuffer();
}

async function discard(db: PrismaService, created: CreatedAsset[]) {
  for (const asset of created) {
    await db.uploadAsset.delete({ where: { id: asset.id } }).catch(() => undefined);
    await unlink(asset.file).catch(() => undefined);
  }
}

// CLI entry: node dist/cli/import-products.js [--dir <folder>] [--draft]
const uploadsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '.local',
  readEnvironment(process.env).nodeEnv === 'test' ? 'test-uploads' : 'uploads');

const args = process.argv.slice(2);
const dirFlag = args.indexOf('--dir');
// The default import folder lives in the repo root so `npm run import:products -w @clothing/backend`
// (which executes with the workspace as cwd) still finds `data/import` regardless of where it is launched.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
// npm runs workspace scripts inside apps/backend; INIT_CWD is where the user typed the command, so a relative --dir means what they expect.
const launchDir = process.env['INIT_CWD'] ?? process.cwd();
const directory = dirFlag >= 0 && args[dirFlag + 1] ? path.resolve(launchDir, args[dirFlag + 1] as string) : path.join(repoRoot, 'data', 'import');
const asDraft = args.includes('--draft');
const csvPath = path.join(directory, 'products.csv');

const db = new PrismaService(readEnvironment(process.env));
try {
  const raw = (await readFile(csvPath, 'utf8').catch(() => null));
  if (raw === null) throw new Error(`Không đọc được ${csvPath}. Đặt products.csv và ảnh trong cùng thư mục (lệnh nhận --dir <thư mục>).`);
  const lines = csvLines(raw.replace(/^\ufeff/, '')).filter(({ cells }) => !cells[0]!.startsWith('#'));
  if (lines.length === 0) throw new Error(`Tệp ${csvPath} trống.`);
  const header = lines[0]!.cells.map((value) => value.toLowerCase());
  if (header.join() !== CSV_COLUMNS.join()) throw new Error(`Đầu tệp CSV phải là: ${CSV_COLUMNS.join(',')}`);

  const ownerUser = await owner(db);
  if (!ownerUser) {
    console.error('Cần một tài khoản ADMIN để làm chủ ảnh import. Chạy `npm run admin:create` trước khi import.');
    process.exitCode = 1;
  } else {
    const categories = new Map<string, { id: string; active: boolean }>();
    let createdProducts = 0;
    let skippedProducts = 0;
    let failedRows = 0;
    for (const { cells, line } of lines.slice(1)) {
      const row = validateRow(cells, line);
      if (typeof row === 'string') {
        console.log(`Bỏ qua dòng ${line} (${cells[0] || 'không có tên'}): ${row}.`);
        failedRows += 1;
        continue;
      }
      let missingFile: string | null = null;
      for (const file of row.files) {
        if (!await fileExists(path.join(directory, file))) { missingFile = file; break; }
      }
      if (missingFile) {
        console.log(`Bỏ qua dòng ${line} (${row.name}): file ${missingFile} không tồn tại.`);
        failedRows += 1;
        continue;
      }
      const slug = slugify(row.name);
      if (!slug) {
        console.log(`Bỏ qua dòng ${line} (${row.name}): tên không tạo được đường dẫn hợp lệ.`);
        failedRows += 1;
        continue;
      }
      const existing = await db.product.findUnique({ where: { slug } });
      if (existing) { skippedProducts += 1; console.log(`Sản phẩm ${row.name} (${slug}) đã có sẵn.`); continue; }
      try {
        const categorySlug = slugify(row.category);
        let category = categories.get(categorySlug);
        if (!category) {
          const found = await db.category.findUnique({ where: { slug: categorySlug } });
          category = found ? { id: found.id, active: found.active }
            : { id: (await db.category.create({ data: { name: row.category, slug: categorySlug, active: true } })).id, active: true };
          categories.set(categorySlug, category);
        }
        // Publishing into a turned-off category would report success while shoppers never see the product.
        if (!category.active && !asDraft) {
          console.log(`Bỏ qua dòng ${line} (${row.name}): danh mục ${row.category} đang tắt. Bật danh mục trong admin rồi chạy lại, hoặc nhập nháp bằng --draft.`);
          failedRows += 1;
          continue;
        }
        const categoryId = category.id;
        const { assetIds, created } = await prepareImages(db, ownerUser.id, directory, row.files);
        try {
          const status = asDraft ? 'DRAFT' : 'PUBLISHED';
          await db.product.create({ data: {
            name: row.name, slug, description: row.description, status, categoryId, priceFrom: row.price,
            variants: { create: variantsFor(row, slug, ownerUser.id) },
            images: { create: assetIds.map((assetId, position) => ({ assetId, position })) },
          } });
          createdProducts += 1;
          console.log(`Đã tạo sản phẩm ${row.name} (${slug}) — ${row.sizes.length} biến thể, ${assetIds.length} ảnh, trạng thái ${status}.`);
        } catch (error) {
          await discard(db, created);
          throw error;
        }
      } catch (error) {
        console.log(`Bỏ qua dòng ${line} (${row.name}): tạo dữ liệu thất bại — ${error instanceof Error ? error.message : String(error)}`);
        failedRows += 1;
      }
    }
    if (createdProducts > 0) {
      console.log(`Import xong: ${createdProducts} sản phẩm mới, ${skippedProducts} đã có sẵn, ${failedRows} dòng CSV bị bỏ qua. Sản phẩm PUBLISHED hiện ngay trên /shop.`);
    } else {
      const note = failedRows > 0 ? ` (${failedRows} dòng CSV bị bỏ qua, xem log ở trên)` : '';
      console.log(`Toàn bộ sản phẩm trong CSV đã có sẵn. Không tạo thêm. Muốn số/giá khác thì sửa products.csv rồi chạy lại.${note}`);
    }
  }
} catch (error) {
  console.error(`Import thất bại: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally { await db.$disconnect(); }

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { conflict, databaseError } from '../../common/database-errors.js';
import type { AdminProductQuery, ImagesDto, ProductDto, ProductQuery, ProductUpdateDto } from './dto/product.dto.js';

const include = { category: true, variants: { include: { inventory: true }, orderBy: { sku: 'asc' } },
  images: { orderBy: { position: 'asc' } } } satisfies Prisma.ProductInclude;
type Row = Prisma.ProductGetPayload<{ include: typeof include }>;
const visible = { status: 'PUBLISHED', category: { active: true }, variants: { some: { active: true } } } satisfies Prisma.ProductWhereInput;
function view(row: Row, admin: boolean) {
  return { id: row.id, name: row.name, slug: row.slug, description: row.description, categoryId: row.categoryId,
    category: { id: row.category.id, name: row.category.name, slug: row.category.slug }, priceFrom: Number(row.priceFrom),
    ...(admin ? { status: row.status, version: row.version } : {}),
    images: row.images.map((image) => ({ id: image.assetId, url: `/api/v1/${admin ? 'admin/uploads/images' : 'media'}/${image.assetId}` })),
    variants: row.variants.filter((variant) => admin || variant.active).map((variant) => ({ id: variant.id, sku: variant.sku,
      size: variant.size, color: variant.color, price: Number(variant.price), active: variant.active,
      available: (variant.inventory?.onHand ?? 0) - (variant.inventory?.reserved ?? 0),
      ...(admin ? { inventory: variant.inventory } : {}) })) };
}

@Injectable()
export class ProductsService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  async list(query: ProductQuery | AdminProductQuery, admin = false) {
    const where: Prisma.ProductWhereInput = { ...(admin ? {} : visible),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(admin && 'status' in query && query.status ? { status: query.status } : {}),
      ...(query.q ? { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { variants: { some: { sku: { contains: query.q, mode: 'insensitive' } } } }] } : {}) };
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = query.sort === 'price-asc' ? [{ priceFrom: 'asc' }, { id: 'asc' }]
      : query.sort === 'price-desc' ? [{ priceFrom: 'desc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'asc' }];
    const [rows, total] = await Promise.all([this.db.product.findMany({ where, include, orderBy, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), this.db.product.count({ where })]);
    return { items: rows.map((row) => view(row, admin)), page: query.page, pageSize: query.pageSize, total };
  }
  async detail(value: string, admin = false) {
    const row = await this.db.product.findFirst({ where: admin ? { id: value } : { ...visible, slug: value }, include });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy sản phẩm.' });
    return view(row, admin);
  }
  private validate(dto: ProductDto) {
    if (new Set(dto.variants.map((v) => v.sku)).size !== dto.variants.length
      || new Set(dto.variants.map((v) => `${v.size}:${v.color}`)).size !== dto.variants.length) conflict('SKU hoặc tổ hợp size/màu bị trùng.');
  }
  async create(dto: ProductDto) {
    this.validate(dto);
    if (dto.variants.some((v) => v.id)) throw new BadRequestException('Biến thể mới không nhận ID có sẵn.');
    try {
      const row = await this.db.product.create({ data: { name: dto.name, slug: dto.slug, description: dto.description,
        categoryId: dto.categoryId, priceFrom: Math.min(...(dto.variants.some((v) => v.active) ? dto.variants.filter((v) => v.active) : dto.variants).map((v) => v.price)),
        variants: { create: dto.variants.map(({ id: _id, ...v }) => ({ ...v, inventory: { create: {} } })) } }, include });
      return view(row, true);
    } catch (error) { databaseError(error); }
  }
  async update(id: string, dto: ProductUpdateDto) {
    this.validate(dto);
    try {
      return await this.db.$transaction(async (tx) => {
        const changed = await tx.product.updateMany({ where: { id, version: dto.expectedVersion }, data: { version: { increment: 1 } } });
        if (!changed.count) conflict();
        const before = await tx.product.findUniqueOrThrow({ where: { id }, include });
        const supplied = dto.variants.flatMap((v) => v.id ? [v.id] : []);
        if (new Set(supplied).size !== supplied.length || supplied.some((value) => !before.variants.some((v) => v.id === value))
          || before.variants.some((v) => !supplied.includes(v.id))) conflict('Không được xóa hoặc chuyển biến thể sang sản phẩm khác. Hãy tắt biến thể cũ.');
        const category = await tx.category.findUnique({ where: { id: dto.categoryId } });
        if (!category) throw new BadRequestException('Danh mục không hợp lệ.');
        if (before.status === 'PUBLISHED' && (!category.active || !dto.variants.some((v) => v.active))) conflict('Sản phẩm đang xuất bản cần danh mục và biến thể đang bật.');
        for (const { id: variantId, ...v } of dto.variants) {
          if (variantId) await tx.variant.update({ where: { id: variantId }, data: v });
          else await tx.variant.create({ data: { ...v, productId: id, inventory: { create: {} } } });
        }
        const active = dto.variants.filter((v) => v.active);
        const row = await tx.product.update({ where: { id }, data: { name: dto.name, slug: dto.slug, description: dto.description, categoryId: dto.categoryId,
          priceFrom: Math.min(...(active.length ? active : dto.variants).map((v) => v.price)) }, include });
        return view(row, true);
      });
    } catch (error) { databaseError(error); }
  }
  async state(id: string, expectedVersion: number, status: 'PUBLISHED' | 'HIDDEN') {
    try {
      return await this.db.$transaction(async (tx) => {
        const changed = await tx.product.updateMany({ where: { id, version: expectedVersion }, data: { status, version: { increment: 1 } } });
        if (!changed.count) conflict();
        const row = await tx.product.findUniqueOrThrow({ where: { id }, include });
        if (status === 'PUBLISHED' && (!row.category.active || !row.images.length || !row.variants.some((v) => v.active))) conflict('Cần danh mục bật, ít nhất một ảnh và một biến thể bật để xuất bản.');
        return view(row, true);
      });
    } catch (error) { databaseError(error); }
  }
  async images(id: string, actorId: string, dto: ImagesDto) {
    try {
      return await this.db.$transaction(async (tx) => {
        const changed = await tx.product.updateMany({ where: { id, version: dto.expectedVersion }, data: { version: { increment: 1 } } });
        if (!changed.count) conflict();
        const before = await tx.product.findUniqueOrThrow({ where: { id }, include });
        if (!dto.assetIds.length && before.status === 'PUBLISHED') conflict('Cần giữ ít nhất một ảnh cho sản phẩm đang xuất bản.');
        for (const assetId of [...dto.assetIds].sort()) {
          await tx.$queryRaw`SELECT id FROM upload_assets WHERE id = ${assetId}::uuid FOR UPDATE`;
          const asset = await tx.uploadAsset.findUnique({ where: { id: assetId }, include: { image: true } });
          const current = asset?.image?.productId === id;
          if (!asset || asset.image && !current || !current && (asset.ownerId !== actorId || asset.createdAt.getTime() < Date.now() - 86400000)) {
            conflict('Ảnh không hợp lệ, đã được gắn nơi khác hoặc không thuộc phiên tải lên của bạn.');
          }
        }
        await tx.productImage.deleteMany({ where: { productId: id } });
        await tx.productImage.createMany({ data: dto.assetIds.map((assetId, position) => ({ productId: id, assetId, position })) });
        return view(await tx.product.findUniqueOrThrow({ where: { id }, include }), true);
      });
    } catch (error) { databaseError(error); }
  }
}

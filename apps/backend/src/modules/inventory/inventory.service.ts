import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { InventoryMovement, Prisma } from '../../generated/prisma/client.js';
import { conflict, databaseError } from '../../common/database-errors.js';
import type { AdjustmentDto, InventoryQuery } from './dto/inventory.dto.js';

const result = (row: InventoryMovement) => ({ id: row.id, variantId: row.variantId, onHand: row.after,
  reserved: row.reserved, available: row.after - row.reserved, version: row.version });
@Injectable()
export class InventoryService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  async adjust(actorId: string, key: string | undefined, dto: AdjustmentDto) {
    if (!key || !/^[A-Za-z0-9_-]{16,120}$/.test(key) || !dto.delta) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Cần Idempotency-Key hợp lệ và lượng thay đổi khác 0.' });
    const hash = createHash('sha256').update(JSON.stringify([dto.variantId, dto.delta, dto.reason, dto.expectedVersion])).digest('hex');
    const replay = (row: InventoryMovement) => { if (row.requestHash !== hash) conflict('Mã thao tác đã dùng với nội dung khác.'); return result(row); };
    try {
      return await this.db.$transaction(async (tx) => {
        const existing = await tx.inventoryMovement.findUnique({ where: { actorId_key: { actorId, key } } });
        if (existing) return replay(existing);
        await tx.$queryRaw`SELECT "variantId" FROM inventory WHERE "variantId" = ${dto.variantId}::uuid FOR UPDATE`;
        const stock = await tx.inventory.findUnique({ where: { variantId: dto.variantId } });
        if (!stock) throw new NotFoundException();
        // Recheck after the row lock: a concurrent same-key request may have committed while waiting.
        const committed = await tx.inventoryMovement.findUnique({ where: { actorId_key: { actorId, key } } });
        if (committed) return replay(committed);
        if (stock.version !== dto.expectedVersion) conflict('Kho đã thay đổi. Hãy tải lại tồn trước khi điều chỉnh.');
        const after = stock.onHand + dto.delta;
        if (after < stock.reserved || after > 1000000) conflict('Tồn kho không được âm, nhỏ hơn lượng đang giữ hoặc vượt 1.000.000.');
        await tx.inventory.update({ where: { variantId: dto.variantId }, data: { onHand: after, version: { increment: 1 } } });
        const row = await tx.inventoryMovement.create({ data: { variantId: dto.variantId, actorId, key, requestHash: hash,
          delta: dto.delta, reason: dto.reason, before: stock.onHand, after, reserved: stock.reserved, version: stock.version + 1 } });
        return result(row);
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        const committed = await this.db.inventoryMovement.findUnique({ where: { actorId_key: { actorId, key } } });
        if (committed) return replay(committed);
      }
      databaseError(error);
    }
  }
  async list(query: InventoryQuery) {
    const where: Prisma.VariantWhereInput = { ...(query.variantId ? { id: query.variantId } : {}),
      ...(query.q ? { OR: [{ sku: { contains: query.q, mode: 'insensitive' } }, { product: { name: { contains: query.q, mode: 'insensitive' } } }] } : {}) };
    const [rows, total] = await Promise.all([this.db.variant.findMany({ where, include: { inventory: true, product: { select: { name: true } } }, orderBy: [{ sku: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }), this.db.variant.count({ where })]);
    return { items: rows.map((v) => ({ variantId: v.id, sku: v.sku, size: v.size, color: v.color, productName: v.product.name,
      onHand: v.inventory?.onHand ?? 0, reserved: v.inventory?.reserved ?? 0, version: v.inventory?.version ?? 0,
      available: (v.inventory?.onHand ?? 0) - (v.inventory?.reserved ?? 0) })), total, page: query.page, pageSize: query.pageSize };
  }
  async movements(query: InventoryQuery) {
    const where = { ...(query.variantId ? { variantId: query.variantId } : {}), ...(query.q ? { variant: { sku: { contains: query.q, mode: 'insensitive' as const } } } : {}) };
    const [items, total] = await Promise.all([this.db.inventoryMovement.findMany({ where, select: { id: true, variantId: true, delta: true, reason: true, before: true, after: true, reserved: true, version: true, createdAt: true,
      actor: { select: { name: true } }, variant: { select: { sku: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }), this.db.inventoryMovement.count({ where })]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { conflict } from '../../common/database-errors.js';
import type { InventoryEffectSource, Prisma } from '../../generated/prisma/client.js';

export type InventoryActor = { type: 'ADMIN'; id: string } | { type: 'GUEST' } | { type: 'SYSTEM' };
export interface StockLine { variantId: string; quantity: number }
export interface StockEffect { variantId: string; onHand: number; reserved: number; available: number; version: number }

type Operation = 'reserve' | 'release' | 'ship';

const sources: Record<Operation, InventoryEffectSource> = {
  reserve: 'ORDER_RESERVE', release: 'ORDER_RELEASE', ship: 'ORDER_SHIP',
};

const shortfalls: Record<Operation, string> = {
  reserve: 'Không đủ hàng khả dụng để giữ cho giỏ này.',
  release: 'Không có lượng đang giữ tương ứng để giải phóng.',
  ship: 'Không đủ lượng đang giữ để bàn giao.',
};

/**
 * Order-facing inventory effects (m4-contract §9). Every method receives the coordinating service's
 * Prisma.TransactionClient and never opens a transaction or calls other modules. One base effect key
 * is bound to the hash of the whole operation: the lowest-variantId line stores the bare key (unique)
 * as the anchor, later lines store `base:variantId`. A different payload reusing the key collides on
 * the anchor even with disjoint SKU sets; concurrent collisions abort via the same unique violation,
 * and retrying the whole transaction then hits the precheck and returns the recorded effect.
 */
@Injectable()
export class InventoryOperationsService {
  reserve(tx: Prisma.TransactionClient, effectKey: string, lines: StockLine[], actor: InventoryActor, reason: string) {
    return this.apply(tx, 'reserve', effectKey, lines, actor, reason);
  }

  release(tx: Prisma.TransactionClient, effectKey: string, lines: StockLine[], actor: InventoryActor, reason: string) {
    return this.apply(tx, 'release', effectKey, lines, actor, reason);
  }

  ship(tx: Prisma.TransactionClient, effectKey: string, lines: StockLine[], actor: InventoryActor, reason: string) {
    return this.apply(tx, 'ship', effectKey, lines, actor, reason);
  }

  private validate(effectKey: string, lines: StockLine[], actor: InventoryActor, reason: string) {
    if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{7,79}$/.test(effectKey)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Effect key không hợp lệ.' });
    }
    if (!lines.length || lines.length > 50 || new Set(lines.map((line) => line.variantId)).size !== lines.length
      || !lines.every((line) => /^[0-9a-fA-F-]{36}$/.test(line.variantId) && Number.isInteger(line.quantity) && line.quantity >= 1 && line.quantity <= 99)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Danh sách biến thể không hợp lệ.' });
    }
    if ((actor.type === 'ADMIN') !== ('id' in actor && Boolean(actor.id))) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Actor không hợp lệ.' });
    }
    const trimmed = reason.trim();
    if (trimmed.length < 3 || trimmed.length > 300) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Cần lý do từ 3 đến 300 ký tự.' });
    }
    return {
      // Stable lock order by variantId keeps concurrent carts from deadlocking.
      lines: [...lines].sort((left, right) => (left.variantId < right.variantId ? -1 : left.variantId > right.variantId ? 1 : 0)),
      actorId: actor.type === 'ADMIN' ? actor.id : null,
      reason: trimmed,
    };
  }

  private async apply(tx: Prisma.TransactionClient, operation: Operation, effectKey: string, lines: StockLine[],
    actor: InventoryActor, reason: string): Promise<StockEffect[]> {
    const prepared = this.validate(effectKey, lines, actor, reason);
    // Canonical content: sorted lines with fixed field order, so the same business effect hashes identically.
    const requestHash = createHash('sha256')
      .update(JSON.stringify([operation, prepared.lines, prepared.reason, { type: actor.type, id: prepared.actorId }]))
      .digest('hex');
    // First (lowest variantId) row anchors the bare key; the rest carry base:variantId for per-line lookup.
    const rowKeys = prepared.lines.map((line, index) => index === 0 ? effectKey : `${effectKey}:${line.variantId}`);
    const committed = await tx.inventoryMovement.findUnique({ where: { effectKey: rowKeys[0]! } });
    if (committed) return this.replay(tx, effectKey, requestHash);
    const effects: StockEffect[] = [];
    for (const [index, line] of prepared.lines.entries()) {
      const locked = await tx.$queryRaw<Array<{ onHand: number; reserved: number; version: number }>>`
        SELECT "onHand", "reserved", "version" FROM "inventory" WHERE "variantId" = ${line.variantId}::uuid FOR UPDATE`;
      if (!locked.length) conflict('Sản phẩm không còn bán hoặc đã đổi. Hãy tải lại giỏ.');
      // Recheck under the row lock: a concurrent same-effect transaction may have committed while we waited.
      const committedNow = await tx.inventoryMovement.findUnique({ where: { effectKey: rowKeys[index]! } });
      if (committedNow) {
        if (effects.length === 0) return this.replay(tx, effectKey, requestHash);
        conflict('Hiệu ứng kho đã được ghi bởi yêu cầu khác. Hãy thử lại.');
      }
      let updated: Array<{ onHand: number; reserved: number; version: number }>;
      if (operation === 'reserve') {
        updated = await tx.$queryRaw<Array<{ onHand: number; reserved: number; version: number }>>`
          UPDATE "inventory" SET "reserved" = "reserved" + ${line.quantity}, "version" = "version" + 1
          WHERE "variantId" = ${line.variantId}::uuid AND "onHand" - "reserved" >= ${line.quantity}
          RETURNING "onHand", "reserved", "version"`;
      } else if (operation === 'release') {
        updated = await tx.$queryRaw<Array<{ onHand: number; reserved: number; version: number }>>`
          UPDATE "inventory" SET "reserved" = "reserved" - ${line.quantity}, "version" = "version" + 1
          WHERE "variantId" = ${line.variantId}::uuid AND "reserved" >= ${line.quantity}
          RETURNING "onHand", "reserved", "version"`;
      } else {
        updated = await tx.$queryRaw<Array<{ onHand: number; reserved: number; version: number }>>`
          UPDATE "inventory" SET "onHand" = "onHand" - ${line.quantity}, "reserved" = "reserved" - ${line.quantity}, "version" = "version" + 1
          WHERE "variantId" = ${line.variantId}::uuid AND "reserved" >= ${line.quantity} AND "onHand" >= ${line.quantity}
          RETURNING "onHand", "reserved", "version"`;
      }
      const after = updated[0];
      if (!after) conflict(shortfalls[operation]);
      const before = operation === 'ship' ? after.onHand + line.quantity : after.onHand;
      await tx.inventoryMovement.create({ data: { variantId: line.variantId, actorId: prepared.actorId, actorType: actor.type,
        source: sources[operation], effectKey: rowKeys[index]!, key: rowKeys[index]!, requestHash,
        delta: operation === 'ship' ? -line.quantity : 0, reason: prepared.reason, before, after: after.onHand,
        reserved: after.reserved, version: after.version } });
      effects.push({ variantId: line.variantId, onHand: after.onHand, reserved: after.reserved,
        available: after.onHand - after.reserved, version: after.version });
    }
    return effects;
  }

  private async replay(tx: Prisma.TransactionClient, baseKey: string, requestHash: string): Promise<StockEffect[]> {
    // Bare key first (the anchor row), then base:<variantId> rows — the colon keeps a longer base such as
    // `order:1:reserveX` from matching this effect's rows.
    const rows = await tx.inventoryMovement.findMany({
      where: { OR: [{ effectKey: baseKey }, { effectKey: { startsWith: `${baseKey}:` } }] },
      orderBy: { effectKey: 'asc' },
    });
    if (!rows.length || rows.some((row) => row.requestHash !== requestHash)) {
      conflict('Mã hiệu ứng đã dùng với nội dung khác.');
    }
    return rows.map((row) => ({ variantId: row.variantId, onHand: row.after, reserved: row.reserved,
      available: row.after - row.reserved, version: row.version }));
  }
}

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { conflict, databaseError } from '../../common/database-errors.js';
import type { IdempotencyRecord, Prisma } from '../../generated/prisma/client.js';
import type { OrderMethod, OrderStatus } from '../../generated/prisma/enums.js';
import { InventoryOperationsService } from '../inventory/inventory-operations.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const KEY_PATTERN = /^[A-Za-z0-9_-]{16,120}$/;
// Retention agrees with the m4-contract §10 proposal; sweeping expired records arrives with M4 cleanup.
const RECORD_TTL_MS = 30 * 86400000;
const MINUTE_MS = 60000;
// An admin device whose clock runs slightly ahead must not turn a delivery recorded just now into "the future".
const CLOCK_SKEW_MS = 5 * MINUTE_MS;

function refuseDeliveryTime(message: string): never {
  throw new BadRequestException({ code: 'VALIDATION_ERROR', message });
}

export interface AdminOrderTransitionView {
  id: string;
  code: string;
  status: OrderStatus;
  version: number;
}

interface TransitionRule {
  action: string;
  from: readonly OrderStatus[];
  to: OrderStatus;
  /** Extra business condition on the locked order; answers the refusal message, or null to proceed. */
  refuse?: (order: { method: OrderMethod }) => string | null;
}

interface TransitionCommand {
  actorId: string;
  orderId: string;
  key: string | undefined;
  expectedVersion: number;
  reason?: string;
  trackingNumber?: string;
  deliveredAt?: string;
}

/** Runs inside the transition's transaction, so a failure here rolls the state change back too. */
type TransitionEffect = (tx: Prisma.TransactionClient, order: { code: string }) => Promise<Prisma.OrderUpdateInput>;

const CONFIRM: TransitionRule = {
  action: 'confirm',
  from: ['PENDING'],
  to: 'CONFIRMED',
  // m4-contract §2: a bank order needs full payment before the deadline, which arrives with M4.6.2.
  refuse: (order) => (order.method === 'COD' ? null : 'Đơn chuyển khoản chỉ xác nhận được khi đã nhận đủ tiền.'),
};

const PACK: TransitionRule = {
  action: 'pack',
  from: ['CONFIRMED'],
  to: 'PACKING',
};

const SHIP: TransitionRule = {
  action: 'ship',
  from: ['PACKING'],
  to: 'SHIPPED',
};

// COD stays uncollected here: delivery is not proof of money, which is reconciled in M4.6.4.
const DELIVER: TransitionRule = {
  action: 'deliver',
  from: ['SHIPPED'],
  to: 'DELIVERED',
};

// Refund obligations for money already collected arrive with the payment ledger in M4.6.2.
const CANCEL: TransitionRule = {
  action: 'cancel',
  from: ['PENDING', 'CONFIRMED', 'PACKING'],
  to: 'CANCELLED',
};

function isTransitionView(value: unknown): value is AdminOrderTransitionView {
  return typeof value === 'object' && value !== null && 'id' in value && 'code' in value && 'status' in value && 'version' in value;
}

/**
 * Admin moves an order along the state machine (m4-contract §2, §7): one transaction holds the order
 * row lock, checks the expected version and status, then writes the new state, its history entry and
 * the command record together — so racing admins get exactly one winner and a replay changes nothing.
 */
@Injectable()
export class AdminOrderTransitionsService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(InventoryOperationsService) private readonly inventory: InventoryOperationsService,
  ) {}

  confirm(actorId: string, orderId: string, key: string | undefined, expectedVersion: number) {
    return this.apply(CONFIRM, { actorId, orderId, key, expectedVersion });
  }

  pack(actorId: string, orderId: string, key: string | undefined, expectedVersion: number) {
    return this.apply(PACK, { actorId, orderId, key, expectedVersion });
  }

  ship(actorId: string, orderId: string, key: string | undefined, expectedVersion: number, trackingNumber: string) {
    return this.apply(SHIP, { actorId, orderId, key, expectedVersion, trackingNumber }, async (tx, order) => {
      await this.inventory.ship(tx, `order:${orderId}:ship`, await this.linesOf(tx, orderId), { type: 'ADMIN', id: actorId }, `Bàn giao đơn ${order.code}`);
      return { trackingNumber };
    });
  }

  deliver(actorId: string, orderId: string, key: string | undefined, expectedVersion: number, deliveredAt: string) {
    const at = new Date(deliveredAt);
    return this.apply(DELIVER, { actorId, orderId, key, expectedVersion, deliveredAt: at.toISOString() }, async (tx) => {
      if (at.getTime() > Date.now() + CLOCK_SKEW_MS) refuseDeliveryTime('Thời điểm giao không được ở tương lai.');
      const handover = await tx.orderStatusHistory.findFirst({ where: { orderId, toStatus: 'SHIPPED' }, orderBy: { version: 'desc' }, select: { createdAt: true } });
      // The admin's field has no seconds, so the handover's own minute must still count as after it.
      if (handover && at.getTime() < Math.floor(handover.createdAt.getTime() / MINUTE_MS) * MINUTE_MS) {
        refuseDeliveryTime('Thời điểm giao không được trước lúc bàn giao.');
      }
      return { deliveredAt: at };
    });
  }

  cancel(actorId: string, orderId: string, key: string | undefined, expectedVersion: number, reason: string) {
    return this.apply(CANCEL, { actorId, orderId, key, expectedVersion, reason }, async (tx, order) => {
      // The movement carries a fixed reason: what the admin typed belongs to the order, not the stock log.
      await this.inventory.release(tx, `order:${orderId}:release`, await this.linesOf(tx, orderId), { type: 'ADMIN', id: actorId }, `Hủy đơn ${order.code}`);
      return { cancelledAt: new Date(), cancelReason: reason };
    });
  }

  private linesOf(tx: Prisma.TransactionClient, orderId: string) {
    return tx.orderItem.findMany({ where: { orderId }, select: { variantId: true, quantity: true } });
  }

  private async apply(rule: TransitionRule, { actorId, orderId, key, expectedVersion, reason, trackingNumber, deliveredAt }: TransitionCommand,
    effect?: TransitionEffect): Promise<AdminOrderTransitionView> {
    if (!key || !KEY_PATTERN.test(key)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Cần Idempotency-Key hợp lệ.' });
    }
    const scope = `orders.transition:${rule.action}`;
    const identity = `admin:${actorId}`;
    // Only what a command actually carries joins the hash, so records already stored still replay.
    const details = [reason, trackingNumber, deliveredAt].filter((detail) => detail !== undefined);
    const requestHash = createHash('sha256').update(JSON.stringify([scope, orderId, expectedVersion, ...details])).digest('hex');
    const command = (client: Prisma.TransactionClient) =>
      client.idempotencyRecord.findUnique({ where: { scope_identity_key: { scope, identity, key } } });
    try {
      return await this.db.$transaction(async (tx) => {
        const recorded = await command(tx);
        if (recorded) return this.replay(recorded, requestHash, orderId);
        await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "orders" WHERE "id" = ${orderId}::uuid FOR UPDATE`;
        // A same-key request may have committed while this one waited for the lock.
        const recordedNow = await command(tx);
        if (recordedNow) return this.replay(recordedNow, requestHash, orderId);
        const order = await tx.order.findUnique({ where: { id: orderId }, select: { code: true, status: true, method: true, version: true } });
        if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy đơn hàng.' });
        if (order.version !== expectedVersion) conflict('Đơn đã thay đổi. Hãy tải lại đơn rồi thử lại.');
        if (!rule.from.includes(order.status)) conflict('Trạng thái đơn không cho phép thao tác này. Hãy tải lại đơn.');
        const refusal = rule.refuse?.(order);
        if (refusal) conflict(refusal);
        const changes = await effect?.(tx, order);
        const version = order.version + 1;
        const updated = await tx.order.update({ where: { id: orderId }, data: { ...changes, status: rule.to, version },
          select: { id: true, code: true, status: true, version: true } });
        await tx.orderStatusHistory.create({ data: { orderId, fromStatus: order.status, toStatus: rule.to, actorType: 'ADMIN', actorId,
          reason: reason ?? null, version } });
        await tx.idempotencyRecord.create({ data: { scope, identity, key, requestHash, resourceId: orderId,
          response: updated as unknown as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + RECORD_TTL_MS) } });
        return updated;
      });
    } catch (error) {
      // A unique violation means the competing same-key request already committed; its result stands.
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002') {
        const recorded = await command(this.db);
        if (recorded) return this.replay(recorded, requestHash, orderId);
      }
      databaseError(error);
    }
  }

  private async replay(record: IdempotencyRecord, requestHash: string, orderId: string): Promise<AdminOrderTransitionView> {
    if (record.requestHash !== requestHash) conflict('Mã thao tác đã dùng với nội dung khác.');
    // The response column only ever holds what this service wrote; degrade to the current order otherwise.
    if (isTransitionView(record.response)) return record.response;
    return this.db.order.findUniqueOrThrow({ where: { id: orderId }, select: { id: true, code: true, status: true, version: true } });
  }
}

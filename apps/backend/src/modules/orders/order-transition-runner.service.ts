import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { conflict, databaseError } from '../../common/database-errors.js';
import type { IdempotencyRecord, Prisma } from '../../generated/prisma/client.js';
import type { OrderMethod, OrderStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

const KEY_PATTERN = /^[A-Za-z0-9_-]{16,120}$/;
// Retention agrees with the m4-contract §10 proposal; sweeping expired records arrives with M4 cleanup.
const RECORD_TTL_MS = 30 * 86400000;

export interface OrderTransitionView {
  id: string;
  code: string;
  status: OrderStatus;
  version: number;
}

export interface TransitionRule {
  from: readonly OrderStatus[];
  to: OrderStatus;
  /** Extra business condition on the locked order; answers the refusal message, or null to proceed. */
  refuse?: (order: { method: OrderMethod }) => string | null;
}

export interface TransitionRequest {
  rule: TransitionRule;
  /** Server-chosen idempotency scope and identity (m4-contract §6, §7). */
  scope: string;
  identity: string;
  actor: { type: 'ADMIN'; id: string } | { type: 'GUEST' };
  orderId: string;
  key: string | undefined;
  expectedVersion: number;
  /** What the command carries besides the version; it joins the hash, so a resend cannot change it. */
  details?: readonly string[];
  /** Shown in the order history, which the customer can read. */
  reason?: string;
  /** Re-checks access under the row lock, where a concurrent token change can no longer slip past. */
  authorize?: (order: { lookupTokenHash: string | null }) => void;
  /** Runs inside the transaction, so a failure here rolls the state change back too. */
  effect?: (tx: Prisma.TransactionClient, order: { code: string }) => Promise<Prisma.OrderUpdateInput | void>;
}

function isTransitionView(value: unknown): value is OrderTransitionView {
  return typeof value === 'object' && value !== null && 'id' in value && 'code' in value && 'status' in value && 'version' in value;
}

/**
 * Moves an order along the state machine (m4-contract §2, §7): one transaction holds the order row lock,
 * checks the expected version and status, then writes the new state, its history entry and the command
 * record together — so racing commands get exactly one winner and a replay changes nothing.
 */
@Injectable()
export class OrderTransitionRunner {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  linesOf(tx: Prisma.TransactionClient, orderId: string) {
    return tx.orderItem.findMany({ where: { orderId }, select: { variantId: true, quantity: true } });
  }

  async run({ rule, scope, identity, actor, orderId, key, expectedVersion, details = [], reason, authorize, effect }: TransitionRequest): Promise<OrderTransitionView> {
    if (!key || !KEY_PATTERN.test(key)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Cần Idempotency-Key hợp lệ.' });
    }
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
        const order = await tx.order.findUnique({ where: { id: orderId }, select: { code: true, status: true, method: true, version: true, lookupTokenHash: true } });
        if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy đơn hàng.' });
        authorize?.(order);
        if (order.version !== expectedVersion) conflict('Đơn đã thay đổi. Hãy tải lại đơn rồi thử lại.');
        if (!rule.from.includes(order.status)) conflict('Trạng thái đơn không cho phép thao tác này. Hãy tải lại đơn.');
        const refusal = rule.refuse?.(order);
        if (refusal) conflict(refusal);
        const changes = await effect?.(tx, order);
        const version = order.version + 1;
        const updated = await tx.order.update({ where: { id: orderId }, data: { ...changes, status: rule.to, version },
          select: { id: true, code: true, status: true, version: true } });
        await tx.orderStatusHistory.create({ data: { orderId, fromStatus: order.status, toStatus: rule.to, actorType: actor.type,
          actorId: actor.type === 'ADMIN' ? actor.id : null, reason: reason ?? null, version } });
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

  private async replay(record: IdempotencyRecord, requestHash: string, orderId: string): Promise<OrderTransitionView> {
    if (record.requestHash !== requestHash) conflict('Mã thao tác đã dùng với nội dung khác.');
    // The response column only ever holds what this service wrote; degrade to the current order otherwise.
    if (isTransitionView(record.response)) return record.response;
    return this.db.order.findUniqueOrThrow({ where: { id: orderId }, select: { id: true, code: true, status: true, version: true } });
  }
}

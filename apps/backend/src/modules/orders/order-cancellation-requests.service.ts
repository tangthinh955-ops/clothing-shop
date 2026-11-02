import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { conflict, databaseError } from '../../common/database-errors.js';
import type { IdempotencyRecord, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { INVALID_CODE_SHAPE, orderAccessNotFound } from './order-access.service.js';
import { lookupTokenHash } from './order-command.js';
import { OrderNotificationsService } from './order-notifications.service.js';

const REQUEST_SCOPE = 'orders.cancellation-request';
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,120}$/;
// Retention agrees with the m4-contract §10 proposal; sweeping expired records arrives with M4 cleanup.
const RECORD_TTL_MS = 30 * 86400000;

const REQUEST_SELECT = { status: true, reason: true, createdAt: true } as const;

export type CancellationRequestView = Prisma.CancellationRequestGetPayload<{ select: typeof REQUEST_SELECT }>;

/**
 * A customer asking to cancel while the order is being packed (m4-contract §2). Asking changes nothing
 * about the order: the shop answers by cancelling or handing over, and closePending settles it there.
 * Every wrong access answers the uniform 404, and the row lock serializes a request with those steps.
 */
@Injectable()
export class OrderCancellationRequestsService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(OrderNotificationsService) private readonly notifications: OrderNotificationsService,
  ) {}

  async submit(input: { code: string; token: string; sessionId: string; key: string | undefined; reason: string }): Promise<CancellationRequestView> {
    if (INVALID_CODE_SHAPE(input.code)) throw orderAccessNotFound();
    const tokenHash = lookupTokenHash(input.token);
    const found = await this.db.order.findUnique({ where: { code: input.code }, select: { id: true, lookupTokenHash: true } });
    // Checked before the replay path too: a link replaced by a lookup no longer answers anything.
    if (!found || found.lookupTokenHash !== tokenHash) throw orderAccessNotFound();
    const { key } = input;
    if (!key || !KEY_PATTERN.test(key)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Cần Idempotency-Key hợp lệ.' });
    }
    const orderId = found.id;
    const identity = `guest:${input.sessionId}`;
    const requestHash = createHash('sha256').update(JSON.stringify([REQUEST_SCOPE, orderId, input.reason])).digest('hex');
    let created = false;
    try {
      const view = await this.db.$transaction(async (tx) => {
        const recorded = await this.command(tx, identity, key);
        if (recorded) return this.replay(tx, recorded, requestHash);
        await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "orders" WHERE "id" = ${orderId}::uuid FOR UPDATE`;
        // A same-key request may have committed while this one waited for the lock.
        const recordedNow = await this.command(tx, identity, key);
        if (recordedNow) return this.replay(tx, recordedNow, requestHash);
        const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true, lookupTokenHash: true } });
        if (order.lookupTokenHash !== tokenHash) throw orderAccessNotFound();
        if (order.status !== 'PACKING') conflict('Trạng thái đơn không cho phép thao tác này. Hãy tải lại đơn.');
        const waiting = await tx.cancellationRequest.count({ where: { orderId, status: 'PENDING' } });
        if (waiting > 0) conflict('Đơn đã có yêu cầu hủy đang chờ shop xử lý.');
        const request = await tx.cancellationRequest.create({ data: { orderId, reason: input.reason }, select: { id: true, ...REQUEST_SELECT } });
        await this.notifications.enqueueCancelRequested(tx, orderId);
        await tx.idempotencyRecord.create({ data: { scope: REQUEST_SCOPE, identity, key, requestHash, resourceId: request.id,
          expiresAt: new Date(Date.now() + RECORD_TTL_MS) } });
        created = true;
        return { status: request.status, reason: request.reason, createdAt: request.createdAt };
      });
      if (created) void this.notifications.dispatchCancelRequested(input.code);
      return view;
    } catch (error) {
      // A unique violation means the competing request already committed this key; its result stands.
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002') {
        const recorded = await this.command(this.db, identity, key);
        if (recorded) return this.replay(this.db, recorded, requestHash);
      }
      databaseError(error);
    }
  }

  /** The shop's answer: called inside its cancel or handover transaction, so the two commit as one. */
  async closePending(tx: Prisma.TransactionClient, orderId: string, status: 'APPROVED' | 'REJECTED'): Promise<void> {
    await tx.cancellationRequest.updateMany({ where: { orderId, status: 'PENDING' }, data: { status, decidedAt: new Date() } });
  }

  private command(client: Prisma.TransactionClient, identity: string, key: string) {
    return client.idempotencyRecord.findUnique({ where: { scope_identity_key: { scope: REQUEST_SCOPE, identity, key } } });
  }

  private async replay(client: Prisma.TransactionClient, record: IdempotencyRecord, requestHash: string): Promise<CancellationRequestView> {
    if (record.requestHash !== requestHash) conflict('Mã thao tác đã dùng với nội dung khác.');
    const request = await client.cancellationRequest.findUnique({ where: { id: record.resourceId ?? '' }, select: REQUEST_SELECT });
    if (!request) throw orderAccessNotFound();
    return request;
  }
}

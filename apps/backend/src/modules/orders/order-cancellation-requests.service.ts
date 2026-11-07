import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { conflict, databaseError } from '../../common/database-errors.js';
import type { IdempotencyRecord, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { INVALID_CODE_SHAPE, orderAccessNotFound } from './order-access.service.js';
import { lookupTokenHash } from './order-command.js';
import { OrderNotificationsService } from './order-notifications.service.js';

const REQUEST_SCOPE = 'orders.cancellation-request';
const DECISION_SCOPE = 'orders.cancellation-decision';
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,120}$/;
// Retention agrees with the m4-contract §10 proposal; sweeping expired records arrives with M4 cleanup.
const RECORD_TTL_MS = 30 * 86400000;

const REQUEST_SELECT = { status: true, reason: true, createdAt: true } as const;

export type CancellationRequestView = Prisma.CancellationRequestGetPayload<{ select: typeof REQUEST_SELECT }>;

export interface CancellationDecisionView {
  requestId: string;
  decision: 'REJECTED';
  decidedAt: string;
  order: { id: string; code: string; status: string; version: number };
}

function isDecisionView(value: unknown): value is CancellationDecisionView {
  return typeof value === 'object' && value !== null && 'requestId' in value && 'decision' in value
    && 'decidedAt' in value && typeof (value as CancellationDecisionView).decidedAt === 'string'
    && typeof (value as CancellationDecisionView).order === 'object' && (value as CancellationDecisionView).order !== null;
}

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
        // The request id separates this ask's notice from any later one on the same order (M4.5.8).
        await this.notifications.enqueueCancelRequested(tx, orderId, request.id);
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

  /**
   * The shop's refusal (M4.5.8): the order stays PACKING with its goods and money untouched, so the
   * decision lives on the request row and only Order.version moves — one bump that makes a racing
   * handover or cancel with the same expected version lose. The runner is not reused because no
   * status changes and no PACKING → PACKING history row may exist.
   */
  async reject(input: { orderId: string; requestId: string; actorId: string; key: string | undefined; expectedVersion: number; reason: string }): Promise<CancellationDecisionView> {
    const { key } = input;
    if (!key || !KEY_PATTERN.test(key)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Cần Idempotency-Key hợp lệ.' });
    }
    const identity = `admin:${input.actorId}`;
    const requestHash = createHash('sha256').update(JSON.stringify([DECISION_SCOPE, input.orderId, input.requestId, 'REJECTED', input.expectedVersion, input.reason])).digest('hex');
    const command = (client: Prisma.TransactionClient) =>
      client.idempotencyRecord.findUnique({ where: { scope_identity_key: { scope: DECISION_SCOPE, identity, key } } });
    try {
      return await this.db.$transaction(async (tx) => {
        const recorded = await command(tx);
        if (recorded) return this.decisionReplay(recorded, requestHash);
        await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "orders" WHERE "id" = ${input.orderId}::uuid FOR UPDATE`;
        // A same-key decision may have committed while this one waited for the lock.
        const recordedNow = await command(tx);
        if (recordedNow) return this.decisionReplay(recordedNow, requestHash);
        const order = await tx.order.findUnique({ where: { id: input.orderId }, select: { id: true, code: true, status: true, version: true } });
        if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy đơn hàng.' });
        if (order.version !== input.expectedVersion) conflict('Đơn đã thay đổi. Hãy tải lại đơn rồi thử lại.');
        if (order.status !== 'PACKING') conflict('Trạng thái đơn không cho phép thao tác này. Hãy tải lại đơn.');
        // The exact request must still be waiting: a decided one cannot be consumed again, and an
        // ask the customer opened after this dialog did cannot be decided in its place.
        const request = await tx.cancellationRequest.findFirst({ where: { id: input.requestId, orderId: input.orderId, status: 'PENDING' }, select: { id: true } });
        if (!request) conflict('Yêu cầu hủy không còn chờ xử lý hoặc không thuộc đơn này. Hãy tải lại đơn.');
        const decidedAt = new Date();
        await tx.cancellationRequest.update({ where: { id: request!.id },
          data: { status: 'REJECTED', decidedAt, decisionReason: input.reason, decidedById: input.actorId } });
        const updated = await tx.order.update({ where: { id: order.id }, data: { version: order.version + 1 },
          select: { id: true, code: true, status: true, version: true } });
        await tx.idempotencyRecord.create({ data: { scope: DECISION_SCOPE, identity, key, requestHash, resourceId: request!.id,
          response: { requestId: request!.id, decision: 'REJECTED', decidedAt: decidedAt.toISOString(), order: updated } as unknown as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + RECORD_TTL_MS) } });
        return { requestId: request!.id, decision: 'REJECTED', decidedAt: decidedAt.toISOString(), order: updated };
      });
    } catch (error) {
      // A unique violation means the competing same-key decision already committed; its result stands.
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002') {
        const recorded = await command(this.db);
        if (recorded) return this.decisionReplay(recorded, requestHash);
      }
      databaseError(error);
    }
  }

  /** The shop's answer: called inside its cancel or handover transaction, so the two commit as one. */
  async closePending(tx: Prisma.TransactionClient, orderId: string, status: 'APPROVED' | 'REJECTED', decidedById?: string): Promise<void> {
    await tx.cancellationRequest.updateMany({ where: { orderId, status: 'PENDING' },
      data: { status, decidedAt: new Date(), ...(decidedById ? { decidedById } : {}) } });
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

  private decisionReplay(record: IdempotencyRecord, requestHash: string): CancellationDecisionView {
    if (record.requestHash !== requestHash) conflict('Mã thao tác đã dùng với nội dung khác.');
    if (isDecisionView(record.response)) return record.response;
    // The response column only ever holds what this service wrote; the record is not one of ours.
    throw conflict('Mã thao tác đã dùng với nội dung khác.');
  }
}

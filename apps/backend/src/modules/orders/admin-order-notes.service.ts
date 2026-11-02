import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { conflict, databaseError } from '../../common/database-errors.js';
import type { IdempotencyRecord, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const NOTE_SCOPE = 'admin-orders.note';
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,120}$/;
// Retention agrees with the m4-contract §10 proposal; sweeping expired records arrives with M4 cleanup.
const RECORD_TTL_MS = 30 * 86400000;

const NOTE_SELECT = { id: true, body: true, createdAt: true, author: { select: { name: true } } } as const;

export interface AdminOrderNoteView {
  id: string;
  body: string;
  authorName: string;
  createdAt: Date;
}

function viewOf(note: Prisma.OrderNoteGetPayload<{ select: typeof NOTE_SELECT }>): AdminOrderNoteView {
  return { id: note.id, body: note.body, authorName: note.author.name, createdAt: note.createdAt };
}

/**
 * Internal notes are append-only and live beside the order: writing one never changes Order.version,
 * status or money. The command record commits with the note, so a replay after a lost response
 * answers the same note and a racing same-key request resolves as that replay, not a second note.
 */
@Injectable()
export class AdminOrderNotesService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async add(actorId: string, orderId: string, key: string | undefined, body: string): Promise<AdminOrderNoteView> {
    if (!key || !KEY_PATTERN.test(key)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Cần Idempotency-Key hợp lệ.' });
    }
    const identity = `admin:${actorId}`;
    const requestHash = createHash('sha256').update(JSON.stringify([NOTE_SCOPE, orderId, body])).digest('hex');
    try {
      return await this.db.$transaction(async (tx) => {
        const recorded = await this.command(tx, identity, key);
        if (recorded) return this.replay(tx, recorded, requestHash);
        const order = await tx.order.findUnique({ where: { id: orderId }, select: { id: true } });
        if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy đơn hàng.' });
        const note = await tx.orderNote.create({ data: { orderId, authorId: actorId, body }, select: NOTE_SELECT });
        await tx.idempotencyRecord.create({ data: { scope: NOTE_SCOPE, identity, key, requestHash, resourceId: note.id,
          expiresAt: new Date(Date.now() + RECORD_TTL_MS) } });
        return viewOf(note);
      });
    } catch (error) {
      // A unique violation means the competing request already committed this key; its note stands.
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002') {
        const recorded = await this.command(this.db, identity, key);
        if (recorded) return this.replay(this.db, recorded, requestHash);
      }
      databaseError(error);
    }
  }

  private command(client: Prisma.TransactionClient, identity: string, key: string) {
    return client.idempotencyRecord.findUnique({ where: { scope_identity_key: { scope: NOTE_SCOPE, identity, key } } });
  }

  private async replay(client: Prisma.TransactionClient, record: IdempotencyRecord, requestHash: string): Promise<AdminOrderNoteView> {
    if (record.requestHash !== requestHash) conflict('Mã thao tác đã dùng với nội dung khác.');
    const note = await client.orderNote.findUnique({ where: { id: record.resourceId ?? '' }, select: NOTE_SELECT });
    if (!note) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy đơn hàng.' });
    return viewOf(note);
  }
}

import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { conflict, databaseError } from '../../common/database-errors.js';
import type { IdempotencyRecord, Prisma, ShopSettings } from '../../generated/prisma/client.js';
import type { UpdateSettingsDto } from './dto/update-settings.dto.js';

// Safe built-in defaults used only when no shop_settings row exists; never persisted by reads.
const DEFAULTS = { shippingFeeVnd: 30000, bankDeadlineMinutes: 120 } as const;

const UPDATE_SCOPE = 'settings.update';
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,120}$/;
// Retention agrees with the m4-contract §10 proposal; sweeping expired records arrives with M4 cleanup.
const RECORD_TTL_MS = 30 * 86400000;

export interface AdminSettingsView {
  shippingFeeVnd: number;
  bankDeadlineMinutes: number;
  bankName: string | null;
  bankBin: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  version: number;
}

export interface PublicSettingsView {
  shippingFeeVnd: number;
  bankDeadlineMinutes: number;
}

// Normalized configuration exactly as it should be stored and hashed.
interface SettingsConfig {
  shippingFeeVnd: number;
  bankDeadlineMinutes: number;
  bankName: string | null;
  bankBin: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
}

const textOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const digitOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

function isSettingsView(value: Prisma.JsonValue): value is AdminSettingsView & Prisma.JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const view = value as Record<string, unknown>;
  const bankField = (field: unknown) => field === null || typeof field === 'string';
  return typeof view['shippingFeeVnd'] === 'number' && typeof view['bankDeadlineMinutes'] === 'number'
    && typeof view['version'] === 'number' && bankField(view['bankName']) && bankField(view['bankBin'])
    && bankField(view['bankAccountNumber']) && bankField(view['bankAccountName']);
}

@Injectable()
export class SettingsService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  // Read-only admin view; saving goes through update() below (version + idempotency in one transaction).
  async adminView(): Promise<AdminSettingsView> {
    const row = await this.db.shopSettings.findUnique({ where: { id: 'default' } });
    if (!row) return { ...DEFAULTS, bankName: null, bankBin: null, bankAccountNumber: null, bankAccountName: null, version: 0 };
    return this.viewOf(row);
  }

  // Explicit allowlist: public callers learn the fee and the bank deadline only. Database errors
  // propagate to the shared error handling instead of being masked as configuration.
  async publicView(): Promise<PublicSettingsView> {
    const row = await this.db.shopSettings.findUnique({ where: { id: 'default' } });
    return { shippingFeeVnd: row?.shippingFeeVnd ?? DEFAULTS.shippingFeeVnd,
      bankDeadlineMinutes: row?.bankDeadlineMinutes ?? DEFAULTS.bankDeadlineMinutes };
  }

  /**
   * Save configuration (M4.1.2), m4-contract §7: scope is server-owned, the identity is the signed-in
   * admin, and the hash covers the normalized content plus the frozen expectedVersion. The command
   * record commits together with the settings row, so a replay is detected before any version check
   * and a concurrent same-key write resolves as a clean replay or a 409 — never a raw unique error.
   */
  async update(actorId: string, key: string | undefined, dto: UpdateSettingsDto): Promise<AdminSettingsView> {
    if (!key || !KEY_PATTERN.test(key)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Cần Idempotency-Key hợp lệ.' });
    }
    const identity = `admin:${actorId}`;
    const normalized = this.normalizeConfig(dto);
    const requestHash = createHash('sha256').update(JSON.stringify([UPDATE_SCOPE, normalized, dto.expectedVersion])).digest('hex');
    try {
      return await this.db.$transaction(async (tx) => {
        const recorded = await this.command(tx, identity, key);
        if (recorded) return this.commandResult(recorded, requestHash);
        // The row lock serializes concurrent saves; the very first save races on the id="default" PK
        // instead, because FOR UPDATE cannot lock a row that does not exist yet.
        await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "shop_settings" WHERE "id" = 'default' FOR UPDATE`;
        const recordedNow = await this.command(tx, identity, key);
        if (recordedNow) return this.commandResult(recordedNow, requestHash);
        const row = await tx.shopSettings.findUnique({ where: { id: 'default' } });
        if (row && row.version !== dto.expectedVersion) {
          conflict('Cài đặt đã thay đổi. Hãy tải lại cấu hình rồi thử lại.');
        }
        if (!row && dto.expectedVersion !== 0) {
          conflict('Cấu hình chưa từng được lưu. Hãy tải lại cấu hình rồi thử lại.');
        }
        const saved = row
          ? await tx.shopSettings.update({ where: { id: 'default' }, data: { ...normalized, version: { increment: 1 } } })
          : await tx.shopSettings.create({ data: { id: 'default', ...normalized, version: 1 } });
        const view = this.viewOf(saved);
        // The stored response is the same view the client receives, serialized as loose JSON.
        await tx.idempotencyRecord.create({ data: { scope: UPDATE_SCOPE, identity, key, requestHash, resourceId: 'default',
          response: view as unknown as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + RECORD_TTL_MS) } });
        return view;
      });
    } catch (error) {
      // A unique violation here means the competing transaction already committed (Postgres resolves
      // in-flight inserts first), so the outcome is always a replay or a conflict, not raw P2002/500.
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002') {
        const recorded = await this.db.idempotencyRecord.findUnique({ where: { scope_identity_key: { scope: UPDATE_SCOPE, identity, key } } });
        if (recorded) return this.commandResult(recorded, requestHash);
        const committed = await this.db.shopSettings.findUnique({ where: { id: 'default' } });
        if (committed) conflict('Cài đặt đã thay đổi. Hãy tải lại cấu hình rồi thử lại.');
      }
      databaseError(error);
    }
  }

  // Blank bank fields become null by trimming; the group is complete or absent, never partial
  // (m4-contract §1: no default bank account). The account number keeps its leading zeros.
  private normalizeConfig(dto: UpdateSettingsDto): SettingsConfig {
    const bank = { bankName: textOrNull(dto.bankName), bankBin: digitOrNull(dto.bankBin),
      bankAccountNumber: digitOrNull(dto.bankAccountNumber), bankAccountName: textOrNull(dto.bankAccountName) };
    const missing = Object.entries(bank).filter(([, value]) => value === null).map(([field]) => field);
    if (missing.length > 0 && missing.length < 4) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Nhập đủ 4 trường thông tin ngân hàng hoặc bỏ trống toàn bộ.',
        fieldErrors: missing.map((field) => ({ field, message: 'Nhập đủ 4 trường thông tin ngân hàng hoặc bỏ trống toàn bộ.' })) });
    }
    return { shippingFeeVnd: dto.shippingFeeVnd, bankDeadlineMinutes: dto.bankDeadlineMinutes, ...bank };
  }

  private command(tx: Prisma.TransactionClient, identity: string, key: string) {
    return tx.idempotencyRecord.findUnique({ where: { scope_identity_key: { scope: UPDATE_SCOPE, identity, key } } });
  }

  private async commandResult(record: IdempotencyRecord, requestHash: string): Promise<AdminSettingsView> {
    if (record.requestHash !== requestHash) conflict('Mã thao tác đã dùng với nội dung khác.');
    // The response column only ever holds what this service wrote; degrade to a fresh view instead
    // of trusting a malformed record.
    return isSettingsView(record.response) ? record.response : this.adminView();
  }

  private viewOf(row: ShopSettings): AdminSettingsView {
    return { shippingFeeVnd: row.shippingFeeVnd, bankDeadlineMinutes: row.bankDeadlineMinutes, bankName: row.bankName,
      bankBin: row.bankBin, bankAccountNumber: row.bankAccountNumber, bankAccountName: row.bankAccountName, version: row.version };
  }
}

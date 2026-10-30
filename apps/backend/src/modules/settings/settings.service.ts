import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// Safe built-in defaults used only when no shop_settings row exists; never persisted by reads.
const DEFAULTS = { shippingFeeVnd: 30000, bankDeadlineMinutes: 120 } as const;

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

@Injectable()
export class SettingsService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  // Read-only admin view (M4.1.1); PATCH/expectedVersion handling arrives in M4.1.2.
  async adminView(): Promise<AdminSettingsView> {
    const row = await this.db.shopSettings.findUnique({ where: { id: 'default' } });
    if (!row) return { ...DEFAULTS, bankName: null, bankBin: null, bankAccountNumber: null, bankAccountName: null, version: 0 };
    return { shippingFeeVnd: row.shippingFeeVnd, bankDeadlineMinutes: row.bankDeadlineMinutes, bankName: row.bankName,
      bankBin: row.bankBin, bankAccountNumber: row.bankAccountNumber, bankAccountName: row.bankAccountName, version: row.version };
  }

  // Explicit allowlist: public callers learn the fee and the bank deadline only. Database errors
  // propagate to the shared error handling instead of being masked as configuration.
  async publicView(): Promise<PublicSettingsView> {
    const row = await this.db.shopSettings.findUnique({ where: { id: 'default' } });
    return { shippingFeeVnd: row?.shippingFeeVnd ?? DEFAULTS.shippingFeeVnd,
      bankDeadlineMinutes: row?.bankDeadlineMinutes ?? DEFAULTS.bankDeadlineMinutes };
  }
}

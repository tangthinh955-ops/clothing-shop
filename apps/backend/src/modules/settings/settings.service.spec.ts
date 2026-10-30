import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from './settings.service.js';

const savedRow = { id: 'default', shippingFeeVnd: 25000, bankDeadlineMinutes: 90, bankName: 'Ngân hàng thử', bankBin: '970422',
  bankAccountNumber: '0123456789', bankAccountName: 'CONG TY THU', version: 2 };

// The mock only carries findUnique: any write attempt inside a GET view would crash the call and fail the test.
function serviceWith(findUnique: () => Promise<unknown>) {
  const db = { shopSettings: { findUnique: vi.fn(findUnique) } };
  const service = new SettingsService(db as unknown as PrismaService);
  return { service, findUnique: db.shopSettings.findUnique };
}

describe('SettingsService read-only views', () => {
  it('returns safe defaults when no row exists and never writes to the database', async () => {
    const { service, findUnique } = serviceWith(async () => null);
    await expect(service.adminView()).resolves.toEqual({ shippingFeeVnd: 30000, bankDeadlineMinutes: 120,
      bankName: null, bankBin: null, bankAccountNumber: null, bankAccountName: null, version: 0 });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'default' } });
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('returns the saved row through the admin view', async () => {
    const { service } = serviceWith(async () => savedRow);
    await expect(service.adminView()).resolves.toEqual({ shippingFeeVnd: 25000, bankDeadlineMinutes: 90, bankName: 'Ngân hàng thử',
      bankBin: '970422', bankAccountNumber: '0123456789', bankAccountName: 'CONG TY THU', version: 2 });
  });

  it('public view allowlists only the fee and the bank deadline', async () => {
    const { service } = serviceWith(async () => savedRow);
    await expect(service.publicView()).resolves.toEqual({ shippingFeeVnd: 25000, bankDeadlineMinutes: 90 });
  });

  it('propagates database errors instead of serving defaults', async () => {
    const { service } = serviceWith(async () => { throw new Error('database unavailable'); });
    await expect(service.adminView()).rejects.toThrow('database unavailable');
    await expect(service.publicView()).rejects.toThrow('database unavailable');
  });
});

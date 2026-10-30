import { afterEach, describe, expect, it, vi } from 'vitest';
import * as client from '../../../../shared/api/client';
import { settingsApi } from './settings.api';

const settings = { shippingFeeVnd: 30000, bankDeadlineMinutes: 120, bankName: null, bankBin: null,
  bankAccountNumber: null, bankAccountName: null, version: 1 };
afterEach(() => vi.restoreAllMocks());

describe('settings response boundary', () => {
  it.each([{}, null, { ...settings, version: '1' }, { ...settings, bankName: undefined },
    { ...settings, bankBin: '970422' },
    { ...settings, bankName: 'Bank', bankBin: 'oops', bankAccountName: 'SHOP', bankAccountNumber: '00123' }])(
    'rejects malformed successful JSON (%j)', async (response) => {
      vi.spyOn(client, 'request').mockResolvedValue(response);
      await expect(settingsApi.adminView()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
      await expect(settingsApi.update({ ...settings, bankName: '', bankBin: '', bankAccountNumber: '',
        bankAccountName: '', expectedVersion: 0 }, 'settings-response-key')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    });

  it('preserves valid nullable fields and leading-zero account numbers', async () => {
    const request = vi.spyOn(client, 'request').mockResolvedValueOnce(settings)
      .mockResolvedValueOnce({ ...settings, bankName: 'Bank', bankBin: '970422', bankAccountNumber: '00123', bankAccountName: 'SHOP' });
    await expect(settingsApi.adminView()).resolves.toEqual(settings);
    const input = { shippingFeeVnd: 30000, bankDeadlineMinutes: 120, bankName: 'Bank', bankBin: '970422',
      bankAccountNumber: '00123', bankAccountName: 'SHOP', expectedVersion: 0 };
    await expect(settingsApi.update(input, 'settings-response-key')).resolves.toMatchObject({ bankAccountNumber: '00123' });
    expect(request).toHaveBeenLastCalledWith('/admin/settings', {
      method: 'PATCH', body: input, idempotencyKey: 'settings-response-key',
    });
  });
});

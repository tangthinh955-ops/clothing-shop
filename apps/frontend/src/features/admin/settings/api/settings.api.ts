import { ApiError, request } from '../../../../shared/api/client';

export interface AdminSettings {
  shippingFeeVnd: number;
  bankDeadlineMinutes: number;
  bankName: string | null;
  bankBin: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  version: number;
}

// The PATCH payload mirrors UpdateSettingsDto: the server does not coerce numbers, so the form
// sends real numbers while bank fields stay strings; empty strings are normalized to null there.
export interface SettingsUpdateInput {
  shippingFeeVnd: number;
  bankDeadlineMinutes: number;
  bankName: string;
  bankBin: string;
  bankAccountNumber: string;
  bankAccountName: string;
  expectedVersion: number;
}

export const settingsKey = ['admin-settings'] as const;

function isAdminSettings(value: unknown): value is AdminSettings {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const view = value as Record<string, unknown>;
    const integer = (input: unknown, min: number, max: number) =>
      typeof input === 'number' && Number.isSafeInteger(input) && input >= min && input <= max;
    const bankFields = ['bankName', 'bankBin', 'bankAccountNumber', 'bankAccountName'] as const;
    const bankEmpty = bankFields.every((field) => view[field] === null);
    const name = (input: unknown) => typeof input === 'string' && input.trim().length > 0 && input.length <= 120;
    const bankComplete = name(view['bankName']) && name(view['bankAccountName'])
      && typeof view['bankBin'] === 'string' && /^\d{6}$/.test(view['bankBin'])
      && typeof view['bankAccountNumber'] === 'string' && /^\d{1,32}$/.test(view['bankAccountNumber']);
    return integer(view['shippingFeeVnd'], 0, 100000000) && integer(view['bankDeadlineMinutes'], 15, 2880)
      && integer(view['version'], 0, Number.MAX_SAFE_INTEGER)
      && (bankEmpty || bankComplete);
  }
  return false;
}

function readSettings(value: unknown): AdminSettings {
  if (isAdminSettings(value)) return value;
  throw new ApiError('INVALID_RESPONSE', 'Chưa đọc được cấu hình máy chủ trả về. Vui lòng tải lại hoặc gửi lại thao tác cũ.', 200);
}

export const settingsApi = {
  adminView: async () => readSettings(await request<unknown>('/admin/settings')),
  // Idempotency-Key is generated per deliberate save by the form and travels next to the body.
  update: async (input: SettingsUpdateInput, idempotencyKey: string) =>
    readSettings(await request<unknown>('/admin/settings', { method: 'PATCH', body: input, idempotencyKey })),
};

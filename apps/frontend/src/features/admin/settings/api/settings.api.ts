import { request } from '../../../../shared/api/client';

export interface AdminSettings {
  shippingFeeVnd: number;
  bankDeadlineMinutes: number;
  bankName: string | null;
  bankBin: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  version: number;
}

export const settingsKey = ['admin-settings'] as const;

export const settingsApi = {
  // Read-only for M4.1.1; the public shop-settings endpoint stays unused here so the admin page
  // always proves the ADMIN-guarded backend path.
  adminView: () => request<AdminSettings>('/admin/settings'),
};

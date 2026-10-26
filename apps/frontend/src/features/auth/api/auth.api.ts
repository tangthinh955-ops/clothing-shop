import { ApiError, request } from '../../../shared/api/client';

export interface User { id: string; email: string; name: string; role: 'CUSTOMER' | 'ADMIN'; emailVerified: boolean }
export const authApi = {
  async me(): Promise<User | null> {
    try { return await request<User>('/me'); }
    catch (error: unknown) { if (error instanceof ApiError && error.status === 401) return null; throw error; }
  },
  login: (email: string, password: string) => request<User>('/auth/login', { method: 'POST', body: { email, password } }),
  register: (name: string, email: string, password: string) => request<{ message: string }>('/auth/register', { method: 'POST', body: { name, email, password } }),
  forgot: (email: string) => request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email } }),
  reset: (token: string, password: string) => request<{ message: string }>('/auth/reset-password', { method: 'POST', body: { token, password } }),
  verify: (token: string) => request<{ message: string }>('/auth/verify-email', { method: 'POST', body: { token } }),
  resend: (email: string) => request<{ message: string }>('/auth/resend-verification', { method: 'POST', body: { email } }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  profile: (name: string) => request<User>('/me', { method: 'PATCH', body: { name } }),
};

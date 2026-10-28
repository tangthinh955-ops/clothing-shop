import { describe, expect, it } from 'vitest';
import type { MailService } from '../mail/mail.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

const email = 'customer@example.test';
const password = 'unit-test-password-123!';

// Only the Prisma calls used by register/requestToken.
const tx = {
  user: { create: async () => ({ id: 'user-1' }) },
  authToken: { create: async () => ({}), updateMany: async () => ({ count: 0 }) },
};
const existingUser = {
  id: 'user-1', email, name: 'Khách', role: 'CUSTOMER', emailVerifiedAt: null, disabledAt: null, sessionVersion: 0,
};
const db = {
  $transaction: async (work: (client: typeof tx) => Promise<void>) => work(tx),
  user: { findUnique: async () => existingUser },
};
// A mail provider that never answers: the HTTP response must not wait for it.
const mail = { sendAuth: () => new Promise<void>(() => undefined) };
const service = new AuthService(db as unknown as PrismaService, mail as unknown as MailService);

function finishesWithin(milliseconds: number, work: Promise<void>): Promise<boolean> {
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), milliseconds));
  return Promise.race([work.then(() => true), timeout]);
}

describe('AuthService mail delivery', () => {
  it('does not make registration wait for the mail provider', async () => {
    expect(await finishesWithin(1000, service.register({ email, name: 'Khách', password }))).toBe(true);
  });

  it('does not make password reset requests wait for the mail provider', async () => {
    expect(await finishesWithin(1000, service.requestToken(email, 'RESET_PASSWORD'))).toBe(true);
  });
});

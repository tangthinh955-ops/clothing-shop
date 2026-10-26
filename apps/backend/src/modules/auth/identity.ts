import type { Prisma } from '../../generated/prisma/client.js';

export const identitySelect = {
  id: true, email: true, name: true, role: true, emailVerifiedAt: true, disabledAt: true, sessionVersion: true,
} as const satisfies Prisma.UserSelect;

export type UserIdentity = Prisma.UserGetPayload<{ select: typeof identitySelect }>;
export interface SafeUser { id: string; email: string; name: string; role: 'CUSTOMER' | 'ADMIN'; emailVerified: boolean }
export function safeUser(user: UserIdentity): SafeUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: user.emailVerifiedAt !== null };
}

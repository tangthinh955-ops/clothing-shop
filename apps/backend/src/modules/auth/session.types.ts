import type { Request } from 'express';
import type { UserIdentity } from './identity.js';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    sessionVersion?: number;
    csrfToken?: string;
    authenticatedAt?: number;
    lastSeenAt?: number;
  }
}

export interface AuthRequest extends Request { currentUser?: UserIdentity }

export function saveSession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => request.session.save((error: unknown) => error ? reject(error) : resolve()));
}
export function regenerateSession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => request.session.regenerate((error: unknown) => error ? reject(error) : resolve()));
}
export function destroySession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => request.session.destroy((error: unknown) => error ? reject(error) : resolve()));
}

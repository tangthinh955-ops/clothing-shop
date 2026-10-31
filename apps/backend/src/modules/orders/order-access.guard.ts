import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { orderAccessNotFound } from './order-access.service.js';

/** Everything the guard needs to check is the token envelope: 192-bit base64url (order-command.ts). */
export const ORDER_ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

declare module 'express-serve-static-core' {
  interface Request { orderToken?: string }
}

/**
 * Route gate for GET /orders/:code (m4-contract §5): probes without a well-formed header token are
 * rejected with the uniform 404 before touching the database. Hash verification against the order —
 * i.e. whether THIS token belongs to THAT code — stays in OrderAccessService.
 */
@Injectable()
export class OrderAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.get('X-Order-Token');
    if (!token || !ORDER_ACCESS_TOKEN_PATTERN.test(token)) throw orderAccessNotFound();
    request.orderToken = token;
    return true;
  }
}

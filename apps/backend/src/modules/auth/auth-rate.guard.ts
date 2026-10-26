import { Injectable, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

@Injectable()
export class AuthRateGuard extends ThrottlerGuard {
  protected override generateKey(context: ExecutionContext, tracker: string, name: string): string {
    const request = context.switchToHttp().getRequest<Request>();
    const body: unknown = request.body;
    const email = body && typeof body === 'object' && 'email' in body && typeof body.email === 'string'
      ? body.email.trim().toLowerCase().slice(0, 254) : 'anonymous';
    return super.generateKey(context, name === 'identity' ? `${tracker}:${email}` : tracker, name);
  }
}

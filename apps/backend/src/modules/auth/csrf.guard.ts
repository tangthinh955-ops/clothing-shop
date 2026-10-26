import { Inject, Injectable, ForbiddenException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { APP_CONFIG, type AppConfig } from '../../config/environment.js';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    const token = req.get('X-CSRF-Token');
    const expected = req.session?.csrfToken;
    if (req.get('Origin') !== this.config.appOrigin || !token || !expected || token.length > 128) throw this.invalid();
    const a = Buffer.from(token); const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw this.invalid();
    return true;
  }
  private invalid(): ForbiddenException {
    return new ForbiddenException({ code: 'CSRF_INVALID', message: 'Phiên gửi biểu mẫu chưa hợp lệ. Vui lòng thử lại.' });
  }
}

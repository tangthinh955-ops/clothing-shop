import { Inject, Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { identitySelect } from './identity.js';
import { destroySession, type AuthRequest } from './session.types.js';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const session = req.session;
    const user = session?.userId ? await this.db.user.findUnique({ where: { id: session.userId }, select: identitySelect }) : null;
    const now = Date.now();
    const absolute = user?.role === 'ADMIN' ? 12 * 3600000 : 7 * 86400000;
    const idle = user?.role === 'ADMIN' ? 30 * 60000 : 86400000;
    if (!user || user.disabledAt || session.sessionVersion !== user.sessionVersion || !session.authenticatedAt || !session.lastSeenAt
      || now - session.authenticatedAt >= absolute || now - session.lastSeenAt >= idle) {
      if (session?.userId) await destroySession(req);
      throw new UnauthorizedException({ code: 'AUTH_REQUIRED', message: 'Vui lòng đăng nhập để tiếp tục.' });
    }
    req.currentUser = user;
    session.lastSeenAt = now;
    session.cookie.maxAge = idle;
    return true;
  }
}

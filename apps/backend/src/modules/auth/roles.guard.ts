import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../../generated/prisma/enums.js';
import type { AuthRequest } from './session.types.js';
import { ROLES_KEY } from './decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    const user = context.switchToHttp().getRequest<AuthRequest>().currentUser;
    if (roles && (!user || !roles.includes(user.role))) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bạn không có quyền thực hiện thao tác này.' });
    }
    return true;
  }
}

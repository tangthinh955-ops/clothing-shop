import { createParamDecorator, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../../generated/prisma/enums.js';
import type { AuthRequest } from './session.types.js';

export const Roles = (...roles: Role[]) => SetMetadata('auth:roles', roles);
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const user = context.switchToHttp().getRequest<AuthRequest>().currentUser;
  if (!user) throw new UnauthorizedException();
  return user;
});

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>('auth:roles', [context.getHandler(), context.getClass()]);
    const user = context.switchToHttp().getRequest<AuthRequest>().currentUser;
    if (roles && (!user || !roles.includes(user.role))) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bạn không có quyền thực hiện thao tác này.' });
    }
    return true;
  }
}

import { createParamDecorator, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { AuthRequest } from '../session.types.js';

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const user = context.switchToHttp().getRequest<AuthRequest>().currentUser;
  if (!user) throw new UnauthorizedException();
  return user;
});

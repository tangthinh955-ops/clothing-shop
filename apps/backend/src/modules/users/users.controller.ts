import { Body, Controller, Get, Inject, Patch, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { safeUser, type UserIdentity } from '../auth/identity.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { ProfileDto } from './dto/profile.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('account')
@UseGuards(SessionGuard)
@Controller('me')
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}
  @Get() me(@CurrentUser() user: UserIdentity) { return safeUser(user); }
  @Patch() update(@CurrentUser() user: UserIdentity, @Body() dto: ProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }
}

@ApiTags('admin')
@UseGuards(SessionGuard, RolesGuard) @Roles('ADMIN')
@Controller('admin/access')
export class AdminAccessController {
  @Get() access() { return { allowed: true }; }
}

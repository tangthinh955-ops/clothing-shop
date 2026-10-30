import { Body, Controller, Get, Headers, Inject, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { UserIdentity } from '../auth/identity.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { SettingsService } from './settings.service.js';

@Controller('admin/settings')
@UseGuards(SessionGuard, RolesGuard)
@Roles('ADMIN')
export class AdminSettingsController {
  constructor(@Inject(SettingsService) private readonly settings: SettingsService) {}

  @Get()
  show() {
    // Reads inherit the global Cache-Control: no-store from application.ts, so stale configuration is
    // never served from a cache.
    return this.settings.adminView();
  }

  @Patch()
  update(@CurrentUser() user: UserIdentity, @Headers('idempotency-key') key: string | undefined,
    @Body() dto: UpdateSettingsDto) {
    // The controller stays a thin HTTP boundary: the actor comes from the session (never the client)
    // and all validation, versioning and idempotency live in the service.
    return this.settings.update(user.id, key, dto);
  }
}

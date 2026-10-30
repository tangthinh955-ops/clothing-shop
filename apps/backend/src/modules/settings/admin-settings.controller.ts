import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
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
}

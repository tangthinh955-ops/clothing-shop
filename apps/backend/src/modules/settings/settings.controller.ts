import { Controller, Get, Inject } from '@nestjs/common';
import { SettingsService } from './settings.service.js';

@Controller('shop-settings')
export class PublicSettingsController {
  constructor(@Inject(SettingsService) private readonly settings: SettingsService) {}

  // No session required; the service allowlists the two public fields and the global no-store
  // keeps configuration from being cached.
  @Get('public')
  show() {
    return this.settings.publicView();
  }
}

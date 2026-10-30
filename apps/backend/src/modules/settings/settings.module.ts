import { Module } from '@nestjs/common';
import { AdminSettingsController } from './admin-settings.controller.js';
import { PublicSettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

@Module({
  providers: [SettingsService],
  controllers: [AdminSettingsController, PublicSettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}

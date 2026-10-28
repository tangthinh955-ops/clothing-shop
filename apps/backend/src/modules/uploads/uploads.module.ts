import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminUploadsController } from './admin-uploads.controller.js';
import { PublicMediaController } from './media.controller.js';
import { UploadsService } from './uploads.service.js';

@Module({
  imports: [AuthModule],
  providers: [UploadsService],
  controllers: [AdminUploadsController, PublicMediaController],
})
export class UploadsModule {}

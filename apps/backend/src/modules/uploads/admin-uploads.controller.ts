import { Controller, Get, Inject, Param, ParseUUIDPipe, Post, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { UserIdentity } from '../auth/identity.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { UploadsService, type ImageFile } from './uploads.service.js';

@Controller('admin/uploads/images')
@UseGuards(SessionGuard, RolesGuard)
@Roles('ADMIN')
export class AdminUploadsController {
  constructor(@Inject(UploadsService) private readonly uploads: UploadsService) {}

  @Post()
  @Throttle({ identity: { limit: 10, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 } }))
  upload(@CurrentUser() user: UserIdentity, @UploadedFile() file: ImageFile | undefined) {
    return this.uploads.upload(user.id, file);
  }

  @Get(':id')
  async image(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UserIdentity) {
    return new StreamableFile(await this.uploads.read(id, user.id), { type: 'image/webp' });
  }
}

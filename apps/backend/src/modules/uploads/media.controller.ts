import { Controller, Get, Inject, Param, ParseUUIDPipe, StreamableFile } from '@nestjs/common';
import { UploadsService } from './uploads.service.js';

@Controller('media')
export class PublicMediaController {
  constructor(@Inject(UploadsService) private readonly uploads: UploadsService) {}

  @Get(':id')
  async image(@Param('id', ParseUUIDPipe) id: string) {
    return new StreamableFile(await this.uploads.read(id), { type: 'image/webp' });
  }
}

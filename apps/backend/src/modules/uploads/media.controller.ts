import { Controller, Get, Inject, Param, ParseUUIDPipe, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { UploadsService } from './uploads.service.js';

@Controller('media')
export class PublicMediaController {
  constructor(@Inject(UploadsService) private readonly uploads: UploadsService) {}

  // Only images of published products reach this response, and an asset id's bytes never change, so a day of
  // browser caching is safe; errors keep the global no-store.
  @Get(':id')
  async image(@Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) response: Response) {
    const bytes = await this.uploads.read(id);
    response.setHeader('Cache-Control', 'public, max-age=86400');
    return new StreamableFile(bytes, { type: 'image/webp' });
  }
}

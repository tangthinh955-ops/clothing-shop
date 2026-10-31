import { Controller, Get, Header, Inject, Param } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/environment.js';
import { ProductsService } from './products.service.js';

@Controller('share/products')
export class SharePreviewController {
  constructor(
    @Inject(ProductsService) private readonly products: ProductsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Public, read-only HTML preview for link sharing; OG tags are absolute against APP_ORIGIN. */
  @Get(':slug')
  @Header('Content-Type', 'text/html; charset=utf-8')
  preview(@Param('slug') slug: string) {
    return this.products.sharePreview(slug, this.config.appOrigin);
  }
}

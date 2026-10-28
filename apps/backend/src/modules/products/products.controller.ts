import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ProductQuery } from './dto/product.dto.js';
import { ProductsService } from './products.service.js';

@Controller('products')
export class CatalogController {
  constructor(@Inject(ProductsService) private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: ProductQuery) {
    return this.products.list(query);
  }

  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.products.detail(slug);
  }
}

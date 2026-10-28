import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { VersionDto } from '../../common/dto/request.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { UserIdentity } from '../auth/identity.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { AdminProductQuery, ImagesDto, ProductDto, ProductUpdateDto } from './dto/product.dto.js';
import { ProductsService } from './products.service.js';

@Controller('admin/products')
@UseGuards(SessionGuard, RolesGuard)
@Roles('ADMIN')
export class AdminProductsController {
  constructor(@Inject(ProductsService) private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: AdminProductQuery) {
    return this.products.list(query, true);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.detail(id, true);
  }

  @Post()
  create(@Body() dto: ProductDto) {
    return this.products.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ProductUpdateDto) {
    return this.products.update(id, dto);
  }

  @Post(':id/publish')
  publish(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VersionDto) {
    return this.products.state(id, dto.expectedVersion, 'PUBLISHED');
  }

  @Post(':id/hide')
  hide(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VersionDto) {
    return this.products.state(id, dto.expectedVersion, 'HIDDEN');
  }

  @Put(':id/images')
  images(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UserIdentity, @Body() dto: ImagesDto) {
    return this.products.images(id, user.id, dto);
  }
}

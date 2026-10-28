import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { CategoriesService } from './categories.service.js';
import { CategoryDto, CategoryUpdateDto } from './dto/category.dto.js';

@Controller('admin/categories')
@UseGuards(SessionGuard, RolesGuard)
@Roles('ADMIN')
export class AdminCategoriesController {
  constructor(@Inject(CategoriesService) private readonly categories: CategoriesService) {}

  @Get()
  list() {
    return this.categories.listAdmin();
  }

  @Post()
  create(@Body() dto: CategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CategoryUpdateDto) {
    return this.categories.update(id, dto);
  }
}

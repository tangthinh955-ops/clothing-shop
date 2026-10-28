import { Controller, Get, Inject } from '@nestjs/common';
import { CategoriesService } from './categories.service.js';

@Controller('categories')
export class PublicCategoriesController {
  constructor(@Inject(CategoriesService) private readonly categories: CategoriesService) {}

  @Get()
  list() {
    return this.categories.listPublic();
  }
}

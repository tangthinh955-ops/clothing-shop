import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminCategoriesController } from './admin-categories.controller.js';
import { PublicCategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PublicCategoriesController, AdminCategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}

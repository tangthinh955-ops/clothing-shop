import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminProductsController } from './admin-products.controller.js';
import { CatalogController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  imports: [AuthModule],
  providers: [ProductsService],
  controllers: [CatalogController, AdminProductsController],
})
export class ProductsModule {}

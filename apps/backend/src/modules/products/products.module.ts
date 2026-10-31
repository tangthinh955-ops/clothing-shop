import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminProductsController } from './admin-products.controller.js';
import { CartProductsController } from './cart-products.controller.js';
import { CartProductsService } from './cart-products.service.js';
import { CatalogController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  imports: [AuthModule],
  providers: [ProductsService, CartProductsService],
  controllers: [CatalogController, AdminProductsController, CartProductsController],
})
export class ProductsModule {}

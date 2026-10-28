import { Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import type { AppConfig } from './config/environment.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AuthRateGuard } from './modules/auth/auth-rate.guard.js';
import { CsrfGuard } from './modules/auth/csrf.guard.js';
import { HealthController } from './common/health.controller.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { UploadsModule } from './modules/uploads/uploads.module.js';

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    return { module: AppModule,
      imports: [ConfigModule.forRoot(config), PrismaModule, AuthModule, UsersModule, CategoriesModule, ProductsModule, InventoryModule, UploadsModule,
        ThrottlerModule.forRoot([{ name: 'ip', ttl: 60000, limit: 120 }, { name: 'identity', ttl: 60000, limit: 120 }])],
      controllers: [HealthController], providers: [{ provide: APP_GUARD, useClass: AuthRateGuard }, { provide: APP_GUARD, useClass: CsrfGuard }] };
  }
}

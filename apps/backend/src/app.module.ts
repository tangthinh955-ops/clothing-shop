import { Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import type { AppConfig } from './config/environment.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AuthRateGuard } from './modules/auth/auth-rate.guard.js';
import { CsrfGuard } from './modules/auth/csrf.guard.js';
import { HealthController } from './common/health.controller.js';

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    return { module: AppModule,
      imports: [ConfigModule.forRoot(config), PrismaModule, AuthModule, UsersModule,
        ThrottlerModule.forRoot([{ name: 'ip', ttl: 60000, limit: 120 }, { name: 'identity', ttl: 60000, limit: 120 }])],
      controllers: [HealthController], providers: [{ provide: APP_GUARD, useClass: AuthRateGuard }, { provide: APP_GUARD, useClass: CsrfGuard }] };
  }
}

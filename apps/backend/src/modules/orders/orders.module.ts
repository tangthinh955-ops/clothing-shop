import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';

@Module({
  imports: [SettingsModule],
  providers: [CheckoutService],
  controllers: [CheckoutController],
  exports: [CheckoutService],
})
export class OrdersModule {}

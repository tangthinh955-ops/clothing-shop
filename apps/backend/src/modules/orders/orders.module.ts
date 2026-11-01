import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';
import { OrderAccessGuard } from './order-access.guard.js';
import { OrderAccessService } from './order-access.service.js';
import { OrderLookupService } from './order-lookup.service.js';
import { OrdersController } from './orders.controller.js';
import { OrderCreationService } from './order-creation.service.js';

@Module({
  imports: [SettingsModule, InventoryModule],
  providers: [CheckoutService, OrderCreationService, OrderAccessService, OrderLookupService, OrderAccessGuard],
  controllers: [CheckoutController, OrdersController],
  exports: [CheckoutService, OrderCreationService],
})
export class OrdersModule {}

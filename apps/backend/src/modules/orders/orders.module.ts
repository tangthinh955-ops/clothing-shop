import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { AdminOrdersController } from './admin-orders.controller.js';
import { AdminOrdersService } from './admin-orders.service.js';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';
import { OrderAccessGuard } from './order-access.guard.js';
import { OrderAccessService } from './order-access.service.js';
import { OrderLookupService } from './order-lookup.service.js';
import { OrdersController } from './orders.controller.js';
import { OrderCreationService } from './order-creation.service.js';

@Module({
  imports: [SettingsModule, InventoryModule],
  providers: [CheckoutService, OrderCreationService, OrderAccessService, OrderLookupService, OrderAccessGuard, AdminOrdersService],
  controllers: [CheckoutController, OrdersController, AdminOrdersController],
  exports: [CheckoutService, OrderCreationService],
})
export class OrdersModule {}

import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module.js';
import { MailModule } from '../mail/mail.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { AdminOrderNotesService } from './admin-order-notes.service.js';
import { AdminOrderTransitionsService } from './admin-order-transitions.service.js';
import { AdminOrdersController } from './admin-orders.controller.js';
import { AdminOrdersService } from './admin-orders.service.js';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';
import { OrderAccessGuard } from './order-access.guard.js';
import { OrderAccessService } from './order-access.service.js';
import { OrderCancellationService } from './order-cancellation.service.js';
import { OrderLookupService } from './order-lookup.service.js';
import { OrderNotificationWorker } from './order-notification-worker.service.js';
import { OrderNotificationsService } from './order-notifications.service.js';
import { OrderTransitionRunner } from './order-transition-runner.service.js';
import { OrdersController } from './orders.controller.js';
import { OrderCreationService } from './order-creation.service.js';

@Module({
  imports: [SettingsModule, InventoryModule, MailModule],
  providers: [CheckoutService, OrderCreationService, OrderNotificationsService, OrderNotificationWorker, OrderTransitionRunner, OrderCancellationService, OrderAccessService, OrderLookupService, OrderAccessGuard, AdminOrdersService, AdminOrderNotesService, AdminOrderTransitionsService],
  controllers: [CheckoutController, OrdersController, AdminOrdersController],
  exports: [CheckoutService, OrderCreationService],
})
export class OrdersModule {}

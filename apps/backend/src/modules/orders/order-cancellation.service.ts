import { Inject, Injectable } from '@nestjs/common';
import { InventoryOperationsService } from '../inventory/inventory-operations.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { INVALID_CODE_SHAPE, orderAccessNotFound } from './order-access.service.js';
import { lookupTokenHash } from './order-command.js';
import { OrderNotificationsService } from './order-notifications.service.js';
import { OrderTransitionRunner, type TransitionRule } from './order-transition-runner.service.js';

// From PACKING on the customer can only ask the shop (M4.4.4); refund obligations arrive with M4.6.2.
const CUSTOMER_CANCEL: TransitionRule = {
  from: ['PENDING', 'CONFIRMED'],
  to: 'CANCELLED',
};

export interface OrderCancellationView {
  code: string;
  status: string;
  version: number;
}

/** Customer cancellation through the private link (m4-contract §5): every wrong access answers the uniform 404. */
@Injectable()
export class OrderCancellationService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(OrderTransitionRunner) private readonly runner: OrderTransitionRunner,
    @Inject(InventoryOperationsService) private readonly inventory: InventoryOperationsService,
    @Inject(OrderNotificationsService) private readonly notifications: OrderNotificationsService,
  ) {}

  async cancel(input: { code: string; token: string; sessionId: string; key: string | undefined; expectedVersion: number; reason: string }): Promise<OrderCancellationView> {
    if (INVALID_CODE_SHAPE(input.code)) throw orderAccessNotFound();
    const tokenHash = lookupTokenHash(input.token);
    const found = await this.db.order.findUnique({ where: { code: input.code }, select: { id: true, lookupTokenHash: true } });
    // Checked before the replay path too: a link replaced by a lookup no longer answers anything.
    if (!found || found.lookupTokenHash !== tokenHash) throw orderAccessNotFound();
    const orderId = found.id;
    let applied = false;
    const { code, status, version } = await this.runner.run({
      rule: CUSTOMER_CANCEL, scope: 'orders.cancel', identity: `guest:${input.sessionId}`, actor: { type: 'GUEST' }, orderId,
      key: input.key, expectedVersion: input.expectedVersion, details: [input.reason], reason: input.reason,
      authorize: (order) => {
        if (order.lookupTokenHash !== tokenHash) throw orderAccessNotFound();
      },
      effect: async (tx, order) => {
        await this.inventory.release(tx, `order:${orderId}:release`, await this.runner.linesOf(tx, orderId), { type: 'GUEST' }, `Khách hủy đơn ${order.code}`);
        await this.notifications.enqueueOrderCancelled(tx, orderId);
        applied = true;
        return { cancelledAt: new Date(), cancelReason: input.reason };
      },
    });
    // A replay sends nothing; the delivery claim would stop a duplicate even if this ever ran twice.
    if (applied) void this.notifications.dispatchOrderCancelled(code);
    // The internal order id stays out of the customer's answer, as in every guest view.
    return { code, status, version };
  }
}

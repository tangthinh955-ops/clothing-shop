import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InventoryOperationsService } from '../inventory/inventory-operations.service.js';
import { OrderTransitionRunner, type TransitionRequest, type TransitionRule } from './order-transition-runner.service.js';

const MINUTE_MS = 60000;
// An admin device whose clock runs slightly ahead must not turn a delivery recorded just now into "the future".
const CLOCK_SKEW_MS = 5 * MINUTE_MS;

function refuseDeliveryTime(message: string): never {
  throw new BadRequestException({ code: 'VALIDATION_ERROR', message });
}

const CONFIRM: TransitionRule = {
  from: ['PENDING'],
  to: 'CONFIRMED',
  // m4-contract §2: a bank order needs full payment before the deadline, which arrives with M4.6.2.
  refuse: (order) => (order.method === 'COD' ? null : 'Đơn chuyển khoản chỉ xác nhận được khi đã nhận đủ tiền.'),
};

const PACK: TransitionRule = {
  from: ['CONFIRMED'],
  to: 'PACKING',
};

const SHIP: TransitionRule = {
  from: ['PACKING'],
  to: 'SHIPPED',
};

// COD stays uncollected here: delivery is not proof of money, which is reconciled in M4.6.4.
const DELIVER: TransitionRule = {
  from: ['SHIPPED'],
  to: 'DELIVERED',
};

// Refund obligations for money already collected arrive with the payment ledger in M4.6.2.
const CANCEL: TransitionRule = {
  from: ['PENDING', 'CONFIRMED', 'PACKING'],
  to: 'CANCELLED',
};

type AdminCommand = Pick<TransitionRequest, 'orderId' | 'key' | 'expectedVersion' | 'details' | 'reason' | 'effect'>;

/** The admin's steps on an order: what each one requires and what it does beyond changing the status. */
@Injectable()
export class AdminOrderTransitionsService {
  constructor(
    @Inject(OrderTransitionRunner) private readonly runner: OrderTransitionRunner,
    @Inject(InventoryOperationsService) private readonly inventory: InventoryOperationsService,
  ) {}

  confirm(actorId: string, orderId: string, key: string | undefined, expectedVersion: number) {
    return this.apply('confirm', CONFIRM, actorId, { orderId, key, expectedVersion });
  }

  pack(actorId: string, orderId: string, key: string | undefined, expectedVersion: number) {
    return this.apply('pack', PACK, actorId, { orderId, key, expectedVersion });
  }

  ship(actorId: string, orderId: string, key: string | undefined, expectedVersion: number, trackingNumber: string) {
    return this.apply('ship', SHIP, actorId, { orderId, key, expectedVersion, details: [trackingNumber], effect: async (tx, order) => {
      await this.inventory.ship(tx, `order:${orderId}:ship`, await this.runner.linesOf(tx, orderId), { type: 'ADMIN', id: actorId }, `Bàn giao đơn ${order.code}`);
      return { trackingNumber };
    } });
  }

  deliver(actorId: string, orderId: string, key: string | undefined, expectedVersion: number, deliveredAt: string) {
    const at = new Date(deliveredAt);
    return this.apply('deliver', DELIVER, actorId, { orderId, key, expectedVersion, details: [at.toISOString()], effect: async (tx) => {
      if (at.getTime() > Date.now() + CLOCK_SKEW_MS) refuseDeliveryTime('Thời điểm giao không được ở tương lai.');
      const handover = await tx.orderStatusHistory.findFirst({ where: { orderId, toStatus: 'SHIPPED' }, orderBy: { version: 'desc' }, select: { createdAt: true } });
      // The admin's field has no seconds, so the handover's own minute must still count as after it.
      if (handover && at.getTime() < Math.floor(handover.createdAt.getTime() / MINUTE_MS) * MINUTE_MS) {
        refuseDeliveryTime('Thời điểm giao không được trước lúc bàn giao.');
      }
      return { deliveredAt: at };
    } });
  }

  cancel(actorId: string, orderId: string, key: string | undefined, expectedVersion: number, reason: string) {
    return this.apply('cancel', CANCEL, actorId, { orderId, key, expectedVersion, details: [reason], reason, effect: async (tx, order) => {
      // The movement carries a fixed reason: what the admin typed belongs to the order, not the stock log.
      await this.inventory.release(tx, `order:${orderId}:release`, await this.runner.linesOf(tx, orderId), { type: 'ADMIN', id: actorId }, `Hủy đơn ${order.code}`);
      return { cancelledAt: new Date(), cancelReason: reason };
    } });
  }

  private apply(action: string, rule: TransitionRule, actorId: string, command: AdminCommand) {
    return this.runner.run({ ...command, rule, scope: `orders.transition:${action}`, identity: `admin:${actorId}`, actor: { type: 'ADMIN', id: actorId } });
  }
}

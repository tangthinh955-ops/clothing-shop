import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/environment.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { NotificationStatus } from '../../generated/prisma/enums.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const ORDER_CREATED_SHOP = 'order.created.shop';
const ORDER_CANCELLED_SHOP = 'order.cancelled.shop';
const MONEY = new Intl.NumberFormat('vi-VN');
const MINUTE_MS = 60000;
const MAX_ATTEMPTS = 5;
// The wait after attempt 1, 2, 3 and 4; the fifth attempt is the last.
const RETRY_DELAYS_MS = [MINUTE_MS, 5 * MINUTE_MS, 30 * MINUTE_MS, 120 * MINUTE_MS];
// The send right after commit normally claims a PENDING row within moments; older means that process is gone.
const ABANDONED_PENDING_MS = MINUTE_MS;
// Far longer than the provider's 10s timeout: past this the sender is gone, and the mail may or may not have
// left. Sending again risks a rare duplicate, which is the agreed trade against losing the notice.
const ABANDONED_SENDING_MS = 5 * MINUTE_MS;
const BATCH_SIZE = 50;

const ORDER_SELECT = { id: true, code: true, method: true, totalVnd: true, items: { select: { quantity: true } } } as const;

type NoticeOrder = Prisma.OrderGetPayload<{ select: typeof ORDER_SELECT }>;

interface Delivery {
  id: string;
  recipient: string;
  status: NotificationStatus;
  attempts: number;
}

/**
 * Tells the shop what happened to an order. The delivery rows join the order's transaction, so they exist
 * exactly when the change does; the mail goes out after commit, so a provider can never fail or hold up the
 * order (m4-contract §7). A later run picks up what failed or was left behind by a restart. The mail carries
 * no customer data or free text: the link leads to the admin page, behind its login.
 */
@Injectable()
export class OrderNotificationsService {
  private readonly logger = new Logger(OrderNotificationsService.name);

  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  enqueueOrderCreated(tx: Prisma.TransactionClient, orderId: string) {
    return this.enqueue(tx, ORDER_CREATED_SHOP, orderId);
  }

  enqueueOrderCancelled(tx: Prisma.TransactionClient, orderId: string) {
    return this.enqueue(tx, ORDER_CANCELLED_SHOP, orderId);
  }

  dispatchOrderCreated(code: string) {
    return this.dispatch(code, ORDER_CREATED_SHOP);
  }

  dispatchOrderCancelled(code: string) {
    return this.dispatch(code, ORDER_CANCELLED_SHOP);
  }

  /** One pass over everything due at `now`: failed deliveries whose wait is over and those a restart abandoned. */
  async processDue(now: Date): Promise<void> {
    const due = await this.db.notificationDelivery.findMany({
      where: { OR: [
        { status: 'FAILED', nextAttemptAt: { lte: now } },
        { status: 'PENDING', createdAt: { lte: new Date(now.getTime() - ABANDONED_PENDING_MS) } },
        { status: 'SENDING', updatedAt: { lte: new Date(now.getTime() - ABANDONED_SENDING_MS) } },
      ] },
      orderBy: { createdAt: 'asc' }, take: BATCH_SIZE,
      select: { id: true, event: true, recipient: true, status: true, attempts: true, order: { select: ORDER_SELECT } },
    });
    if (due.length === 0) return;
    const active = await this.db.user.findMany({ where: { role: 'ADMIN', disabledAt: null, email: { in: due.map((row) => row.recipient) } }, select: { email: true } });
    const activeEmails = new Set(active.map((user) => user.email));
    for (const delivery of due) {
      const { code } = delivery.order;
      try {
        const mail = this.render(delivery.event, delivery.order);
        if (!activeEmails.has(delivery.recipient) || !mail || delivery.attempts >= MAX_ATTEMPTS) {
          await this.giveUp(delivery, code);
          continue;
        }
        await this.deliver(delivery, code, mail, now);
      } catch {
        // One bad row must not hold back the rest; it stays due for the next pass.
        this.logger.warn(`ORDER_NOTICE_RETRY_FAILED ${code}`);
      }
    }
  }

  private render(event: string, order: NoticeOrder) {
    const link = `Xem đơn: ${this.config.appOrigin}/admin/orders/${order.id}`;
    if (event === ORDER_CREATED_SHOP) {
      const pieces = order.items.reduce((sum, item) => sum + item.quantity, 0);
      const payment = order.method === 'COD' ? 'COD, chưa thu tiền' : 'Chuyển khoản';
      return {
        subject: `Đơn mới ${order.code} | RMG Labels`,
        text: `Đơn mới ${order.code}\n\nSố sản phẩm: ${pieces}\nTổng tiền: ${MONEY.format(Number(order.totalVnd))} ₫\nThanh toán: ${payment}\n\n${link}`,
      };
    }
    if (event === ORDER_CANCELLED_SHOP) {
      return {
        subject: `Khách hủy đơn ${order.code} | RMG Labels`,
        text: `Khách đã hủy đơn ${order.code}. Hàng đã được trả lại kho; nếu đang chuẩn bị đơn này, hãy dừng lại.\n\nLý do hủy xem trên trang đơn.\n\n${link}`,
      };
    }
    return null;
  }

  private async enqueue(tx: Prisma.TransactionClient, event: string, orderId: string): Promise<void> {
    const admins = await tx.user.findMany({ where: { role: 'ADMIN', disabledAt: null }, select: { email: true } });
    await tx.notificationDelivery.createMany({ data: admins.map(({ email }) => ({ event, orderId, recipient: email })) });
  }

  /** Runs detached from the request after commit, so it answers nothing and must never reject. */
  private async dispatch(code: string, event: string): Promise<void> {
    try {
      const order = await this.db.order.findUnique({ where: { code }, select: { ...ORDER_SELECT,
        notifications: { where: { event, status: 'PENDING' }, select: { id: true, recipient: true, status: true, attempts: true } } } });
      if (!order) return;
      const mail = this.render(event, order);
      if (!mail) return;
      for (const delivery of order.notifications) await this.deliver(delivery, code, mail, new Date());
    } catch {
      this.logger.warn(`ORDER_NOTICE_DISPATCH_FAILED ${code}`);
    }
  }

  private async deliver(delivery: Delivery, code: string, mail: { subject: string; text: string }, now: Date): Promise<void> {
    // The claim matches the state this run read, so overlapping runs cannot send the same attempt twice.
    const claimed = await this.db.notificationDelivery.updateMany({ where: { id: delivery.id, status: delivery.status, attempts: delivery.attempts },
      data: { status: 'SENDING', attempts: { increment: 1 }, nextAttemptAt: null } });
    if (claimed.count === 0) return;
    const sent = await this.mail.sendOrderNotice(delivery.recipient, mail.subject, mail.text).catch(() => false);
    if (sent) {
      await this.db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: 'SENT', sentAt: new Date() } });
      return;
    }
    this.logger.warn(`ORDER_NOTICE_DELIVERY_FAILED ${code}`);
    const wait = RETRY_DELAYS_MS[delivery.attempts];
    if (wait === undefined) this.logger.warn(`ORDER_NOTICE_GAVE_UP ${code}`);
    await this.db.notificationDelivery.update({ where: { id: delivery.id },
      data: { status: 'FAILED', nextAttemptAt: wait === undefined ? null : new Date(now.getTime() + wait) } });
  }

  private async giveUp(delivery: Delivery, code: string): Promise<void> {
    const stopped = await this.db.notificationDelivery.updateMany({ where: { id: delivery.id, status: delivery.status, attempts: delivery.attempts },
      data: { status: 'FAILED', nextAttemptAt: null } });
    if (stopped.count > 0) this.logger.warn(`ORDER_NOTICE_GAVE_UP ${code}`);
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/environment.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const ORDER_CREATED_SHOP = 'order.created.shop';
const ORDER_CANCELLED_SHOP = 'order.cancelled.shop';
const MONEY = new Intl.NumberFormat('vi-VN');

interface NoticeOrder {
  id: string;
  code: string;
  method: string;
  totalVnd: Prisma.Decimal;
  items: Array<{ quantity: number }>;
}

/**
 * Tells the shop what happened to an order. The delivery rows join the order's transaction, so they exist
 * exactly when the change does; the mail goes out after commit, so a provider can never fail or hold up the
 * order (m4-contract §7). The mail carries no customer data or free text: the link leads to the admin page,
 * behind its login.
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
    return this.dispatch(code, ORDER_CREATED_SHOP, (order) => {
      const pieces = order.items.reduce((sum, item) => sum + item.quantity, 0);
      const payment = order.method === 'COD' ? 'COD, chưa thu tiền' : 'Chuyển khoản';
      return {
        subject: `Đơn mới ${order.code} | RMG Labels`,
        text: `Đơn mới ${order.code}\n\nSố sản phẩm: ${pieces}\nTổng tiền: ${MONEY.format(Number(order.totalVnd))} ₫\nThanh toán: ${payment}\n\n${this.link(order.id)}`,
      };
    });
  }

  dispatchOrderCancelled(code: string) {
    return this.dispatch(code, ORDER_CANCELLED_SHOP, (order) => ({
      subject: `Khách hủy đơn ${order.code} | RMG Labels`,
      text: `Khách đã hủy đơn ${order.code}. Hàng đã được trả lại kho; nếu đang chuẩn bị đơn này, hãy dừng lại.\n\nLý do hủy xem trên trang đơn.\n\n${this.link(order.id)}`,
    }));
  }

  private link(orderId: string) {
    return `Xem đơn: ${this.config.appOrigin}/admin/orders/${orderId}`;
  }

  private async enqueue(tx: Prisma.TransactionClient, event: string, orderId: string): Promise<void> {
    const admins = await tx.user.findMany({ where: { role: 'ADMIN', disabledAt: null }, select: { email: true } });
    await tx.notificationDelivery.createMany({ data: admins.map(({ email }) => ({ event, orderId, recipient: email })) });
  }

  /** Runs detached from the request after commit, so it answers nothing and must never reject. */
  private async dispatch(code: string, event: string, render: (order: NoticeOrder) => { subject: string; text: string }): Promise<void> {
    try {
      const order = await this.db.order.findUnique({ where: { code }, select: { id: true, code: true, method: true, totalVnd: true,
        items: { select: { quantity: true } }, notifications: { where: { event, status: 'PENDING' }, select: { id: true, recipient: true } } } });
      if (!order) return;
      const { subject, text } = render(order);
      for (const delivery of order.notifications) await this.deliver(delivery, code, subject, text);
    } catch {
      this.logger.warn(`ORDER_NOTICE_DISPATCH_FAILED ${code}`);
    }
  }

  private async deliver(delivery: { id: string; recipient: string }, code: string, subject: string, text: string): Promise<void> {
    // The claim makes each delivery send at most once; a row left in SENDING is for the retry work of M4.10.2.
    const claimed = await this.db.notificationDelivery.updateMany({ where: { id: delivery.id, status: 'PENDING' },
      data: { status: 'SENDING', attempts: { increment: 1 } } });
    if (claimed.count === 0) return;
    const sent = await this.mail.sendOrderNotice(delivery.recipient, subject, text).catch(() => false);
    if (!sent) this.logger.warn(`ORDER_NOTICE_DELIVERY_FAILED ${code}`);
    await this.db.notificationDelivery.update({ where: { id: delivery.id },
      data: sent ? { status: 'SENT', sentAt: new Date() } : { status: 'FAILED' } });
  }
}

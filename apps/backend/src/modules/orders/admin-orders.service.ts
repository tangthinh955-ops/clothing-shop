import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { ActorType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminOrdersQuery } from './dto/admin-orders-query.dto.js';
import { normalizeVietnamesePhone } from './order-command.js';

// Guest and system effects have no user row; an admin entry always names its user.
const ACTOR_FALLBACK_NAMES: Record<ActorType, string> = { ADMIN: 'Quản trị viên', GUEST: 'Khách đặt hàng', SYSTEM: 'Hệ thống' };

/** Read side of the admin order pages (M4.5.1): no address, email, note or token hash in a list. */
@Injectable()
export class AdminOrdersService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async list(query: AdminOrdersQuery) {
    const where = this.filter(query);
    const [orders, total] = await Promise.all([
      this.db.order.findMany({
        where,
        select: { id: true, code: true, status: true, source: true, method: true, totalVnd: true, recipientName: true,
          phone: true, createdAt: true, items: { select: { quantity: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.order.count({ where }),
    ]);
    return {
      items: orders.map(({ items, totalVnd, ...order }) => ({
        ...order,
        totalVnd: Number(totalVnd),
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** The whole snapshot an admin works from; only the guest lookup-token hash stays out. */
  async detail(id: string) {
    const order = await this.db.order.findUnique({
      where: { id },
      select: {
        id: true, code: true, status: true, source: true, method: true, currency: true, version: true, createdAt: true,
        recipientName: true, phone: true, email: true, province: true, district: true, ward: true, addressLine: true, note: true,
        subtotalVnd: true, shippingFeeVnd: true, totalVnd: true, bankDeadlineAt: true, trackingNumber: true,
        deliveredAt: true, cancelledAt: true, cancelReason: true,
        items: { select: { variantId: true, productName: true, sku: true, size: true, color: true, unitPriceVnd: true,
          quantity: true, lineTotalVnd: true }, orderBy: { sku: 'asc' } },
        history: { select: { id: true, fromStatus: true, toStatus: true, actorType: true, reason: true, version: true, createdAt: true,
          actor: { select: { name: true } } }, orderBy: [{ createdAt: 'asc' }, { version: 'asc' }] },
        notes: { select: { id: true, body: true, createdAt: true, author: { select: { name: true } } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy đơn hàng.' });
    const { recipientName, phone, email, province, district, ward, addressLine, note, subtotalVnd, shippingFeeVnd, totalVnd,
      items, history, notes, ...rest } = order;
    return {
      ...rest,
      recipient: { name: recipientName, phone, email },
      address: { province, district, ward, addressLine },
      customerNote: note,
      subtotalVnd: Number(subtotalVnd),
      shippingFeeVnd: Number(shippingFeeVnd),
      totalVnd: Number(totalVnd),
      items: items.map((item) => ({ ...item, unitPriceVnd: Number(item.unitPriceVnd), lineTotalVnd: Number(item.lineTotalVnd) })),
      history: history.map(({ actor, actorType, ...entry }) => ({ ...entry, actorName: actor?.name ?? ACTOR_FALLBACK_NAMES[actorType] })),
      notes: notes.map(({ author, ...entry }) => ({ ...entry, authorName: author.name })),
    };
  }

  private filter({ status, q }: AdminOrdersQuery): Prisma.OrderWhereInput {
    return {
      ...(status ? { status } : {}),
      ...(q ? { OR: [
        { code: { contains: q, mode: 'insensitive' } },
        { recipientName: { contains: q, mode: 'insensitive' } },
        // Phones are stored normalized, so "+84 901 000 002" must search as "0901000002".
        { phone: { contains: normalizeVietnamesePhone(q) ?? q } },
      ] } : {}),
    };
  }
}

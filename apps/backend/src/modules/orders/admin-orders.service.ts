import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminOrdersQuery } from './dto/admin-orders-query.dto.js';
import { normalizeVietnamesePhone } from './order-command.js';

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

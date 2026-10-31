import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { lookupTokenHash } from './order-command.js';

/**
 * One failure shape for every access failure (m4-contract §5 Xem đơn): unknown code, missing,
 * malformed or foreign token all answer the same 404 — nothing reveals which part was wrong.
 */
export const ORDER_ACCESS_NOT_FOUND = 'Không tìm thấy đơn hàng. Kiểm tra lại mã đơn hoặc đường dẫn đã nhận từ shop.';

export const orderAccessNotFound = (): NotFoundException =>
  new NotFoundException({ code: 'NOT_FOUND', message: ORDER_ACCESS_NOT_FOUND });

/** URL-parameter shape guard only: orders.code is VARCHAR(24) with no pattern CHECK — real codes
 * come from generateOrderCode, but fixture codes with other letters are deliberately accepted, so
 * "plausible" means bounded length with no control characters. PostgreSQL refuses NUL inside text
 * values, so /orders/%00 must answer the uniform 404 before the query, not a database error. */
const INVALID_CODE_SHAPE = (value: string): boolean =>
  value.length === 0 || value.length > 24 || /[\u0000-\u001f\u007f]/.test(value);

const ACTOR_LABELS: Record<'ADMIN' | 'GUEST' | 'SYSTEM', string> = {
  ADMIN: 'Cửa hàng', // Staff names stay internal; the guest timeline shows the role only (M4.4.1 scope).
  GUEST: 'Khách đặt hàng',
  SYSTEM: 'Hệ thống',
};

export interface OrderDetailItemView {
  variantId: string; productName: string; sku: string; size: string; color: string;
  unitPriceVnd: number; quantity: number; lineTotalVnd: number;
}

export interface OrderDetailRecipientView {
  name: string; phone: string; email: string | null;
  province: string; district: string; ward: string; addressLine: string; note: string | null;
}

export type CustomerOrderStatus = 'PENDING' | 'CONFIRMED' | 'PACKING' | 'SHIPPED' | 'DELIVERED'
  | 'CANCELLED' | 'DELIVERY_FAILED' | 'RETURNED_TO_SHOP';

export interface OrderDetailView {
  code: string; status: CustomerOrderStatus; method: 'COD' | 'BANK_TRANSFER'; currency: 'VND'; createdAt: string;
  items: OrderDetailItemView[]; subtotal: number; shippingFee: number; total: number;
  recipient: OrderDetailRecipientView;
}

export interface OrderDetailTimelineView {
  fromStatus: CustomerOrderStatus | null; toStatus: CustomerOrderStatus;
  actorLabel: string; reason: string | null; version: number; at: string;
}

export interface OrderDetailResult { order: OrderDetailView; timeline: OrderDetailTimelineView[]; }

/**
 * Guest order access (m4-contract §8): the fragment token is verified against the stored SHA-256
 * and the response is an explicit allowlist — item/recipient/money snapshots from the order row,
 * never product names, stock, settings or the internal identifiers. Reading never writes.
 */
@Injectable()
export class OrderAccessService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async view(code: string, token: string): Promise<OrderDetailResult> {
    if (INVALID_CODE_SHAPE(code)) throw orderAccessNotFound();
    const order = await this.db.order.findUnique({
      where: { code },
      select: {
        code: true, status: true, method: true, currency: true, createdAt: true,
        recipientName: true, phone: true, email: true, province: true, district: true, ward: true,
        addressLine: true, note: true,
        subtotalVnd: true, shippingFeeVnd: true, totalVnd: true,
        lookupTokenHash: true,
        items: { select: { variantId: true, productName: true, sku: true, size: true, color: true,
          unitPriceVnd: true, quantity: true, lineTotalVnd: true } },
        history: { select: { fromStatus: true, toStatus: true, actorType: true, reason: true, version: true,
          createdAt: true }, orderBy: [{ version: 'asc' }, { createdAt: 'asc' } as const] },
      },
    });
    if (!order) throw orderAccessNotFound();
    const storedHash = order.lookupTokenHash;
    if (!storedHash || lookupTokenHash(token) !== storedHash) throw orderAccessNotFound();
    return {
      order: {
        code: order.code, status: order.status as CustomerOrderStatus,
        method: order.method as 'COD' | 'BANK_TRANSFER', currency: 'VND',
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((item) => ({ variantId: item.variantId, productName: item.productName, sku: item.sku,
          size: item.size, color: item.color, unitPriceVnd: Number(item.unitPriceVnd), quantity: item.quantity,
          lineTotalVnd: Number(item.lineTotalVnd) })),
        subtotal: Number(order.subtotalVnd), shippingFee: Number(order.shippingFeeVnd), total: Number(order.totalVnd),
        recipient: { name: order.recipientName, phone: order.phone, email: order.email, province: order.province,
          district: order.district, ward: order.ward, addressLine: order.addressLine, note: order.note },
      },
      timeline: order.history.map((row) => ({ fromStatus: row.fromStatus as CustomerOrderStatus | null,
        toStatus: row.toStatus as CustomerOrderStatus, actorLabel: ACTOR_LABELS[row.actorType],
        reason: row.reason, version: row.version, at: row.createdAt.toISOString() })),
    };
  }
}

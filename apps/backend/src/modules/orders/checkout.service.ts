import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { databaseError } from '../../common/database-errors.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { SettingsService } from '../settings/settings.service.js';
import { CART_LINES_LIMIT, CART_QUANTITY_LIMIT } from '../products/cart-products.service.js';

/** Quote validity per the approved M4.2.2 scope (m4-contract §10 proposal, now fixed for v1). */
export const QUOTE_TTL_MINUTES = 15;
const MAX_TOTAL_VND = 1_000_000_000;

export interface QuoteSnapshotItem {
  variantId: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  unitPriceVnd: number;
  quantity: number;
  lineTotalVnd: number;
}

export interface CheckoutQuoteView {
  quoteId: string;
  method: 'COD';
  currency: 'VND';
  items: QuoteSnapshotItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
  settingsVersion: number;
  serverNow: string;
  expiresAt: string;
}

interface NormalizedLine { variantId: string; quantity: number }

function invalid(message: string): BadRequestException {
  return new BadRequestException({ code: 'VALIDATION_ERROR', message });
}

/**
 * One server-priced checkout preview (m4-contract §5 Quote). The transaction is a consistent read
 * (products, stock and settings from the same snapshot) plus exactly one quote insert; nothing here
 * reserves stock, writes inventory/orders or talks to the network.
 */
@Injectable()
export class CheckoutService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(SettingsService) private readonly settings: SettingsService,
  ) {}

  async quote(dto: { method: string; items: Array<{ variantId: string; quantity: number }> }): Promise<CheckoutQuoteView> {
    if (dto.method !== 'COD') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Hiện chỉ hỗ trợ thanh toán khi nhận hàng (COD).' });
    }
    const merged = new Map<string, number>();
    for (const { variantId, quantity } of dto.items) {
      const id = variantId.toLowerCase();
      const total = (merged.get(id) ?? 0) + quantity;
      if (total > CART_QUANTITY_LIMIT) throw invalid('Một sản phẩm chỉ được tối đa 99 chiếc trong giỏ.');
      merged.set(id, total);
    }
    if (merged.size > CART_LINES_LIMIT) throw invalid('Giỏ chỉ chứa tối đa 50 dòng sau khi gộp.');
    if (merged.size === 0) throw invalid('Giỏ hàng trống.');
    // Stable order by variantId: the snapshot and every later comparison stay deterministic.
    const lines = [...merged.entries()].sort(([left], [right]) => (left < right ? -1 : 1))
      .map(([variantId, quantity]) => ({ variantId, quantity }));
    try {
      return await this.db.$transaction(async (tx) => this.build(tx, lines), { isolationLevel: 'RepeatableRead' });
    } catch (error) { databaseError(error); }
  }

  private async build(tx: Prisma.TransactionClient, lines: NormalizedLine[]): Promise<CheckoutQuoteView> {
    const config = await this.settings.currentInTx(tx);
    const rows = await tx.variant.findMany({
      where: { id: { in: lines.map((line) => line.variantId) } },
      select: { id: true, sku: true, size: true, color: true, price: true, active: true,
        inventory: { select: { onHand: true, reserved: true } },
        product: { select: { name: true, status: true, category: { select: { active: true } } } } },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const items: QuoteSnapshotItem[] = [];
    let subtotal = 0;
    for (const line of lines) {
      const row = byId.get(line.variantId);
      if (!row || !row.active || row.product.status !== 'PUBLISHED' || !row.product.category.active) {
        // Uniform refusal carrying only the client-sent id in fieldErrors; hidden rows leak no metadata.
        throw new ConflictException({ code: 'ITEM_UNAVAILABLE',
          message: 'Một sản phẩm trong giỏ không còn bán. Hãy xóa hoặc thay thế nó rồi lấy báo giá lại.',
          fieldErrors: [{ field: 'items.variantId', message: line.variantId }] });
      }
      const available = Math.max(0, (row.inventory?.onHand ?? 0) - (row.inventory?.reserved ?? 0));
      if (line.quantity > available) {
        throw new ConflictException({ code: 'OUT_OF_STOCK',
          message: `Chỉ còn ${available} chiếc cho một sản phẩm trong giỏ. Hãy giảm số lượng rồi lấy báo giá lại.`,
          fieldErrors: [{ field: 'items.variantId', message: line.variantId }] });
      }
      const unitPriceVnd = Number(row.price);
      const lineTotalVnd = unitPriceVnd * line.quantity;
      subtotal += lineTotalVnd;
      items.push({ variantId: row.id, productName: row.product.name, sku: row.sku, size: row.size,
        color: row.color, unitPriceVnd, quantity: line.quantity, lineTotalVnd });
    }
    const totalVnd = subtotal + config.shippingFeeVnd;
    if (totalVnd > MAX_TOTAL_VND) throw invalid('Tổng tiền đơn vượt giới hạn 1.000.000.000đ.');
    // Clock and writes come from PostgreSQL inside the same snapshot, never from the client.
    const nowRows = await tx.$queryRaw<Array<{ now: Date }>>`SELECT now() AS now`;
    const serverNow = nowRows[0]!.now;
    const expiresAt = new Date(serverNow.getTime() + QUOTE_TTL_MINUTES * 60000);
    const row = await tx.checkoutQuote.create({ data: { items: items as unknown as Prisma.InputJsonValue,
      method: 'COD', currency: 'VND', subtotalVnd: subtotal, shippingFeeVnd: config.shippingFeeVnd,
      totalVnd, settingsVersion: config.version, expiresAt } });
    return { quoteId: row.id, method: 'COD', currency: 'VND', items, subtotal,
      shippingFee: config.shippingFeeVnd, total: totalVnd, settingsVersion: config.version,
      serverNow: serverNow.toISOString(), expiresAt: expiresAt.toISOString() };
  }
}

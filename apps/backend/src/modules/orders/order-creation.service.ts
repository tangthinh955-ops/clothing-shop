import { BadRequestException, ConflictException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { conflict, databaseError } from '../../common/database-errors.js';
import { InventoryOperationsService } from '../inventory/inventory-operations.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { CART_LINES_LIMIT, CART_QUANTITY_LIMIT } from '../products/cart-products.service.js';
import { canonicalizeOrderCommand, generateLookupToken, generateOrderCode, hashOrderCommand,
  lookupTokenHash, type OrderCommand } from './order-command.js';
import { OrderNotificationsService } from './order-notifications.service.js';

const CREATE_SCOPE = 'orders.create';
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,120}$/;
// Retention agrees with the m4-contract §10 proposal; sweeping expired records arrives with M4 cleanup.
const RECORD_TTL_MS = 30 * 86400000;
const MAX_TOTAL_VND = 1_000_000_000;
const MAX_PENDING_PER_PHONE = 3;
const MAX_CODE_ATTEMPTS = 3;
const MAX_DEADLOCK_RETRIES = 2;

export interface OrderConfirmationView {
  code: string;
  status: 'PENDING';
  method: 'COD';
  currency: 'VND';
  items: Array<{ variantId: string; productName: string; sku: string; size: string; color: string;
    unitPriceVnd: number; quantity: number; lineTotalVnd: number }>;
  subtotal: number;
  shippingFee: number;
  total: number;
}

export interface CreateOrderResult {
  order: OrderConfirmationView;
  /** Plaintext lookup token, returned exactly once on the first committed create (m4-contract §8). */
  lookupToken?: string;
  replay?: boolean;
}

function invalid(message: string): BadRequestException {
  return new BadRequestException({ code: 'VALIDATION_ERROR', message });
}

function quoteChanged(message: string): ConflictException {
  return new ConflictException({ code: 'QUOTE_CHANGED', message });
}

function tooManyRequests(message: string): HttpException {
  return new HttpException({ code: 'RATE_LIMITED', message }, HttpStatus.TOO_MANY_REQUESTS);
}

function isPrismaUnique(error: unknown, target: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002'
    && JSON.stringify((error as { meta?: { target?: unknown } }).meta ?? {}).includes(target);
}

function isRetryableWrite(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : undefined;
  if (code === 'P2034' || code === '40001' || code === 'P2010') return true;
  // Serialization/deadlock failures may also surface as plain driver errors with the SQLSTATE text.
  return error instanceof Error
    && (error.message.includes('40001') || error.message.includes('could not serialize') || error.message.includes('deadlock detected'));
}

/**
 * Guest COD checkout (m4-contract §5 Create): the coordinating transaction re-verified the quote,
 * prices, stock and the pending-phone quota, then writes order/items/history/reserve/command record
 * as one unit. Lock order: the per-phone advisory lock, then inventory rows by variantId ascending
 * (inside InventoryOperationsService), matching the stable ordering of the contract.
 */
@Injectable()
export class OrderCreationService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(SettingsService) private readonly settings: SettingsService,
    @Inject(InventoryOperationsService) private readonly inventory: InventoryOperationsService,
    @Inject(OrderNotificationsService) private readonly notifications: OrderNotificationsService,
  ) {}

  async create(input: { key: string | undefined; sessionId: string; dto: {
    quoteId: string; method: string;
    items: Array<{ variantId: string; quantity: number }>;
    contact: { name: string; phone: string; email?: string | null };
    address: { province: string; district?: string; ward: string; addressLine: string };
    note?: string | null;
  } }): Promise<CreateOrderResult> {
    if (!input.key || !KEY_PATTERN.test(input.key)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Cần Idempotency-Key hợp lệ.' });
    }
    if (input.dto.method !== 'COD') {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Hiện chỉ hỗ trợ thanh toán khi nhận hàng (COD).' });
    }
    if (input.dto.items.length === 0) throw invalid('Giỏ hàng trống.');
    const command = canonicalizeOrderCommand(input.dto);
    if (command.contact.phone === '') throw invalid('Số điện thoại Việt Nam chưa hợp lệ.');
    if (command.items.length > CART_LINES_LIMIT) throw invalid('Giỏ chỉ chứa tối đa 50 dòng sau khi gộp.');
    if (command.items.some((line) => line.quantity > CART_QUANTITY_LIMIT)) throw invalid('Một sản phẩm chỉ được tối đa 99 chiếc trong giỏ.');
    const identity = `guest:${input.sessionId}`;
    const requestHash = hashOrderCommand(command);
    for (let attempt = 0; attempt <= MAX_CODE_ATTEMPTS; attempt += 1) {
      try {
        // READ COMMITTED (not RR) is the correct pairing here: the per-phone advisory lock serializes
        // same-phone requests, the reserve UPDATE re-evaluates its guard on the locked row, and every
        // read (prices, quota) then sees the latest committed state instead of a stale RR snapshot.
        // The timeout covers legitimate waits on the phone lock and on contended inventory rows.
        const result = await this.db.$transaction(async (tx) => this.createInTx(tx, { identity, key: input.key!, requestHash, command }),
          { isolationLevel: 'ReadCommitted', timeout: 15000, maxWait: 5000 });
        // Only the request that committed the order sends; the customer never waits on the mail.
        if (!result.replay) void this.notifications.dispatchOrderCreated(result.order.code);
        return result;
      } catch (error) {
        // A colliding guest-visible code is meaningless randomness: retry with a fresh code. Every
        // other unique violation is the command record race and resolves as a replay or a conflict.
        if (isPrismaUnique(error, 'orders_code_key') && attempt < MAX_CODE_ATTEMPTS) continue;
        if (isRetryableWrite(error) && attempt < MAX_DEADLOCK_RETRIES) continue;
        if (isPrismaUnique(error, 'idempotency_records_scope_identity_key_key')) {
          const recorded = await this.db.idempotencyRecord.findUnique({
            where: { scope_identity_key: { scope: CREATE_SCOPE, identity, key: input.key! } } });
          if (recorded) return this.replayResult(recorded, requestHash);
        }
        databaseError(error);
      }
    }
    throw invalid('Không tạo được mã đơn. Vui lòng thử lại.');
  }

  private async createInTx(tx: Prisma.TransactionClient, input: {
    identity: string; key: string; requestHash: string; command: OrderCommand;
  }): Promise<CreateOrderResult> {
    // The per-phone advisory lock MUST be the first statement: the RepeatableRead snapshot starts at
    // the first query, so locking before any read makes every later read see all same-phone commands
    // that committed before us — no stale snapshots, no serialization retries within the happy path.
    // The lock function returns void, which $queryRaw cannot deserialize — expose a boolean instead.
    await tx.$queryRaw<Array<{ locked: boolean }>>
      `SELECT pg_advisory_xact_lock(hashtext(${input.command.contact.phone})::bigint) IS NOT NULL AS locked`;

    // Replay detection comes before every re-verification (m4-contract §7): a lost response retried
    // after quote expiry still returns the committed order. Under the lock this also sees concurrent
    // same-phone duplicates.
    const recorded = await tx.idempotencyRecord.findUnique({
      where: { scope_identity_key: { scope: CREATE_SCOPE, identity: input.identity, key: input.key } } });
    if (recorded) return this.replayResult(recorded, input.requestHash);

    const quote = await tx.checkoutQuote.findUnique({ where: { id: input.command.quoteId } });
    if (!quote || quote.method !== 'COD') {
      throw quoteChanged('Báo giá không còn hợp lệ. Hãy lấy báo giá mới.');
    }
    const snapshot = quote.items as Array<{ variantId: string; productName: string; sku: string; size: string;
      color: string; unitPriceVnd: number; quantity: number; lineTotalVnd: number }>;
    const sameCart = snapshot.length === input.command.items.length && [...snapshot]
      .sort((left, right) => (left.variantId < right.variantId ? -1 : 1))
      .every((item, index) => item.variantId === input.command.items[index]!.variantId
        && item.quantity === input.command.items[index]!.quantity);
    if (!sameCart) throw quoteChanged('Giỏ đã thay đổi so với báo giá. Hãy lấy báo giá mới.');

    // Lock every row the verification depends on BEFORE reading it: settings FOR SHARE blocks a
    // concurrent fee change between the read and the commit; variant rows FOR UPDATE (ascending id)
    // block a concurrent price change and queue same-SKU orders deterministically. Without these
    // locks READ COMMITTED could pair the quote's fee with a newer price (or the reverse).
    await tx.$queryRaw`SELECT id FROM shop_settings WHERE id = 'default' FOR SHARE`;
    await tx.$queryRaw<Array<{ id: string }>>
      `SELECT id FROM variants WHERE id IN (${Prisma.join(snapshot.map((item) => item.variantId))}) ORDER BY id FOR UPDATE`;
    const config = await this.settings.currentInTx(tx);
    // quote.money columns are Decimal(14,0) integers — compare and expose through Number().
    if (config.shippingFeeVnd !== Number(quote.shippingFeeVnd) || config.version !== quote.settingsVersion) {
      throw quoteChanged('Giá hoặc phí đã thay đổi so với báo giá. Hãy lấy báo giá mới.');
    }

    // Expiry uses clock_timestamp(): the transaction may have waited on the advisory or row locks,
    // and now() would report the stale transaction start instead of the real current time.
    const nowRows = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
    const dbNow = nowRows[0]!.now;
    if (quote.expiresAt.getTime() <= dbNow.getTime()) {
      throw quoteChanged('Báo giá đã hết hạn. Hãy lấy báo giá mới.');
    }

    const rows = await tx.variant.findMany({
      where: { id: { in: snapshot.map((item) => item.variantId) } },
      select: { id: true, sku: true, size: true, color: true, price: true, active: true,
        inventory: { select: { onHand: true, reserved: true } },
        product: { select: { name: true, status: true, category: { select: { active: true } } } } },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const item of snapshot) {
      const row = byId.get(item.variantId);
      if (!row || !row.active || row.product.status !== 'PUBLISHED' || !row.product.category.active) {
        throw new ConflictException({ code: 'ITEM_UNAVAILABLE',
          message: 'Một sản phẩm trong giỏ không còn bán. Hãy xóa hoặc thay thế nó rồi đặt lại.',
          fieldErrors: [{ field: 'items.variantId', message: item.variantId }] });
      }
      if (Number(row.price) !== item.unitPriceVnd) {
        throw quoteChanged('Giá hoặc phí đã thay đổi so với báo giá. Hãy lấy báo giá mới.');
      }
      const available = Math.max(0, (row.inventory?.onHand ?? 0) - (row.inventory?.reserved ?? 0));
      if (item.quantity > available) {
        throw new ConflictException({ code: 'OUT_OF_STOCK',
          message: `Chỉ còn ${available} chiếc cho một sản phẩm trong giỏ. Hãy giảm số lượng rồi đặt lại.`,
          fieldErrors: [{ field: 'items.variantId', message: item.variantId }] });
      }
    }

    const pending = await tx.order.count({ where: { phone: input.command.contact.phone, status: 'PENDING' } });
    if (pending >= MAX_PENDING_PER_PHONE) {
      throw tooManyRequests('Bạn đã có nhiều đơn đang chờ xác nhận. Vui lòng đợi xử lý hoặc liên hệ shop.');
    }

    // Snapshot discipline: money comes from the re-verified quote, contact/address from the command.
    const lookupToken = generateLookupToken();
    const order = await tx.order.create({ data: {
      code: generateOrderCode(), status: 'PENDING', source: 'WEB', userId: null, quoteId: quote.id,
      recipientName: input.command.contact.name, phone: input.command.contact.phone,
      email: input.command.contact.email, province: input.command.address.province,
      district: input.command.address.district, ward: input.command.address.ward,
      addressLine: input.command.address.addressLine, note: input.command.note, method: 'COD', currency: 'VND',
      subtotalVnd: quote.subtotalVnd, shippingFeeVnd: quote.shippingFeeVnd, totalVnd: quote.totalVnd,
      settingsVersion: config.version, lookupTokenHash: lookupTokenHash(lookupToken), version: 0,
      items: { create: snapshot.map((item) => ({ variantId: item.variantId, productName: item.productName,
        sku: item.sku, size: item.size, color: item.color, unitPriceVnd: item.unitPriceVnd,
        quantity: item.quantity, lineTotalVnd: item.lineTotalVnd })) },
      history: { create: { fromStatus: null, toStatus: 'PENDING', actorType: 'GUEST', actorId: null, version: 0 } },
    } });

    // Holding stock is the only inventory touch, through the standard operations service.
    await this.inventory.reserve(tx, `order:${order.id}:reserve`,
      snapshot.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
      { type: 'GUEST' }, `Đặt hàng COD ${order.code}`);

    // The reserve may have waited on a locked inventory row: re-check expiry against the real clock
    // before committing the command record, so a quote that expired during that wait rolls back
    // the order, its items, the history and the reserve as one unit.
    const finalClock = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
    if (quote.expiresAt.getTime() <= finalClock[0]!.now.getTime()) {
      throw quoteChanged('Báo giá đã hết hạn. Hãy lấy báo giá mới.');
    }

    await this.notifications.enqueueOrderCreated(tx, order.id);

    const view: OrderConfirmationView = { code: order.code, status: 'PENDING', method: 'COD', currency: 'VND',
      items: snapshot, subtotal: Number(quote.subtotalVnd), shippingFee: Number(quote.shippingFeeVnd),
      total: Number(quote.totalVnd) };
    await tx.idempotencyRecord.create({ data: { scope: CREATE_SCOPE, identity: input.identity, key: input.key,
      requestHash: input.requestHash, resourceId: order.id,
      // The stored replay response never carries the plaintext token or contact PII (m4-contract §8).
      response: { order: view } as unknown as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + RECORD_TTL_MS) } });
    return { order: view, lookupToken, replay: false };
  }

  private async replayResult(recorded: {
    requestHash: string; response: unknown;
  }, requestHash: string): Promise<CreateOrderResult> {
    if (recorded.requestHash !== requestHash) conflict('Mã thao tác đã dùng với nội dung khác.');
    const response = recorded.response as { order?: OrderConfirmationView } | null;
    // The stored response only ever holds what this service wrote; degrade to a conflict if malformed.
    if (!response || typeof response !== 'object' || !response.order) {
      conflict('Mã thao tác đã dùng với nội dung khác.');
    }
    // A replay never re-issues the lookup token (m4-contract §8).
    return { order: response.order!, replay: true };
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { generateLookupToken, lookupTokenHash } from './order-command.js';
import { OrderAccessService, orderAccessNotFound, type OrderDetailResult } from './order-access.service.js';
import type { OrderLookupDto } from './dto/order-lookup.dto.js';

export interface OrderLookupResult extends OrderDetailResult {
  /** Plaintext token of THIS lookup only, handed back exactly once; the server keeps just its SHA-256. */
  lookupToken: string;
}

/**
 * Guest lookup by order code + phone (m4-contract §5/§8, M4.4.2). One transaction verifies the
 * phone against the order, replaces the stored SHA-256 and reads the canonical allowlisted
 * snapshot: a wrong answer never touches the hash, a right answer invalidates every link issued
 * before it. The new plaintext token exists only in the response — never in DB, logs or records.
 */
@Injectable()
export class OrderLookupService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(OrderAccessService) private readonly access: OrderAccessService,
  ) {}

  async lookup(dto: OrderLookupDto): Promise<OrderLookupResult> {
    const token = generateLookupToken();
    const tokenHash = lookupTokenHash(token);
    const result = await this.db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { code: dto.code }, select: { phone: true } });
      // One uniform 404 for unknown code and wrong phone — nothing reveals which part failed, and
      // no other order of the same phone is ever listed.
      if (!order || order.phone !== dto.phone) throw orderAccessNotFound();
      // The update takes the row lock, so racing lookups serialize here and only the last hash
      // replacement survives — two answers can never stay openable at the same time.
      await tx.order.update({ where: { code: dto.code }, data: { lookupTokenHash: tokenHash } });
      return this.access.snapshot(dto.code, tx);
    });
    return { ...result, lookupToken: token };
  }
}

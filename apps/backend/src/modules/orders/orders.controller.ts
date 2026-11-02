import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderCancelDto } from './dto/order-cancel.dto.js';
import { OrderLookupDto } from './dto/order-lookup.dto.js';
import { OrderAccessGuard } from './order-access.guard.js';
import { OrderAccessService } from './order-access.service.js';
import { OrderCancellationService } from './order-cancellation.service.js';
import { OrderCreationService } from './order-creation.service.js';
import { OrderLookupService } from './order-lookup.service.js';

// Guest order creation (m4-contract §5 Create): the CSRF guard, origin check and session middleware
// apply globally; no session/role guard is added here. The rate limit is the approved 5 requests per
// minute per client IP, scoped to this endpoint only through the existing Throttler setup.
// Guest order access (M4.4.1): reads go through OrderAccessGuard first (token envelope) and the
// rate limit is 30/min/IP; the global Cache-Control: no-store from application.ts still applies.
// Guest lookup (M4.4.2): POST /orders/lookup trades code+phone for a fresh token — same CSRF pair
// as creation, its own approved 5/min/IP budget, no session or role required.
@Controller('orders')
export class OrdersController {
  constructor(
    @Inject(OrderCreationService) private readonly orders: OrderCreationService,
    @Inject(OrderAccessService) private readonly access: OrderAccessService,
    @Inject(OrderLookupService) private readonly lookups: OrderLookupService,
    @Inject(OrderCancellationService) private readonly cancellations: OrderCancellationService,
  ) {}

  @Post()
  @HttpCode(201)
  @Throttle({ ip: { limit: 5, ttl: 60000 } })
  create(@Headers('idempotency-key') key: string | undefined, @Req() request: Request, @Body() dto: CreateOrderDto) {
    // The session id is the server-issued guest identity for idempotency (m4-contract §6): never the
    // body, never the raw IP, and never an account binding for logged-in shoppers.
    return this.orders.create({ key, sessionId: request.sessionID, dto });
  }

  @Post('lookup')
  @HttpCode(200)
  @Throttle({ ip: { limit: 5, ttl: 60000 } })
  lookup(@Body() dto: OrderLookupDto) {
    return this.lookups.lookup(dto);
  }

  @Get(':code')
  @Throttle({ ip: { limit: 30, ttl: 60000 } })
  @UseGuards(OrderAccessGuard)
  view(@Param('code') code: string, @Req() request: Request) {
    // The guard already normalized X-Order-Token into request.orderToken; the service hashes it
    // against the stored SHA-256 and answers the customer allowlist view.
    return this.access.view(code, request.orderToken!);
  }

  // Guest cancellation (M4.4.3): same token gate as the view, its own 5/min/IP budget like the lookup.
  @Post(':code/cancel')
  @HttpCode(200)
  @Throttle({ ip: { limit: 5, ttl: 60000 } })
  @UseGuards(OrderAccessGuard)
  cancel(@Param('code') code: string, @Headers('idempotency-key') key: string | undefined, @Req() request: Request, @Body() dto: OrderCancelDto) {
    return this.cancellations.cancel({ code, token: request.orderToken!, sessionId: request.sessionID, key,
      expectedVersion: dto.expectedVersion, reason: dto.reason });
  }
}

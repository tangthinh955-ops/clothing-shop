import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderAccessGuard } from './order-access.guard.js';
import { OrderAccessService } from './order-access.service.js';
import { OrderCreationService } from './order-creation.service.js';

// Guest order creation (m4-contract §5 Create): the CSRF guard, origin check and session middleware
// apply globally; no session/role guard is added here. The rate limit is the approved 5 requests per
// minute per client IP, scoped to this endpoint only through the existing Throttler setup.
// Guest order access (M4.4.1): reads go through OrderAccessGuard first (token envelope) and the
// rate limit is 30/min/IP; the global Cache-Control: no-store from application.ts still applies.
@Controller('orders')
export class OrdersController {
  constructor(
    @Inject(OrderCreationService) private readonly orders: OrderCreationService,
    @Inject(OrderAccessService) private readonly access: OrderAccessService,
  ) {}

  @Post()
  @HttpCode(201)
  @Throttle({ ip: { limit: 5, ttl: 60000 } })
  create(@Headers('idempotency-key') key: string | undefined, @Req() request: Request, @Body() dto: CreateOrderDto) {
    // The session id is the server-issued guest identity for idempotency (m4-contract §6): never the
    // body, never the raw IP, and never an account binding for logged-in shoppers.
    return this.orders.create({ key, sessionId: request.sessionID, dto });
  }

  @Get(':code')
  @Throttle({ ip: { limit: 30, ttl: 60000 } })
  @UseGuards(OrderAccessGuard)
  view(@Param('code') code: string, @Req() request: Request) {
    // The guard already normalized X-Order-Token into request.orderToken; the service hashes it
    // against the stored SHA-256 and answers the customer allowlist view.
    return this.access.view(code, request.orderToken!);
  }
}

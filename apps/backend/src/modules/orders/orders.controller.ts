import { Body, Controller, Headers, HttpCode, Inject, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderCreationService } from './order-creation.service.js';

// Guest order creation (m4-contract §5 Create): the CSRF guard, origin check and session middleware
// apply globally; no session/role guard is added here. The rate limit is the approved 5 requests per
// minute per client IP, scoped to this endpoint only through the existing Throttler setup.
@Controller('orders')
export class OrdersController {
  constructor(@Inject(OrderCreationService) private readonly orders: OrderCreationService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ ip: { limit: 5, ttl: 60000 } })
  create(@Headers('idempotency-key') key: string | undefined, @Req() request: Request, @Body() dto: CreateOrderDto) {
    // The session id is the server-issued guest identity for idempotency (m4-contract §6): never the
    // body, never the raw IP, and never an account binding for logged-in shoppers.
    return this.orders.create({ key, sessionId: request.sessionID, dto });
  }
}

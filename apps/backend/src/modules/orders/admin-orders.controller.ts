import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { AdminOrdersService } from './admin-orders.service.js';
import { AdminOrdersQuery } from './dto/admin-orders-query.dto.js';

@Controller('admin/orders')
@UseGuards(SessionGuard, RolesGuard)
@Roles('ADMIN')
export class AdminOrdersController {
  constructor(@Inject(AdminOrdersService) private readonly orders: AdminOrdersService) {}

  @Get()
  list(@Query() query: AdminOrdersQuery) {
    return this.orders.list(query);
  }
}

import { Body, Controller, Get, Headers, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { UserIdentity } from '../auth/identity.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { AdminOrderNotesService } from './admin-order-notes.service.js';
import { AdminOrderTransitionsService } from './admin-order-transitions.service.js';
import { AdminOrdersService } from './admin-orders.service.js';
import { AdminOrderCancelDto } from './dto/admin-order-cancel.dto.js';
import { AdminOrderDeliverDto } from './dto/admin-order-deliver.dto.js';
import { AdminOrderNoteDto } from './dto/admin-order-note.dto.js';
import { AdminOrderShipDto } from './dto/admin-order-ship.dto.js';
import { AdminOrderTransitionDto } from './dto/admin-order-transition.dto.js';
import { AdminOrdersQuery } from './dto/admin-orders-query.dto.js';

@Controller('admin/orders')
@UseGuards(SessionGuard, RolesGuard)
@Roles('ADMIN')
export class AdminOrdersController {
  constructor(
    @Inject(AdminOrdersService) private readonly orders: AdminOrdersService,
    @Inject(AdminOrderNotesService) private readonly notes: AdminOrderNotesService,
    @Inject(AdminOrderTransitionsService) private readonly transitions: AdminOrderTransitionsService,
  ) {}

  @Get()
  list(@Query() query: AdminOrdersQuery) {
    return this.orders.list(query);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.detail(id);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  confirm(@CurrentUser() user: UserIdentity, @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key: string | undefined, @Body() dto: AdminOrderTransitionDto) {
    return this.transitions.confirm(user.id, id, key, dto.expectedVersion);
  }

  @Post(':id/pack')
  @HttpCode(200)
  pack(@CurrentUser() user: UserIdentity, @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key: string | undefined, @Body() dto: AdminOrderTransitionDto) {
    return this.transitions.pack(user.id, id, key, dto.expectedVersion);
  }

  @Post(':id/ship')
  @HttpCode(200)
  ship(@CurrentUser() user: UserIdentity, @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key: string | undefined, @Body() dto: AdminOrderShipDto) {
    return this.transitions.ship(user.id, id, key, dto.expectedVersion, dto.trackingNumber);
  }

  @Post(':id/deliver')
  @HttpCode(200)
  deliver(@CurrentUser() user: UserIdentity, @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key: string | undefined, @Body() dto: AdminOrderDeliverDto) {
    return this.transitions.deliver(user.id, id, key, dto.expectedVersion, dto.deliveredAt);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: UserIdentity, @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key: string | undefined, @Body() dto: AdminOrderCancelDto) {
    return this.transitions.cancel(user.id, id, key, dto.expectedVersion, dto.reason);
  }

  @Post(':id/notes')
  addNote(@CurrentUser() user: UserIdentity, @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key: string | undefined, @Body() dto: AdminOrderNoteDto) {
    return this.notes.add(user.id, id, key, dto.body);
  }
}

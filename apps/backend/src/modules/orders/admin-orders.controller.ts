import { Body, Controller, Get, Headers, Inject, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { UserIdentity } from '../auth/identity.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { AdminOrderNotesService } from './admin-order-notes.service.js';
import { AdminOrdersService } from './admin-orders.service.js';
import { AdminOrderNoteDto } from './dto/admin-order-note.dto.js';
import { AdminOrdersQuery } from './dto/admin-orders-query.dto.js';

@Controller('admin/orders')
@UseGuards(SessionGuard, RolesGuard)
@Roles('ADMIN')
export class AdminOrdersController {
  constructor(
    @Inject(AdminOrdersService) private readonly orders: AdminOrdersService,
    @Inject(AdminOrderNotesService) private readonly notes: AdminOrderNotesService,
  ) {}

  @Get()
  list(@Query() query: AdminOrdersQuery) {
    return this.orders.list(query);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.detail(id);
  }

  @Post(':id/notes')
  addNote(@CurrentUser() user: UserIdentity, @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key: string | undefined, @Body() dto: AdminOrderNoteDto) {
    return this.notes.add(user.id, id, key, dto.body);
  }
}

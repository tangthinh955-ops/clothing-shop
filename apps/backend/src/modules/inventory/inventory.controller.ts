import { Body, Controller, Get, Headers, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { UserIdentity } from '../auth/identity.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { AdjustmentDto, InventoryQuery } from './dto/inventory.dto.js';
import { InventoryService } from './inventory.service.js';

@Controller('admin/inventory')
@UseGuards(SessionGuard, RolesGuard)
@Roles('ADMIN')
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly inventory: InventoryService) {}

  @Get()
  list(@Query() query: InventoryQuery) {
    return this.inventory.list(query);
  }

  @Get('movements')
  movements(@Query() query: InventoryQuery) {
    return this.inventory.movements(query);
  }

  @Post('adjustments')
  adjust(@CurrentUser() user: UserIdentity, @Headers('idempotency-key') key: string | undefined, @Body() dto: AdjustmentDto) {
    return this.inventory.adjust(user.id, key, dto);
  }
}

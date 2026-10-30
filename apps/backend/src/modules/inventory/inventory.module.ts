import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryOperationsService } from './inventory-operations.service.js';
import { InventoryService } from './inventory.service.js';

@Module({
  imports: [AuthModule],
  providers: [InventoryService, InventoryOperationsService],
  controllers: [InventoryController],
  exports: [InventoryService, InventoryOperationsService],
})
export class InventoryModule {}

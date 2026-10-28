import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminAccessController, UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({ imports: [AuthModule], controllers: [UsersController, AdminAccessController], providers: [UsersService] })
export class UsersModule {}

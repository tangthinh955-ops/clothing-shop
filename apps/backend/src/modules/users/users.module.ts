import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminAccessController, UsersController } from './users.controller.js';

@Module({ imports: [AuthModule], controllers: [UsersController, AdminAccessController] })
export class UsersModule {}

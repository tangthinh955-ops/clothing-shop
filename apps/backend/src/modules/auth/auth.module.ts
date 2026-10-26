import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionGuard } from './session.guard.js';
import { RolesGuard } from './roles.guard.js';
import { SessionResources } from './session.resources.js';

@Module({ imports: [MailModule], controllers: [AuthController], providers: [AuthService, SessionGuard, RolesGuard, SessionResources],
  exports: [SessionGuard, RolesGuard, SessionResources] })
export class AuthModule {}

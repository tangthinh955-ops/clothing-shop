import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  @Get('live') live() { return { status: 'ok' }; }
  @Get('ready') async ready() {
    try { await this.db.$queryRaw`SELECT 1`; return { status: 'ok' }; }
    catch { throw new ServiceUnavailableException({ code: 'NOT_READY', message: 'Dịch vụ chưa sẵn sàng.' }); }
  }
}

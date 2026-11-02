import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { OrderNotificationsService } from './order-notifications.service.js';

const INTERVAL_MS = 60000;

/**
 * Runs the notice retry pass once at startup, to catch up after a restart or deploy, then every minute.
 * All state lives in the database, so losing this timer loses nothing. Started from main.ts only: tests
 * call the pass themselves and never race a background run.
 */
@Injectable()
export class OrderNotificationWorker implements OnModuleDestroy {
  private readonly logger = new Logger(OrderNotificationWorker.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(@Inject(OrderNotificationsService) private readonly notifications: OrderNotificationsService) {}

  start(): void {
    if (this.timer) return;
    void this.run();
    this.timer = setInterval(() => void this.run(), INTERVAL_MS);
    // A pending retry pass is no reason to keep the process alive during shutdown.
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.notifications.processDue(new Date());
    } catch {
      this.logger.warn('ORDER_NOTICE_WORKER_FAILED');
    } finally {
      this.running = false;
    }
  }
}

import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderNotificationWorker } from './order-notification-worker.service.js';
import type { OrderNotificationsService } from './order-notifications.service.js';

describe('OrderNotificationWorker', () => {
  const MINUTE = 60000;

  function workerWith(processDue: () => Promise<void>) {
    return new OrderNotificationWorker({ processDue: vi.fn(processDue) } as unknown as OrderNotificationsService);
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('catches up once on start, then runs every minute', async () => {
    const processDue = vi.fn(async () => undefined);
    const worker = workerWith(processDue);
    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(processDue).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3 * MINUTE);
    expect(processDue).toHaveBeenCalledTimes(4);
    worker.onModuleDestroy();
  });

  it('does not start a second timer when started twice', async () => {
    const processDue = vi.fn(async () => undefined);
    const worker = workerWith(processDue);
    worker.start();
    worker.start();
    await vi.advanceTimersByTimeAsync(MINUTE);
    expect(processDue).toHaveBeenCalledTimes(2);
    worker.onModuleDestroy();
  });

  it('skips a run while the previous one is still going', async () => {
    let finish: () => void = () => undefined;
    const processDue = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const worker = workerWith(processDue);
    worker.start();
    await vi.advanceTimersByTimeAsync(3 * MINUTE);
    expect(processDue).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(MINUTE);
    expect(processDue).toHaveBeenCalledTimes(2);
    finish();
    worker.onModuleDestroy();
  });

  it('survives a failed run and tries again on the next one', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const processDue = vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error('database gone')).mockResolvedValue(undefined);
    const worker = workerWith(processDue);
    worker.start();
    await vi.advanceTimersByTimeAsync(MINUTE);
    expect(processDue).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith('ORDER_NOTICE_WORKER_FAILED');
    worker.onModuleDestroy();
  });

  it('stops when the application shuts down', async () => {
    const processDue = vi.fn(async () => undefined);
    const worker = workerWith(processDue);
    worker.start();
    await vi.advanceTimersByTimeAsync(0);
    worker.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    expect(processDue).toHaveBeenCalledTimes(1);
  });
});

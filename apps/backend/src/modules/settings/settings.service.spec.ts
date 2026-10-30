import { BadRequestException, HttpException } from '@nestjs/common';
import { describe, expect, it, vi, type Mock } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { SettingsService } from './settings.service.js';

const savedRow = { id: 'default', shippingFeeVnd: 25000, bankDeadlineMinutes: 90, bankName: 'Ngân hàng thử', bankBin: '970422',
  bankAccountNumber: '0123456789', bankAccountName: 'CONG TY THU', version: 2 };

// The mock only carries findUnique: any write attempt inside a GET view would crash the call and fail the test.
function serviceWith(findUnique: () => Promise<unknown>) {
  const db = { shopSettings: { findUnique: vi.fn(findUnique) } };
  const service = new SettingsService(db as unknown as PrismaService);
  return { service, findUnique: db.shopSettings.findUnique };
}

describe('SettingsService read-only views', () => {
  it('returns safe defaults when no row exists and never writes to the database', async () => {
    const { service, findUnique } = serviceWith(async () => null);
    await expect(service.adminView()).resolves.toEqual({ shippingFeeVnd: 30000, bankDeadlineMinutes: 120,
      bankName: null, bankBin: null, bankAccountNumber: null, bankAccountName: null, version: 0 });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'default' } });
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('returns the saved row through the admin view', async () => {
    const { service } = serviceWith(async () => savedRow);
    await expect(service.adminView()).resolves.toEqual({ shippingFeeVnd: 25000, bankDeadlineMinutes: 90, bankName: 'Ngân hàng thử',
      bankBin: '970422', bankAccountNumber: '0123456789', bankAccountName: 'CONG TY THU', version: 2 });
  });

  it('public view allowlists only the fee and the bank deadline', async () => {
    const { service } = serviceWith(async () => savedRow);
    await expect(service.publicView()).resolves.toEqual({ shippingFeeVnd: 25000, bankDeadlineMinutes: 90 });
  });

  it('propagates database errors instead of serving defaults', async () => {
    const { service } = serviceWith(async () => { throw new Error('database unavailable'); });
    await expect(service.adminView()).rejects.toThrow('database unavailable');
    await expect(service.publicView()).rejects.toThrow('database unavailable');
  });
});

const failureOf = async (run: () => Promise<unknown>) => {
  try { await run(); } catch (error) { return error; }
  throw new Error('Expected the call to fail, but it resolved.');
};

const adminId = '11111111-1111-4111-8111-111111111111';
const idempotencyKey = 'key-0123456789abcdef';
const p2002 = Object.assign(new Error('Unique violation'), { code: 'P2002' });

const dto = (overrides: Partial<Record<string, unknown>> = {}) => ({
  shippingFeeVnd: 50000, bankDeadlineMinutes: 90, bankName: '  Ngân hàng thử  ', bankBin: '970422',
  bankAccountNumber: '0123456789', bankAccountName: 'CONG TY THU', expectedVersion: 2, ...overrides,
}) as unknown as UpdateSettingsDto;

// Row state after a successful save against an existing row (version 2 → 3) and after the very first
// create (version 0 → 1).
const rowAfterUpdate = { ...savedRow, shippingFeeVnd: 50000, bankDeadlineMinutes: 90, version: 3 };
const rowAfterCreate = { ...savedRow, shippingFeeVnd: 50000, bankDeadlineMinutes: 90, version: 1 };

interface Harness {
  service: SettingsService;
  tx: { $queryRaw: Mock; shopSettings: { findUnique: Mock; update: Mock; create: Mock }; idempotencyRecord: { findUnique: Mock; create: Mock } };
  db: { $transaction: Mock; shopSettings: { findUnique: Mock; update: Mock; create: Mock }; idempotencyRecord: { findUnique: Mock; create: Mock } };
  captured: Array<Record<string, unknown>>;
}

/**
 * $transaction runs its callback with an inner tx object; settings/idempotency writes must stay on tx,
 * while the outer db object is only read (the P2002 catch and view fallbacks). saveCreate can model a
 * lost create race by throwing the configured error after the store attempt.
 */
function harness(options: { row?: unknown; outerRow?: unknown; createdRow?: Record<string, unknown>;
  createError?: unknown; commitError?: unknown; recorded?: unknown; outsideRecord?: unknown } = {}): Harness {
  const captured: Array<Record<string, unknown>> = [];
  const recordFind = vi.fn(async () => options.recorded ?? null);
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: 'default' }]),
    shopSettings: {
      findUnique: vi.fn(async () => options.row ?? null),
      update: vi.fn(async () => options.createdRow ?? rowAfterUpdate),
      create: vi.fn(async () => { if (options.createError !== undefined) throw options.createError; return options.createdRow ?? rowAfterCreate; }),
    },
    idempotencyRecord: {
      findUnique: recordFind,
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        if (options.commitError !== undefined) throw options.commitError;
        captured.push(args.data);
        return {};
      }),
    },
  };
  const db = {
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
    shopSettings: {
      findUnique: vi.fn(async () => (options.outerRow !== undefined ? options.outerRow : options.row ?? null)),
      update: vi.fn(),
      create: vi.fn(),
    },
    idempotencyRecord: {
      findUnique: vi.fn(async () => (options.outsideRecord !== undefined ? options.outsideRecord : captured[0] ?? null)),
      create: vi.fn(),
    },
  };
  const service = new SettingsService(db as unknown as PrismaService);
  return { service, tx, db, captured };
}

const writes = (specs: Harness) => ({
  usedTransaction: specs.db.$transaction,
  storedUpdate: specs.tx.shopSettings.update,
  storedCreate: specs.tx.shopSettings.create,
  storedRecord: specs.tx.idempotencyRecord.create,
  outerRowWrite: specs.db.shopSettings.update,
  outerRecordWrite: specs.db.idempotencyRecord.create,
});

describe('SettingsService.update — request shape', () => {
  it.each([undefined, 'short-key-16', 'other/odd!keys'])('blocks the call when the Idempotency-Key is missing or malformed (%s)', async (key) => {
    const specs = harness();
    const failure = await failureOf(() => specs.service.update(adminId, key as string, dto()));
    expect(failure).toBeInstanceOf(BadRequestException);
    expect((failure as HttpException).getResponse()).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(writes(specs).usedTransaction).not.toHaveBeenCalled();
  });

  it('rejects a partially configured bank group naming every missing field', async () => {
    const specs = harness();
    const failure = await failureOf(() => specs.service.update(adminId, idempotencyKey,
      dto({ bankName: 'Ngân hàng thử', bankBin: null, bankAccountNumber: null, bankAccountName: null })));
    const body = (failure as HttpException).getResponse() as { code: string; fieldErrors?: Array<{ field: string }> };
    expect(body).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect((body.fieldErrors ?? []).map((entry) => entry.field).sort()).toEqual(['bankAccountName', 'bankAccountNumber', 'bankBin']);
    expect(writes(specs).usedTransaction).not.toHaveBeenCalled();
  });

  it('accepts a fully blank bank group and stores every bank field as null', async () => {
    const specs = harness({ row: savedRow, createdRow: { ...savedRow, bankName: null, bankBin: null, bankAccountNumber: null, bankAccountName: null, version: 3 } });
    await expect(specs.service.update(adminId, idempotencyKey, dto({ bankName: '   ', bankBin: null, bankAccountNumber: null, bankAccountName: null })))
      .resolves.toMatchObject({ bankName: null, bankBin: null, bankAccountNumber: null, bankAccountName: null, version: 3 });
  });
});

describe('SettingsService.update — versions, replay and races', () => {
  it('stores the normalized content (trimmed text, blank nulls, leading zeros kept) and exactly one version bump', async () => {
    const specs = harness({ row: { ...savedRow, bankName: null, bankBin: null, bankAccountNumber: null, bankAccountName: null } });
    const view = await specs.service.update(adminId, idempotencyKey, dto());
    expect(view).toMatchObject({ shippingFeeVnd: 50000, bankDeadlineMinutes: 90, bankName: 'Ngân hàng thử',
      bankBin: '970422', bankAccountNumber: '0123456789', bankAccountName: 'CONG TY THU', version: 3 });
    const mocks = writes(specs);
    expect(mocks.storedUpdate).toHaveBeenCalledWith({ where: { id: 'default' }, data: { shippingFeeVnd: 50000,
      bankDeadlineMinutes: 90, bankName: 'Ngân hàng thử', bankBin: '970422', bankAccountNumber: '0123456789',
      bankAccountName: 'CONG TY THU', version: { increment: 1 } } });
    expect(mocks.storedRecord).toHaveBeenCalledTimes(1);
    const record = specs.captured[0]!; // saved exactly once, asserted above
    expect(record).toMatchObject({ scope: 'settings.update', identity: `admin:${adminId}`, resourceId: 'default' });
    expect(String(record['requestHash'])).toMatch(/^[a-f0-9]{64}$/);
    expect(record['response']).toEqual(view);
    expect(record['expiresAt']).toBeInstanceOf(Date);
  });

  it('hashes expectedVersion with the content, so the same key with a different version is a conflict', async () => {
    const first = harness({ row: undefined, createdRow: { ...rowAfterCreate } });
    await first.service.update(adminId, idempotencyKey, dto({ expectedVersion: 0 }));
    const committed = { scope: 'settings.update', identity: `admin:${adminId}`, key: idempotencyKey, ...first.captured[0] };
    const retry = harness({ row: { ...savedRow, version: 9 }, recorded: committed });
    const failure = await failureOf(() => retry.service.update(adminId, idempotencyKey, dto({ expectedVersion: 9 })));
    expect((failure as HttpException).getResponse()).toMatchObject({ code: 'CONFLICT' });
    expect(writes(retry).storedUpdate).not.toHaveBeenCalled();
  });

  it('resolves a recorded command as a replay before any version check', async () => {
    const first = harness({ row: undefined, createdRow: { ...rowAfterCreate } });
    await first.service.update(adminId, idempotencyKey, dto({ expectedVersion: 0 }));
    const committed = { scope: 'settings.update', identity: `admin:${adminId}`, key: idempotencyKey, ...first.captured[0] };
    const replay = harness({ row: { ...savedRow, version: 9 }, recorded: committed });
    await expect(replay.service.update(adminId, idempotencyKey, dto({ expectedVersion: 0 })))
      .resolves.toEqual(first.captured[0]!['response']);
    const mocks = writes(replay);
    expect(mocks.storedUpdate).not.toHaveBeenCalled();
    expect(mocks.storedCreate).not.toHaveBeenCalled();
    expect(mocks.storedRecord).not.toHaveBeenCalled();
  });

  it('rejects the same key bound to different content as a conflict without saving', async () => {
    const recorded = { scope: 'settings.update', identity: `admin:${adminId}`, key: idempotencyKey,
      requestHash: 'f'.repeat(64), response: { ...rowAfterUpdate } };
    const specs = harness({ row: savedRow, recorded });
    const failure = await failureOf(() => specs.service.update(adminId, idempotencyKey, dto()));
    expect((failure as HttpException).getResponse()).toMatchObject({ code: 'CONFLICT' });
    expect(writes(specs).storedUpdate).not.toHaveBeenCalled();
  });

  it('blocks a stale expectedVersion without saving, after taking the row lock', async () => {
    const specs = harness({ row: { ...savedRow, version: 9 } });
    const failure = await failureOf(() => specs.service.update(adminId, idempotencyKey, dto({ expectedVersion: 8 })));
    expect((failure as HttpException).getResponse()).toMatchObject({ code: 'CONFLICT' });
    const mocks = writes(specs);
    expect(specs.tx.$queryRaw).toHaveBeenCalledTimes(1); // the version re-read happens under the lock
    expect(mocks.storedUpdate).not.toHaveBeenCalled();
    expect(mocks.storedRecord).not.toHaveBeenCalled();
  });

  it('creates the first row from expectedVersion 0 and saves version 1 without upsert overwrites', async () => {
    const specs = harness({ row: undefined, createdRow: { ...rowAfterCreate } });
    await expect(specs.service.update(adminId, idempotencyKey, dto({ expectedVersion: 0 }))).resolves.toMatchObject({ version: 1 });
    const mocks = writes(specs);
    expect(mocks.storedCreate).toHaveBeenCalledWith({ data: { id: 'default', shippingFeeVnd: 50000, bankDeadlineMinutes: 90,
      bankName: 'Ngân hàng thử', bankBin: '970422', bankAccountNumber: '0123456789', bankAccountName: 'CONG TY THU', version: 1 } });
    expect(mocks.storedUpdate).not.toHaveBeenCalled();
  });

  it('requires expectedVersion 0 when there is no stored row yet', async () => {
    const specs = harness({ row: undefined });
    const failure = await failureOf(() => specs.service.update(adminId, idempotencyKey, dto({ expectedVersion: 5 })));
    expect((failure as HttpException).getResponse()).toMatchObject({ code: 'CONFLICT' });
    expect(writes(specs).storedCreate).not.toHaveBeenCalled();
  });

  it('answers a lost first-create race against the same key with the committed response (replay, not raw P2002)', async () => {
    // A first save records the command so a concurrent identical request can replay it verbatim.
    const winner = harness({ row: undefined, createdRow: { ...rowAfterCreate } });
    await winner.service.update(adminId, idempotencyKey, dto({ expectedVersion: 0 }));
    const committed = { scope: 'settings.update', identity: `admin:${adminId}`, key: idempotencyKey, ...winner.captured[0] };
    const loser = harness({ row: undefined, createError: p2002, outsideRecord: committed });
    await expect(loser.service.update(adminId, idempotencyKey, dto({ expectedVersion: 0 })))
      .resolves.toEqual(winner.captured[0]!['response']);
    expect(writes(loser).storedUpdate).not.toHaveBeenCalled();
    expect(writes(loser).storedRecord).not.toHaveBeenCalled();
  });

  it('answers a lost first-create race against a different key with a conflict, never an upsert', async () => {
    const loser = harness({ row: undefined, outerRow: rowAfterCreate, createError: p2002 });
    const failure = await failureOf(() => loser.service.update(adminId, 'other-key-0123456789abcd', dto({ expectedVersion: 0 })));
    expect((failure as HttpException).getResponse()).toMatchObject({ code: 'CONFLICT' });
    const mocks = writes(loser);
    expect(mocks.outerRowWrite).not.toHaveBeenCalled();
    expect(mocks.outerRecordWrite).not.toHaveBeenCalled();
  });

  it('fails as one unit: a broken command record propagates and leaves no outer writes behind', async () => {
    const specs = harness({ row: savedRow, commitError: new Error('mô phỏng lỗi ghi cấu hình') });
    await expect(specs.service.update(adminId, idempotencyKey, dto())).rejects.toThrow('mô phỏng lỗi ghi cấu hình');
    const mocks = writes(specs);
    expect(mocks.usedTransaction).toHaveBeenCalledTimes(1); // both writes live inside the one transaction
    expect(mocks.storedUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.storedRecord).toHaveBeenCalledTimes(1);
    expect(specs.captured).toHaveLength(0); // nothing was committed ...
    expect(mocks.outerRowWrite).not.toHaveBeenCalled(); // ... and nothing was re-written outside the tx
    expect(mocks.outerRecordWrite).not.toHaveBeenCalled();
  });
});

import { Logger, type ArgumentsHost } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from './http-exception.filter.js';

function fakeHttpHost() {
  const response = {
    locals: { requestId: 'request-1' },
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(value: unknown) {
      this.body = value;
      return this;
    },
  };
  const http = { getRequest: () => ({ method: 'POST' }), getResponse: () => response };
  // The filter only reads the HTTP request/response pair from the host.
  const host = { switchToHttp: () => http } as unknown as ArgumentsHost;
  return { response, host };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HttpExceptionFilter', () => {
  it('logs the cause of an unexpected error but returns only a safe body', () => {
    const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { response, host } = fakeHttpHost();
    const cause = new Error('db connection refused');

    new HttpExceptionFilter().catch(cause, host);

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      code: 'SYSTEM_ERROR',
      message: 'Dịch vụ gặp lỗi. Vui lòng thử lại sau.',
      fieldErrors: [],
      requestId: 'request-1',
    });
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('request-1'), cause.stack);
  });
});

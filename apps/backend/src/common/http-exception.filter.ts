import { ArgumentsHost, Catch, HttpException, Logger, type ExceptionFilter } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  catch(error: unknown, host: ArgumentsHost): void {
    const req = host.switchToHttp().getRequest<Request>();
    const res = host.switchToHttp().getResponse<Response>();
    let status = error instanceof HttpException ? error.getStatus() : 500;
    if (error instanceof Error && 'type' in error && error.type === 'entity.too.large') status = 413;
    if (error instanceof SyntaxError && 'type' in error && error.type === 'entity.parse.failed') status = 400;
    const value = error instanceof HttpException ? error.getResponse() : undefined;
    const body = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const defaultCode = status === 400 ? 'VALIDATION_ERROR' : status === 401 ? 'AUTH_REQUIRED' : status === 403 ? 'FORBIDDEN'
      : status === 404 ? 'NOT_FOUND' : status === 429 ? 'RATE_LIMITED' : status === 413 ? 'PAYLOAD_TOO_LARGE' : 'SYSTEM_ERROR';
    const defaultMessage = status === 429 ? 'Thao tác quá nhanh. Vui lòng thử lại sau.' : status < 500 ? 'Yêu cầu chưa hợp lệ.' : 'Dịch vụ gặp lỗi. Vui lòng thử lại sau.';
    const requestId = typeof res.locals['requestId'] === 'string' ? res.locals['requestId'] as string : randomUUID();
    if (status >= 500) {
      // Unexpected errors keep their stack in the server log only; the response stays generic.
      const cause = error instanceof HttpException ? undefined : error instanceof Error ? error.stack : String(error);
      this.logger.error(JSON.stringify({ requestId, code: defaultCode, method: req.method }), cause);
    }
    res.status(status).json({ code: typeof body['code'] === 'string' ? body['code'] : defaultCode,
      message: typeof body['message'] === 'string' ? body['message'] : defaultMessage,
      fieldErrors: Array.isArray(body['fieldErrors']) ? body['fieldErrors'] : [], requestId });
  }
}

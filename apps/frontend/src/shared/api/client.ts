export interface FieldError { field: string; message: string }
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly fieldErrors: FieldError[] = [],
  ) { super(message); }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  idempotencyKey?: string;
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

async function send<T>(path: string, options: RequestOptions, csrfToken?: string): Promise<T> {
  const payload = options.body;
  const body = typeof FormData !== 'undefined' && payload instanceof FormData
    ? payload : payload === undefined ? undefined : JSON.stringify(payload);
  const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method: options.method ?? 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: { ...(body !== undefined && !multipart ? { 'Content-Type': 'application/json' } : {}),
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}) },
      ...(body !== undefined ? { body } : {}),
    });
  } catch { throw new ApiError('NETWORK_ERROR', 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.', 0); }
  const data: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = object(data);
    const fieldErrors = Array.isArray(error?.['fieldErrors']) ? error['fieldErrors'].flatMap((item: unknown) => {
      const entry = object(item);
      return typeof entry?.['field'] === 'string' && typeof entry['message'] === 'string'
        ? [{ field: entry['field'], message: entry['message'] }] : [];
    }) : [];
    throw new ApiError(typeof error?.['code'] === 'string' ? error['code'] : 'SERVICE_UNAVAILABLE',
      typeof error?.['message'] === 'string' ? error['message'] : 'Dịch vụ chưa sẵn sàng. Vui lòng thử lại sau ít phút.',
      response.status, fieldErrors);
  }
  if (response.status !== 204 && data === undefined) throw new ApiError('INVALID_RESPONSE', 'Chưa đọc được phản hồi. Vui lòng thử lại.', response.status);
  // The HTTP boundary is typed by each API file. Runtime DTO validation remains server-side.
  return data as T;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (options.method && options.method !== 'GET') {
    const csrf = await send<{ csrfToken: string }>('/auth/csrf', {});
    return send<T>(path, options, csrf.csrfToken);
  }
  return send<T>(path, options);
}

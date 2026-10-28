import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, request } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('API boundary', () => {
  it('preserves a JSON mutation and its caller-provided idempotency key', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ csrfToken: 'csrf-json' })).mockResolvedValueOnce(Response.json({ onHand: 10 }));
    vi.stubGlobal('fetch', fetcher);
    const body = { variantId: 'variant-id', delta: 10, reason: 'Nhập thử', expectedVersion: 0 };
    await request('/admin/inventory/adjustments', { method: 'POST', body, idempotencyKey: 'same-operation-123456789' });
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({ body: JSON.stringify(body), headers: {
      'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf-json', 'Idempotency-Key': 'same-operation-123456789',
    } });
  });
  it('sends multipart with CSRF without overriding the browser boundary and preserves an idempotency key', async () => {
    const body = new FormData(); body.append('file', new Blob(['image']), 'image.png');
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ csrfToken: 'csrf-token' })).mockResolvedValueOnce(Response.json({ id: 'uploaded' }));
    vi.stubGlobal('fetch', fetcher);
    await request('/admin/uploads/images', { method: 'POST', body, idempotencyKey: 'operation-123456789' });
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({ body, headers: { 'X-CSRF-Token': 'csrf-token', 'Idempotency-Key': 'operation-123456789' } });
    expect(fetcher.mock.calls[1]?.[1].headers).not.toHaveProperty('Content-Type');
  });
  it('does not turn a cold-start HTML response into a successful JSON result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>starting</html>', { status: 503 })));
    await expect(request('/me')).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE', status: 503 });
  });
  it('preserves structured validation errors without leaking infrastructure text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      code: 'VALIDATION_ERROR', message: 'Thông tin chưa hợp lệ.',
      fieldErrors: [{ field: 'email', message: 'Email chưa hợp lệ.' }], requestId: 'safe-id',
    }, { status: 400 })));
    try { await request('/me'); } catch (error: unknown) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ code: 'VALIDATION_ERROR', fieldErrors: [{ field: 'email', message: 'Email chưa hợp lệ.' }] });
      return;
    }
    throw new Error('Expected a rejected response');
  });
  it('does not retry a mutation whose response was lost', async () => {
    let attempts = 0;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/csrf')) return Response.json({ csrfToken: 'csrf-token' });
      attempts += 1;
      throw new TypeError('network disconnected');
    });
    await expect(request('/auth/login', { method: 'POST', body: { email: 'a@example.test', password: 'secret' } })).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(attempts).toBe(1);
  });
});

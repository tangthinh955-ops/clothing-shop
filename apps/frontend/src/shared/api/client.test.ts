import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, request } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('API boundary', () => {
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

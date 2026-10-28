import { StrictMode, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useLinkToken } from './useLinkToken';

function renderToken(path: string, strict = false) {
  function Wrapper({ children }: { children: ReactNode }) {
    const router = <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
    return strict ? <StrictMode>{router}</StrictMode> : router;
  }
  return renderHook(() => ({ token: useLinkToken(), location: useLocation(), navigate: useNavigate() }), { wrapper: Wrapper });
}

describe('auth link token lifecycle', () => {
  it('captures the fragment, removes it from the address and preserves query parameters', () => {
    const { result } = renderToken('/verify-email?source=mail#token=first-token');
    expect(result.current.token).toBe('first-token');
    expect(result.current.location.hash).toBe('');
    expect(result.current.location.search).toBe('?source=mail');
  });

  it('uses a new token when another link opens on the mounted page', async () => {
    const { result } = renderToken('/reset-password#token=first-token');
    await act(async () => { await result.current.navigate('/reset-password#token=second-token'); });
    expect(result.current.token).toBe('second-token');
    expect(result.current.location.hash).toBe('');
  });

  it('clears the previous token when a new auth link explicitly has an empty token', async () => {
    const { result } = renderToken('/verify-email#token=first-token');
    await act(async () => { await result.current.navigate('/verify-email#token='); });
    expect(result.current.token).toBe('');
  });

  it('preserves the current token when the skip link navigates to the main-content anchor', async () => {
    const { result } = renderToken('/verify-email#token=first-token');
    await act(async () => { await result.current.navigate('/verify-email#main-content'); });
    expect(result.current.token).toBe('first-token');
    expect(result.current.location.hash).toBe('#main-content');
  });

  it('retains the captured token under StrictMode', () => {
    const { result } = renderToken('/verify-email#token=strict-token', true);
    expect(result.current.token).toBe('strict-token');
    expect(result.current.location.hash).toBe('');
  });
});

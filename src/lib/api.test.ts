import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('API failure handling', () => {
  it('explains network failures without exposing browser internals', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api('/session')).rejects.toThrow('Cannot connect to JobFit Lab');
  });

  it.each([200, 502])('rejects an HTML response with HTTP %s as unavailable', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>Proxy error</html>', { status })),
    );
    await expect(api('/profile')).rejects.toMatchObject({
      message: 'The service is unavailable. Please try again.',
      status,
    });
  });

  it('preserves authentication status and the server message for session recovery', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ error: 'Sign in required' }, { status: 401 })),
    );
    await expect(api('/profile', {}, 'PUT')).rejects.toMatchObject({
      message: 'Sign in required',
      status: 401,
    });
  });

  it('handles null or unexpected errors without crashing the error handler', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(null, { status: 401 }))
      .mockResolvedValueOnce(
        Response.json({ error: { internal: 'private details' } }, { status: 500 }),
      );
    vi.stubGlobal('fetch', fetch);
    await expect(api('/profile')).rejects.toMatchObject({
      message: 'Your session has expired. Please sign in again.',
      status: 401,
    });
    await expect(api('/profile')).rejects.toMatchObject({
      message: 'The request could not be completed. Please try again.',
      status: 500,
    });
  });

  it('retains same-origin cookies and sends the requested method and JSON body', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ user: null }))
      .mockResolvedValueOnce(Response.json({ fullName: 'Candidate' }));
    vi.stubGlobal('fetch', fetch);
    await expect(api('/session')).resolves.toEqual({ user: null });
    await expect(api('/profile', { fullName: 'Candidate' }, 'PUT')).resolves.toEqual({
      fullName: 'Candidate',
    });
    expect(fetch.mock.calls).toEqual([
      ['/api/session', { credentials: 'same-origin' }],
      [
        '/api/profile',
        {
          credentials: 'same-origin',
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: '{"fullName":"Candidate"}',
        },
      ],
    ]);
  });
});

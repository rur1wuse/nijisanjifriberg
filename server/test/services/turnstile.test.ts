import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../src/config';
import { TurnstileVerificationError, verifyTurnstile } from '../../src/services/turnstile';

const original = { ...config.turnstile };
const fetchMock = vi.fn();

function jsonResponse(payload: unknown): Response {
  return { ok: true, json: async () => payload } as Response;
}

beforeEach(() => {
  Object.assign(config.turnstile, {
    enabled: true,
    siteKey: 'site-key',
    secretKey: 'secret-key',
    verifyUrl: 'https://turnstile.test/siteverify',
    timeoutMs: 1_000,
  });
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  Object.assign(config.turnstile, original);
  vi.unstubAllGlobals();
});

describe('verifyTurnstile', () => {
  it('posts the token and remote IP to siteverify', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, action: 'register' }));

    await expect(
      verifyTurnstile('token', { remoteIp: '203.0.113.10', action: 'register' })
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(config.turnstile.verifyUrl);
    const body = init.body as URLSearchParams;
    expect(body.get('secret')).toBe('secret-key');
    expect(body.get('response')).toBe('token');
    expect(body.get('remoteip')).toBe('203.0.113.10');
  });

  it('requires a token when Turnstile is enabled', async () => {
    await expect(verifyTurnstile(undefined)).rejects.toMatchObject({ code: 'TURNSTILE_REQUIRED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a failed siteverify response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: false, 'error-codes': ['invalid-input-response'] }));

    await expect(verifyTurnstile('token')).rejects.toBeInstanceOf(TurnstileVerificationError);
  });

  it('rejects a token issued for another action', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, action: 'login' }));

    await expect(verifyTurnstile('token', { action: 'register' })).rejects.toMatchObject({
      code: 'TURNSTILE_FAILED',
    });
  });

  it('turns network failures into TURNSTILE_FAILED', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(verifyTurnstile('token')).rejects.toMatchObject({ code: 'TURNSTILE_FAILED' });
  });

  it('is a no-op when Turnstile is not configured', async () => {
    config.turnstile.enabled = false;

    await expect(verifyTurnstile(undefined)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

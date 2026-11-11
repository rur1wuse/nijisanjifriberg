import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../src/config';
import { verifyRegistrationCaptcha } from '../../src/services/captcha';

const originalTurnstile = { ...config.turnstile };
const originalGeeTest = { ...config.geetest };
const fetchMock = vi.fn();
const geeTestProof = {
  lot_number: 'lot',
  captcha_output: 'output',
  pass_token: 'pass',
  gen_time: '1',
};

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
  Object.assign(config.geetest, {
    enabled: true,
    captchaId: 'captcha-id',
    privateKey: 'private-key',
    validateUrl: 'https://geetest.test/validate',
    timeoutMs: 1_000,
  });
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  Object.assign(config.turnstile, originalTurnstile);
  Object.assign(config.geetest, originalGeeTest);
  vi.unstubAllGlobals();
});

describe('verifyRegistrationCaptcha', () => {
  it('prefers a valid Turnstile token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, action: 'register' }));

    await expect(
      verifyRegistrationCaptcha({ turnstileToken: 'token', geeTest: geeTestProof })
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('turnstile');
  });

  it('accepts a GeeTest proof when the Turnstile token is absent', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ result: 'success' }));

    await expect(verifyRegistrationCaptcha({ geeTest: geeTestProof })).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('geetest');
  });

  it('falls back to GeeTest when Turnstile rejects the token', async () => {
    fetchMock.mockImplementation(async (url: string | URL) => (
      String(url).includes('turnstile')
        ? jsonResponse({ success: false })
        : jsonResponse({ result: 'success' })
    ));

    await expect(
      verifyRegistrationCaptcha({ turnstileToken: 'bad-token', geeTest: geeTestProof })
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('requires Turnstile when both are enabled but neither proof is present', async () => {
    await expect(verifyRegistrationCaptcha({})).rejects.toMatchObject({ code: 'TURNSTILE_REQUIRED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires Turnstile when GeeTest is not configured', async () => {
    config.geetest.enabled = false;

    await expect(verifyRegistrationCaptcha({})).rejects.toMatchObject({ code: 'TURNSTILE_REQUIRED' });
  });

  it('requires GeeTest when Turnstile is not configured', async () => {
    config.turnstile.enabled = false;

    await expect(verifyRegistrationCaptcha({})).rejects.toMatchObject({ code: 'GEETEST_REQUIRED' });
  });

  it('propagates Turnstile failure when no GeeTest proof is available', async () => {
    config.geetest.enabled = false;
    fetchMock.mockResolvedValue(jsonResponse({ success: false }));

    await expect(verifyRegistrationCaptcha({ turnstileToken: 'bad-token' })).rejects.toMatchObject({
      code: 'TURNSTILE_FAILED',
    });
  });

  it('is a no-op when neither provider is configured', async () => {
    config.turnstile.enabled = false;
    config.geetest.enabled = false;

    await expect(verifyRegistrationCaptcha({})).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

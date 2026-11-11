import { config } from '../config';

export class TurnstileVerificationError extends Error {
  constructor(public readonly code: 'TURNSTILE_REQUIRED' | 'TURNSTILE_FAILED') {
    super(code);
  }
}

interface VerifyOptions {
  remoteIp?: string;
  action?: string;
}

/** Verify a Cloudflare Turnstile token on the server. Disabled environments remain usable locally. */
export async function verifyTurnstile(
  token: string | null | undefined,
  options: VerifyOptions = {}
): Promise<void> {
  if (!config.turnstile.enabled) return;
  if (!token) throw new TurnstileVerificationError('TURNSTILE_REQUIRED');

  const body = new URLSearchParams({
    secret: config.turnstile.secretKey,
    response: token,
  });
  if (options.remoteIp) body.set('remoteip', options.remoteIp);

  try {
    const response = await fetch(config.turnstile.verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(config.turnstile.timeoutMs),
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const result = await response.json() as {
      success?: boolean;
      action?: string;
      'error-codes'?: string[];
    };
    if (!result.success) {
      throw new Error(`REJECTED:${(result['error-codes'] ?? []).join(',')}`);
    }
    if (options.action && result.action && result.action !== options.action) {
      throw new Error('ACTION_MISMATCH');
    }
  } catch (error) {
    console.warn('[turnstile:verify]', error instanceof Error ? error.message : error);
    throw new TurnstileVerificationError('TURNSTILE_FAILED');
  }
}

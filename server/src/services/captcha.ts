import { config } from '../config';
import { GeeTestVerificationError, verifyGeeTest } from './geetest';
import type { GeeTestProof } from './geetest';
import { TurnstileVerificationError, verifyTurnstile } from './turnstile';

export interface RegistrationCaptchaInput {
  turnstileToken?: string;
  geeTest?: Partial<GeeTestProof> | null;
}

function hasGeeTestProof(proof: Partial<GeeTestProof> | null | undefined): boolean {
  return Boolean(proof?.lot_number && proof.captcha_output && proof.pass_token && proof.gen_time);
}

/**
 * Registration accepts Turnstile first and falls back to GeeTest for China networks.
 * If both are configured, a failed Turnstile proof may still be completed with a GeeTest proof.
 */
export async function verifyRegistrationCaptcha(
  input: RegistrationCaptchaInput,
  remoteIp?: string
): Promise<void> {
  let turnstileError: TurnstileVerificationError | null = null;

  if (config.turnstile.enabled && input.turnstileToken) {
    try {
      await verifyTurnstile(input.turnstileToken, { remoteIp, action: 'register' });
      return;
    } catch (error) {
      if (!(error instanceof TurnstileVerificationError)) throw error;
      turnstileError = error;
    }
  }

  if (config.geetest.enabled && hasGeeTestProof(input.geeTest)) {
    await verifyGeeTest(input.geeTest);
    return;
  }

  if (turnstileError) throw turnstileError;
  if (config.turnstile.enabled) throw new TurnstileVerificationError('TURNSTILE_REQUIRED');
  if (config.geetest.enabled) throw new GeeTestVerificationError('GEETEST_REQUIRED');
}

export interface CaptchaConfig {
  turnstile: { enabled: boolean; siteKey?: string };
  geetest: { enabled: boolean; captchaId?: string };
}

let configPromise: Promise<CaptchaConfig> | null = null;

export async function getCaptchaConfig(): Promise<CaptchaConfig> {
  if (configPromise) return configPromise;
  configPromise = fetch('/api/runtime-config', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
    .then(async (response) => {
      if (!response.ok) throw new Error('CAPTCHA_CONFIG_FAILED');
      const payload = await response.json() as {
        turnstile?: { enabled?: unknown; siteKey?: unknown };
        geetest?: { enabled?: unknown; captchaId?: unknown };
      };
      const turnstileSiteKey = typeof payload.turnstile?.siteKey === 'string'
        ? payload.turnstile.siteKey.trim()
        : '';
      const geetestCaptchaId = typeof payload.geetest?.captchaId === 'string'
        ? payload.geetest.captchaId.trim()
        : '';
      const turnstileEnabled = Boolean(payload.turnstile?.enabled);
      const geetestEnabled = Boolean(payload.geetest?.enabled);
      if (turnstileEnabled && !turnstileSiteKey) throw new Error('CAPTCHA_CONFIG_FAILED');
      if (geetestEnabled && !geetestCaptchaId) throw new Error('CAPTCHA_CONFIG_FAILED');
      return {
        turnstile: { enabled: turnstileEnabled, ...(turnstileSiteKey ? { siteKey: turnstileSiteKey } : {}) },
        geetest: { enabled: geetestEnabled, ...(geetestCaptchaId ? { captchaId: geetestCaptchaId } : {}) },
      };
    })
    .catch((error) => {
      configPromise = null;
      throw error;
    });
  return configPromise;
}

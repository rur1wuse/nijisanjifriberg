import { CSSProperties, FormEvent, useEffect, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import Page from '../components/Page';
import { api, errMsg } from '../api/client';
import { useAuth } from '../store/auth';
import { closeSocket, getSocket } from '../api/socket';
import { markAuthenticated } from '../api/session';
import { toast } from '../components/Toast';
import { useTranslation } from 'react-i18next';
import { getPowProgress, subscribePowProgress } from '../api/pow';
import { requestGeeTest } from '../api/geetest';
import { getCaptchaConfig, type CaptchaConfig } from '../api/captcha';
import TurnstileWidget from '../components/TurnstileWidget';

const INACTIVE_POW_PROGRESS = { active: false, percent: 0 };
const USERNAME_PATTERN = /^[\w一-龥-]+$/;

type RegisterField = 'username' | 'password' | 'confirmPassword';
type RegisterErrors = Partial<Record<RegisterField, string>>;
type CaptchaMode = 'turnstile' | 'geetest' | 'none';

export default function Login() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registerErrors, setRegisterErrors] = useState<RegisterErrors>({});
  const [loading, setLoading] = useState(false);
  const [captchaConfig, setCaptchaConfig] = useState<CaptchaConfig | null>(null);
  const [captchaMode, setCaptchaMode] = useState<CaptchaMode>('none');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [turnstileUnavailable, setTurnstileUnavailable] = useState(false);
  const [captchaNotice, setCaptchaNotice] = useState<string | null>(null);
  const powProgress = useSyncExternalStore(
    subscribePowProgress,
    getPowProgress,
    () => INACTIVE_POW_PROGRESS
  );
  const setUser = useAuth((s) => s.setUser);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    getCaptchaConfig()
      .then((config) => {
        if (cancelled) return;
        setCaptchaConfig(config);
        setCaptchaMode(config.turnstile.enabled ? 'turnstile' : config.geetest.enabled ? 'geetest' : 'none');
      })
      .catch(() => {
        if (cancelled) return;
        setCaptchaConfig({ turnstile: { enabled: false }, geetest: { enabled: false } });
        setCaptchaMode('none');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTurnstileToken = (token: string | null) => {
    setTurnstileToken(token);
    if (token) {
      setTurnstileUnavailable(false);
      setCaptchaNotice(null);
    }
  };

  const resetTurnstile = () => {
    setTurnstileToken(null);
    setTurnstileUnavailable(false);
    setCaptchaNotice(null);
    setTurnstileResetKey((key) => key + 1);
  };

  const handleTurnstileUnavailable = () => {
    setTurnstileToken(null);
    setTurnstileUnavailable(true);
    if (captchaConfig?.geetest.enabled) {
      setCaptchaMode('geetest');
      setCaptchaNotice(t('auth.turnstileUnavailable'));
    }
  };

  const switchToGeeTest = () => {
    setCaptchaMode('geetest');
    setTurnstileToken(null);
    setTurnstileUnavailable(false);
    setCaptchaNotice(null);
  };

  const switchToTurnstile = () => {
    setCaptchaMode('turnstile');
    setTurnstileToken(null);
    setTurnstileUnavailable(false);
    setCaptchaNotice(null);
    setTurnstileResetKey((key) => key + 1);
  };

  const clearRegisterError = (field: RegisterField) => {
    setRegisterErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (mode === 'register') {
      const errors: RegisterErrors = {};
      if (!username) errors.username = t('auth.usernameRequired');
      else if (username.length < 2 || username.length > 20) errors.username = t('auth.usernameLength');
      else if (!USERNAME_PATTERN.test(username)) errors.username = t('auth.usernameCharacters');
      if (!password) errors.password = t('auth.passwordRequired');
      else if (password.length < 10 || password.length > 128) errors.password = t('auth.passwordLength');
      if (password !== confirmPassword) errors.confirmPassword = t('auth.mismatch');
      setRegisterErrors(errors);
      const firstInvalid = Object.keys(errors)[0];
      if (firstInvalid) {
        (e.currentTarget.elements.namedItem(firstInvalid) as HTMLElement | null)?.focus();
        return;
      }
    }
    setLoading(true);
    try {
      let captchaPayload: Record<string, string> = {};
      if (mode === 'register') {
        const config = captchaConfig ?? await getCaptchaConfig();
        if (!captchaConfig) {
          setCaptchaConfig(config);
          setCaptchaMode(config.turnstile.enabled ? 'turnstile' : config.geetest.enabled ? 'geetest' : 'none');
        }
        const captcha = captchaMode === 'none'
          ? (config.turnstile.enabled ? 'turnstile' : config.geetest.enabled ? 'geetest' : 'none')
          : captchaMode;
        if (captcha === 'turnstile' && config.turnstile.enabled) {
          if (!turnstileToken) {
            toast.error(t('auth.turnstileRequired'));
            return;
          }
          captchaPayload = { turnstile_token: turnstileToken };
        } else if (captcha === 'geetest' && config.geetest.enabled) {
          const geeTest = await requestGeeTest();
          if (geeTest.enabled && !geeTest.proof) return;
          captchaPayload = { ...(geeTest.proof ?? {}) };
        }
      }
      const res = await api.post(`/auth/${mode}`, {
        username,
        password,
        ...captchaPayload,
      });
      markAuthenticated();
      setUser(res.data.user);
      closeSocket();
      getSocket();
      // 把匿名期间的对局并入账号(失败不阻塞登录)
      try {
        await api.post('/auth/claim');
      } catch (err) {
        toast.error(t('auth.claimFailed', { message: errMsg(err) }));
      }
      navigate('/');
    } catch (err) {
      if (mode === 'register' && captchaMode === 'turnstile' && captchaConfig?.turnstile.enabled) {
        setTurnstileToken(null);
        setTurnstileResetKey((key) => key + 1);
      }
      const message = err instanceof Error ? err.message : '';
      if (message === 'CAPTCHA_CONFIG_FAILED') toast.error(t('auth.captchaConfigFailed'));
      else if (message.startsWith('TURNSTILE_')) toast.error(t('errors.TURNSTILE_FAILED'));
      else if (message.startsWith('GEETEST_')) toast.error(t('errors.GEETEST_FAILED'));
      else toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page title={mode === 'login' ? t('auth.login') : t('auth.register')} icon={<KeyRound size={17} />}>
      <div className="card auth-card">
        <p className="muted" style={{ textAlign: 'center' }}>
          {t('auth.description')}
        </p>
        <form className="form" onSubmit={submit} noValidate>
          <div className="auth-field">
            <input
              className="input"
              name="username"
              placeholder={t('auth.username')}
              value={username}
              autoComplete="username"
              aria-invalid={Boolean(registerErrors.username)}
              aria-describedby={registerErrors.username ? 'register-username-error' : undefined}
              onChange={(e) => {
                setUsername(e.target.value);
                clearRegisterError('username');
              }}
            />
            {registerErrors.username && (
              <span className="auth-field-error" id="register-username-error">{registerErrors.username}</span>
            )}
          </div>
          {mode === 'register' ? (
            <div className="auth-password-fields">
              <div className="auth-field">
                <input
                  className="input"
                  name="password"
                  type="password"
                  placeholder={t('auth.password')}
                  autoComplete="new-password"
                  value={password}
                  aria-invalid={Boolean(registerErrors.password)}
                  aria-describedby={registerErrors.password ? 'register-password-error' : undefined}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearRegisterError('password');
                  }}
                />
                {registerErrors.password && (
                  <span className="auth-field-error" id="register-password-error">{registerErrors.password}</span>
                )}
              </div>
              <div className="auth-field">
                <input
                  className="input"
                  name="confirmPassword"
                  type="password"
                  placeholder={t('auth.confirmPassword')}
                  autoComplete="new-password"
                  value={confirmPassword}
                  aria-invalid={Boolean(registerErrors.confirmPassword)}
                  aria-describedby={registerErrors.confirmPassword ? 'register-confirm-password-error' : undefined}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    clearRegisterError('confirmPassword');
                  }}
                />
                {registerErrors.confirmPassword && (
                  <span className="auth-field-error" id="register-confirm-password-error">{registerErrors.confirmPassword}</span>
                )}
              </div>
            </div>
          ) : (
            <input
              className="input"
              name="password"
              type="password"
              placeholder={t('auth.password')}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          {mode === 'register' && (
            <div className="auth-captcha">
              {captchaConfig === null && <span className="muted">{t('auth.captchaLoading')}</span>}
              {captchaConfig?.turnstile.enabled && captchaMode === 'turnstile' && captchaConfig.turnstile.siteKey && (
                <>
                  <TurnstileWidget
                    key={turnstileResetKey}
                    siteKey={captchaConfig.turnstile.siteKey}
                    onToken={handleTurnstileToken}
                    onUnavailable={handleTurnstileUnavailable}
                  />
                  {captchaConfig.geetest.enabled && (
                    <button type="button" className="auth-captcha-switch" onClick={switchToGeeTest}>
                      {t('auth.useGeeTest')}
                    </button>
                  )}
                  {turnstileUnavailable && !captchaConfig.geetest.enabled && (
                    <button type="button" className="auth-captcha-switch" onClick={resetTurnstile}>
                      {t('auth.retryTurnstile')}
                    </button>
                  )}
                </>
              )}
              {captchaConfig?.geetest.enabled && captchaMode === 'geetest' && (
                <>
                  <span className="muted">{t('auth.geetestHint')}</span>
                  {captchaConfig.turnstile.enabled && (
                    <button type="button" className="auth-captcha-switch" onClick={switchToTurnstile}>
                      {t('auth.useTurnstile')}
                    </button>
                  )}
                </>
              )}
              {captchaNotice && <span className="muted">{captchaNotice}</span>}
            </div>
          )}
          <button
            className="btn"
            disabled={loading || (mode === 'register' && (captchaConfig === null || (captchaMode === 'turnstile' && Boolean(captchaConfig?.turnstile.enabled) && !turnstileToken)))}
            aria-busy={loading}
          >
            {mode === 'register' && loading && powProgress.active ? (
              <span className="auth-pow-status">
                <span
                  className="auth-pow-ring"
                  style={{ '--pow-progress': `${powProgress.percent}%` } as CSSProperties}
                  aria-hidden="true"
                >
                  <span>{Math.round(powProgress.percent)}%</span>
                </span>
                {t('auth.registerPowComputing')}
              </span>
            ) : mode === 'login' ? t('auth.login') : t('auth.register')}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setConfirmPassword('');
              setRegisterErrors({});
              setTurnstileToken(null);
              setTurnstileUnavailable(false);
              setCaptchaNotice(null);
              if (mode === 'login' && captchaConfig) {
                setCaptchaMode(
                  captchaConfig.turnstile.enabled ? 'turnstile' : captchaConfig.geetest.enabled ? 'geetest' : 'none'
                );
                setTurnstileResetKey((key) => key + 1);
              }
              setMode(mode === 'login' ? 'register' : 'login');
            }}
          >
            {mode === 'login' ? t('auth.toRegister') : t('auth.toLogin')}
          </button>
        </form>
      </div>
    </Page>
  );
}

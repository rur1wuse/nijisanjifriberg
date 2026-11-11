import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadTurnstileScript } from '../api/turnstile';

interface Props {
  siteKey: string;
  onToken: (token: string | null) => void;
  onUnavailable: () => void;
}

export default function TurnstileWidget({ siteKey, onToken, onUnavailable }: Props) {
  const { t, i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<string | null>(null);
  const callbacksRef = useRef({ onToken, onUnavailable });
  callbacksRef.current = { onToken, onUnavailable };
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    let widgetId: string | undefined;
    (async () => {
      try {
        await loadTurnstileScript();
        if (cancelled || !containerRef.current || !window.turnstile) return;
        const language = i18n.language.startsWith('ja')
          ? 'ja'
          : i18n.language.startsWith('en')
            ? 'en'
            : 'zh-cn';
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action: 'register',
          theme: document.documentElement.dataset.theme === 'blast' ? 'dark' : 'light',
          language,
          size: 'flexible',
          callback: (token) => {
            if (cancelled) return;
            tokenRef.current = token;
            setStatus('ready');
            callbacksRef.current.onToken(token);
          },
          'error-callback': () => {
            if (cancelled || tokenRef.current) return;
            setStatus('error');
            callbacksRef.current.onUnavailable();
          },
          'expired-callback': () => {
            if (cancelled) return;
            tokenRef.current = null;
            callbacksRef.current.onToken(null);
          },
          'timeout-callback': () => {
            if (cancelled || tokenRef.current) return;
            setStatus('error');
            callbacksRef.current.onUnavailable();
          },
        });
        if (!cancelled) setStatus('ready');
      } catch {
        if (!cancelled) {
          setStatus('error');
          callbacksRef.current.onUnavailable();
        }
      }
    })();
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          // The widget may already be gone after an error callback.
        }
      }
    };
  }, [siteKey, i18n.language]);

  return (
    <div className="auth-turnstile" aria-busy={status === 'loading'}>
      <div ref={containerRef} className="auth-turnstile-frame" />
      {status === 'loading' && <span className="muted">{t('auth.turnstileLoading')}</span>}
      {status === 'error' && <span className="muted">{t('auth.turnstileUnavailable')}</span>}
    </div>
  );
}

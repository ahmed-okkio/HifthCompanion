'use client';

/**
 * InstallBanner — mobile-only nudge to install the app to the home screen.
 *
 * Installing is the intended way to use HifthCompanion on a phone: it is also
 * the ONLY way iOS grants push notifications, so this doubles as the entry
 * point for reminders. Three branches, because the platforms are not
 * symmetric:
 *   - Android/Chromium: `beforeinstallprompt` gives us a real one-tap install.
 *   - iOS Safari: no install API exists at all — instructions only.
 *   - iOS non-Safari: Chrome/Firefox on iOS cannot install a PWA; send them to Safari.
 * Already installed (display-mode: standalone) renders nothing.
 */

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

const DISMISS_KEY = 'hifth:installDismissed';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

type Mode = 'none' | 'prompt' | 'ios-safari' | 'ios-other';

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

/** ponytail: UA sniff. iOS gives no feature flag for "can install". */
function iosMode(): Mode {
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (!isIOS) return 'none';
  // Every iOS browser is WebKit, but only real Safari can Add to Home Screen.
  return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? 'ios-other' : 'ios-safari';
}

export default function InstallBanner() {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>('none');
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // Private mode / blocked storage: show the banner rather than crash.
    }

    // Deferred a tick: the lint rule (and React) want state updates to land
    // after the effect body, not synchronously inside it.
    queueMicrotask(() => setMode(iosMode()));

    // Android fires this only once installability is met; it may arrive after
    // mount, so the listener stays for the life of the page.
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
      setMode('prompt');
    };
    const onInstalled = () => setMode('none');
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (mode === 'none') return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Nothing to persist to — the banner just returns next load.
    }
    setMode('none');
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setMode('none');
  }

  const message =
    mode === 'prompt'
      ? t('install.body')
      : mode === 'ios-safari'
        ? t('install.iosSafari')
        : t('install.iosOther');

  return (
    <div
      className="lg:hidden flex items-center gap-3 px-4 py-3"
      style={{
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex flex-col flex-1 min-w-0">
        <span style={{ fontWeight: 600, fontSize: 14 }}>{t('install.title')}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{message}</span>
      </div>
      {mode === 'prompt' && (
        <button onClick={install} className="btn btn-primary" style={{ minHeight: 40 }}>
          {t('install.action')}
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label={t('install.dismiss')}
        className="btn btn-ghost"
        style={{ minHeight: 40, minWidth: 40 }}
      >
        ✕
      </button>
    </div>
  );
}

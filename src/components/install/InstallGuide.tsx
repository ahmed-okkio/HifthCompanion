'use client';

/**
 * Install guide (/install). Picks one of five views on the client:
 *   installed — already running as the home-screen app
 *   prompt    — Chromium fired `beforeinstallprompt`: one-tap Install button
 *   ios       — no install API on iOS: illustrated Share → Add to Home Screen steps
 *   android   — Android without the event (Firefox, already installed, not yet
 *               installable): browser-menu steps
 *   desktop   — QR code to open this page on a phone
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuthBrand from '@/components/AuthBrand';
import { useI18n } from '@/components/I18nProvider';
import { IosStepShare, IosStepAddToHome, IosStepConfirm } from './IosMockups';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

type View = 'loading' | 'installed' | 'prompt' | 'ios' | 'android' | 'desktop';

function detect(): View {
  if (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  ) return 'installed';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return /Android/.test(ua) ? 'android' : 'desktop';
}

export default function InstallGuide({ qrSvg }: { qrSvg: string }) {
  const { t } = useI18n();
  const [view, setView] = useState<View>('loading');
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);

  useEffect(() => {
    queueMicrotask(() => setView(v => (v === 'loading' ? detect() : v)));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
      setView('prompt');
    };
    const onInstalled = () => setView('installed');
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // The event is single-use; on dismiss, fall back to the manual steps.
    setDeferred(null);
    if (outcome !== 'accepted') setView(detect());
  }

  return (
    <div className="min-h-screen flex justify-center px-4 py-10 overflow-x-hidden bg-surface-app bg-radial-[120%_80%_at_50%_-10%] from-accent-muted to-transparent to-60%">
      <main className="w-full max-w-md animate-fade-in" data-view={view}>
        <AuthBrand subtitle={t('installPage.subtitle')} />

        {view === 'installed' && (
          <div className="card p-6 text-center flex flex-col gap-4">
            <p className="text-body">{t('installPage.installed')}</p>
            <Link href="/reader" className="btn btn-primary">{t('installPage.open')}</Link>
          </div>
        )}

        {view === 'prompt' && (
          <div className="card p-6 text-center flex flex-col gap-4">
            <p className="text-body">{t('install.body')}</p>
            <button onClick={install} className="btn btn-primary">{t('install.action')}</button>
          </div>
        )}

        {view === 'ios' && (
          <ol className="flex flex-col gap-8">
            <Step n={1} text={t('installPage.ios1')}><IosStepShare /></Step>
            <Step n={2} text={t('installPage.ios2')}><IosStepAddToHome /></Step>
            <Step n={3} text={t('installPage.ios3')}><IosStepConfirm /></Step>
          </ol>
        )}

        {view === 'android' && (
          <ol className="card p-6 flex flex-col gap-4">
            <Step n={1} text={t('installPage.android1')} />
            <Step n={2} text={t('installPage.android2')} />
            <Step n={3} text={t('installPage.android3')} />
          </ol>
        )}

        {view === 'desktop' && (
          <div className="card p-6 text-center flex flex-col items-center gap-4">
            <p className="text-body">{t('installPage.desktop')}</p>
            <div
              className="w-48 h-48 bg-white p-2 rounded-lg"
              role="img"
              aria-label={t('installPage.qrAlt')}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function Step({ n, text, children }: { n: number; text: string; children?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-3">
      <div className="flex gap-3 items-start">
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-accent text-accent-contrast flex items-center justify-center font-semibold text-small">{n}</span>
        <span className="text-body pt-0.5">{text}</span>
      </div>
      {children}
    </li>
  );
}

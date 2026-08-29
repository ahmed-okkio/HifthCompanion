'use client';

/**
 * NotifyBanner — in-app nudge to turn on notifications.
 *
 * Notifications are meant to be ON: a student who misses the reminder misses
 * the lesson. But no platform lets a site enable them unilaterally — the
 * permission prompt needs a real tap — so this asks for that tap somewhere
 * people actually look, instead of leaving it buried in Settings.
 *
 * Deliberately a SOFT prompt: tapping our button is what triggers the native
 * dialog. Firing the native prompt on page load is what gets a site muted by
 * Chrome, and a denied permission is close to unrecoverable (the user has to
 * dig through browser site settings), so we only spend the one shot when
 * someone opts in.
 */

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { pushSupported, subscribeToPush } from '@/lib/push/client';

const DISMISS_KEY = 'hifth:notifyDismissed';

export default function NotifyBanner() {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!pushSupported() || !vapidKey) return;
    // 'granted' → already on (PushToggle re-subscribes if the sub was lost).
    // 'denied'  → the prompt is spent; nagging cannot undo it.
    if (Notification.permission !== 'default') return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // Blocked storage: show it rather than crash.
    }
    queueMicrotask(() => setShow(true));
  }, [vapidKey]);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Nothing to persist to — it returns next load.
    }
    setShow(false);
  }

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') await subscribeToPush(vapidKey!);
      // Denied or dismissed: hide either way. The prompt is one-shot, and
      // Settings still has the toggle for anyone who changes their mind.
      setShow(false);
    } catch {
      setShow(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex flex-col flex-1 min-w-0">
        <span style={{ fontWeight: 600, fontSize: 14 }}>{t('notify.title')}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('notify.body')}</span>
      </div>
      <button onClick={enable} disabled={busy} className="btn btn-primary" style={{ minHeight: 40 }}>
        {t('notify.action')}
      </button>
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

'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { deleteSubscription } from '@/lib/push/subscriptions';
import { pushSupported, subscribeToPush } from '@/lib/push/client';

/**
 * iOS exposes PushManager ONLY to a home-screen install, so on Safari-in-a-tab
 * the toggle can never work and would otherwise render nothing — a dead end for
 * every iPhone user. Detect that one case so we can explain it instead.
 * ponytail: UA sniff. It is the only signal iOS gives us here.
 */
function iosNotInstalled(): boolean {
  if (typeof window === 'undefined' || pushSupported()) return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports a desktop UA; touch points disambiguate.
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return isIOS && !(window.navigator as { standalone?: boolean }).standalone;
}

export default function PushToggle() {
  const { t } = useI18n();
  const [supported, setSupported] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    // Wrapped in an async IIFE: the lint rule (and React) want state updates to
    // land after the effect body, not synchronously inside it.
    void (async () => {
      if (!pushSupported()) {
        setShowIosHint(iosNotInstalled());
        return;
      }
      setSupported(true);
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          setEnabled(true);
          return;
        }
        // Permission still granted but the subscription is gone: iOS drops it
        // when PWA storage is evicted, and the push service can expire one at
        // any time. Silently re-subscribe so notifications don't die quietly.
        if (Notification.permission === 'granted' && vapidKey) {
          await subscribeToPush(vapidKey!);
          setEnabled(true);
        }
      } catch {
        // Best effort — a failed probe just leaves the toggle showing "enable".
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (showIosHint) {
    return (
      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
        {t('push.iosHint')}
      </span>
    );
  }

  // Render nothing where push can't work or no key is configured.
  if (!supported || !vapidKey) return null;

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError(t('push.denied'));
        return;
      }
      await subscribeToPush(vapidKey!);
      setEnabled(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deleteSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setEnabled(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={enabled ? disable : enable}
        disabled={busy}
        className="btn btn-ghost"
        style={{ minHeight: 44, alignSelf: 'flex-start' }}
      >
        {enabled ? t('push.disable') : t('push.enable')}
      </button>
      {error && (
        <span style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</span>
      )}
    </div>
  );
}

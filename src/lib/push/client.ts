'use client';

/**
 * Browser-side push subscription helpers. Shared by PushToggle (settings) and
 * NotifyBanner (the in-app nudge) so there is ONE place that knows how to turn
 * a VAPID key into a stored subscription.
 */

import { saveSubscription } from '@/lib/push/subscriptions';

/** base64url VAPID public key → Uint8Array for applicationServerKey. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Create the browser subscription and persist it. Assumes permission is already
 * granted — the permission request must stay in the caller's click handler,
 * since iOS rejects requestPermission() outside a user gesture.
 */
export async function subscribeToPush(vapidKey: string): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
  });
  const json = sub.toJSON() as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  await saveSubscription({
    endpoint: json.endpoint,
    keys: json.keys,
    userAgent: navigator.userAgent,
  });
}

/**
 * iOS exposes PushManager ONLY to a home-screen install, so on Safari-in-a-tab
 * push can never work. Detect that one case so the UI can explain it instead.
 * ponytail: UA sniff. It is the only signal iOS gives us here.
 */
export function iosNotInstalled(): boolean {
  if (typeof window === 'undefined' || pushSupported()) return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports a desktop UA; touch points disambiguate.
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return isIOS && !(window.navigator as { standalone?: boolean }).standalone;
}

/** What push can do on THIS device. Per device, unlike the per-account reminder time. */
export type PushStatus = 'on' | 'off' | 'denied' | 'ios' | 'unsupported';

/** Fired on window whenever this tab subscribes or unsubscribes, so every reader refreshes. */
export const PUSH_CHANGED = 'hifth:push-changed';

export async function readPushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return iosNotInstalled() ? 'ios' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.ready;
    return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

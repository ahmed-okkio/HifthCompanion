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

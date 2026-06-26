import 'server-only';

import webpush from 'web-push';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

interface StoredSub {
  endpoint: string;
  p256dh: string;
  auth: string;
}

let vapidReady = false;

/**
 * Configure web-push from env once. Returns false (and warns) when VAPID keys
 * are missing so build/dev never crash and sends become a no-op.
 */
function ensureVapid(): boolean {
  if (vapidReady) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) {
    console.warn(
      '[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT not set — push send is a no-op.',
    );
    return false;
  }
  webpush.setVapidDetails(subject, pub, priv);
  vapidReady = true;
  return true;
}

/**
 * Load a user's stored push subscriptions. Prefers a service-role admin client
 * (needed for cross-user / scheduled sends that run without that user's
 * session). Falls back to the request-scoped client (works for self-sends under
 * owner-only RLS) when no service-role key is configured.
 */
async function loadSubscriptions(userId: string): Promise<StoredSub[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceKey) {
    const admin = createSupabaseAdmin(url, serviceKey, {
      auth: { persistSession: false },
    });
    const { data, error } = await admin
      .from('push_subscription')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId);
    if (error) throw error;
    return data ?? [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('push_subscription')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

/** Delete dead endpoints (push service returned 404/410 Gone). */
async function pruneEndpoints(endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client =
    url && serviceKey
      ? createSupabaseAdmin(url, serviceKey, { auth: { persistSession: false } })
      : await createClient();
  await client.from('push_subscription').delete().in('endpoint', endpoints);
}

/**
 * Send a push notification to every subscription a user owns. No-op (with warn)
 * when VAPID keys are absent. Prunes endpoints that come back 404/410 Gone.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; pruned: number; skipped: boolean }> {
  if (!ensureVapid()) return { sent: 0, pruned: 0, skipped: true };

  const subs = await loadSubscriptions(userId);
  const body = JSON.stringify(payload);
  const gone: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          gone.push(s.endpoint);
        } else {
          console.warn('[push] send failed', status, (err as Error).message);
        }
      }
    }),
  );

  await pruneEndpoints(gone);
  return { sent, pruned: gone.length, skipped: false };
}

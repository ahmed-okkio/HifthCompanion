'use server';

import { createClientAction } from '@/lib/supabase/server';

/** Shape persisted from a browser PushSubscription.toJSON(). */
export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}

/**
 * Persist (upsert) the current user's push subscription. Owner-only RLS scopes
 * the row to auth.uid(). Idempotent on the unique endpoint.
 */
export async function saveSubscription(sub: PushSubscriptionInput): Promise<void> {
  const supabase = await createClientAction();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('push_subscription')
    .upsert(
      {
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: sub.userAgent ?? null,
      },
      { onConflict: 'endpoint' },
    );
  if (error) throw error;
}

/** Remove a subscription by endpoint (owner-only via RLS). */
export async function deleteSubscription(endpoint: string): Promise<void> {
  const supabase = await createClientAction();
  const { error } = await supabase
    .from('push_subscription')
    .delete()
    .eq('endpoint', endpoint);
  if (error) throw error;
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/push/send';

/**
 * Self-send smoke test for web push. Sends only to the CALLER's own stored
 * subscriptions — there is no way to target another user — so it is safe to
 * leave mounted while push is being rolled out.
 * ponytail: no request body, no options. Delete once real triggers exist.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const result = await sendPushToUser(user.id, {
    title: 'HifthCompanion',
    body: 'Push notifications are working.',
    url: '/tracker',
  });

  // Which devices are even registered — a missing host explains a silent phone
  // better than a send count does.
  const { data: subs } = await supabase
    .from('push_subscription')
    .select('endpoint, user_agent, created_at')
    .eq('user_id', user.id);
  const devices = (subs ?? []).map((s: { endpoint: string; user_agent: string | null; created_at: string }) => {
    let host = 'unknown';
    try {
      host = new URL(s.endpoint).host;
    } catch {
      /* keep 'unknown' */
    }
    return { host, created_at: s.created_at, user_agent: (s.user_agent ?? '').slice(0, 80) };
  });

  return NextResponse.json({ ...result, devices });
}

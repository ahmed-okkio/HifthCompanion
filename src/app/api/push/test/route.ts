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
  return NextResponse.json(result);
}

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCircleByCode } from '@/lib/services/circle';

/**
 * Invite-link landing (replaces the typed join code). Middleware already gates
 * this behind auth + onboarding, threading `?next=/tracker/join/<code>`, so by
 * the time we run the user is signed in and onboarded. We just join (pending —
 * consent gate) and land on the accept screen.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const { origin } = new URL(request.url);
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?next=/tracker/join/${code}`);
  }

  const circle = await getCircleByCode(code);
  if (!circle) return NextResponse.redirect(`${origin}/tracker`);

  // Join once — skip if already a member (any status), so re-clicking the link
  // just reopens the circle rather than erroring on the unique membership.
  const { data: existing } = await supabase
    .from('membership')
    .select('id')
    .eq('circle_id', circle.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!existing) {
    await supabase
      .from('membership')
      .insert({ circle_id: circle.id, role: 'student', status: 'pending' });
  }

  return NextResponse.redirect(`${origin}/tracker/${circle.id}`);
}

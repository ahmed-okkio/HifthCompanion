import { createClientAction } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { safeNext } from '@/lib/nextParam';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    // createClientAction (not createClient) — its setAll persists the session
    // cookies from the exchange, so the user lands actually logged in.
    const supabase = await createClientAction();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${safeNext(searchParams.get('next'))}`);
}

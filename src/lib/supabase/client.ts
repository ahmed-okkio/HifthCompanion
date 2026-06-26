import { createBrowserClient } from '@supabase/ssr';
import { MockSupabaseClient, MOCK_USER_ID } from './mock';

function e2eUserIdFromCookie(): string {
  // sb-auth-token cookie carries the acting identity as JSON {"sub": uuid}.
  const m = document.cookie.match(/(?:^|;\s*)sb-auth-token=([^;]+)/);
  if (!m) return MOCK_USER_ID;
  try {
    const sub = JSON.parse(decodeURIComponent(m[1]))?.sub;
    return typeof sub === 'string' && sub ? sub : MOCK_USER_ID;
  } catch {
    return MOCK_USER_ID;
  }
}

export function createClient() {
  const isE2E = typeof window !== 'undefined' && document.cookie.includes('x-e2e-test=true');

  if (isE2E) {
    // Do not cache across identities: each Playwright context acts as a
    // distinct teacher/student, so resolve the acting user per call.
    const authenticated = document.cookie.includes('sb-access-token=dummy-token') ||
                          document.cookie.includes('sb-auth-token');
    return new MockSupabaseClient(authenticated, e2eUserIdFromCookie()) as any;
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

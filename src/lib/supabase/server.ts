import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { MockSupabaseClient, MOCK_USER_ID } from './mock';

async function getE2EStatus() {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const isE2E = process.env.PLAYWRIGHT_TEST === 'true' ||
                cookieStore.get('x-e2e-test')?.value === 'true' ||
                headerStore.get('x-e2e-test') === 'true';

  if (!isE2E) return { isE2E: false, authenticated: false, userId: MOCK_USER_ID };

  let authenticated = false;
  let userId = MOCK_USER_ID;
  try {
    const authCookie = cookieStore.get('sb-auth-token');
    if (cookieStore.get('sb-access-token')?.value === 'dummy-token' || authCookie) {
      authenticated = true;
    }
    // Multi-user: the auth cookie carries the acting identity ({"sub": uuid}).
    if (authCookie?.value) {
      const sub = JSON.parse(authCookie.value)?.sub;
      if (typeof sub === 'string' && sub) userId = sub;
    }
  } catch {}
  return { isE2E: true, authenticated, userId };
}

export async function createClient() {
  const { isE2E, authenticated, userId } = await getE2EStatus();
  if (isE2E) {
    return new MockSupabaseClient(authenticated, userId) as any;
  }

  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
}

export async function createClientAction() {
  const { isE2E, authenticated, userId } = await getE2EStatus();
  if (isE2E) {
    return new MockSupabaseClient(authenticated, userId) as any;
  }

  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

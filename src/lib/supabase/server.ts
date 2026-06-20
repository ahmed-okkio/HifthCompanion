import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { MockSupabaseClient } from './mock';

async function getE2EStatus() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  
  const isE2E = process.env.PLAYWRIGHT_TEST === 'true' || 
                cookieStore.get('x-e2e-test')?.value === 'true' ||
                headerStore.get('x-e2e-test') === 'true';

  if (!isE2E) return { isE2E: false, authenticated: false };

  let authenticated = false;
  try {
    if (cookieStore.get('sb-access-token')?.value === 'dummy-token' ||
        cookieStore.get('sb-auth-token')) {
      authenticated = true;
    }
  } catch {}
  return { isE2E: true, authenticated };
}

export async function createClient() {
  const { isE2E, authenticated } = await getE2EStatus();
  if (isE2E) {
    return new MockSupabaseClient(authenticated) as any;
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
  const { isE2E, authenticated } = await getE2EStatus();
  if (isE2E) {
    return new MockSupabaseClient(authenticated) as any;
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

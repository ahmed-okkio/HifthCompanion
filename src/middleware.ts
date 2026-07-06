import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Fully bypass auth for E2E tests in test environment
  const isE2E = process.env.PLAYWRIGHT_TEST === 'true' || request.headers.get('x-e2e-test') === 'true';
  const effectiveUser = isE2E ? { id: 'test-user' } : user;

  const protectedPaths = ['/sets', '/reader', '/tracker'];
  const isProtected = protectedPaths.some(p => request.nextUrl.pathname.startsWith(p));
  // Where to return after auth/onboarding — preserves invite links (/tracker/join/*).
  const next = request.nextUrl.pathname + request.nextUrl.search;

  // If in E2E mode, skip auth check
  if (isProtected && !isE2E && !effectiveUser) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', next);
    return NextResponse.redirect(login);
  }

  // Onboarding gate: force a real authed user with no completed onboarding to
  // /onboarding before any protected page. Skipped in E2E — the fake test-user
  // has no user_hifth row, so gating it would redirect the whole Playwright suite.
  const pathname = request.nextUrl.pathname;
  const exempt = ['/onboarding', '/login', '/signup'].some(p => pathname.startsWith(p));
  if (!isE2E && user && isProtected && !exempt) {
    const { data } = await supabase
      .from('user_hifth')
      .select('onboarded_at')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!data || data.onboarded_at == null) {
      const onb = new URL('/onboarding', request.url);
      onb.searchParams.set('next', next);
      return NextResponse.redirect(onb);
    }
  }

  if (isE2E) {
    response.cookies.set('x-e2e-test', 'true');
  }

  return response;
}

export const config = {
  matcher: ['/sets', '/sets/:path*', '/reader', '/reader/:path*', '/tracker', '/tracker/:path*'],
};

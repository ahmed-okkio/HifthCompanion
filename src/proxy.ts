import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale, isLocale, LOCALE_COOKIE } from '@/lib/i18n/config';

/** Set once the user is known to be onboarded; skips the user_hifth query (PRD 0016 A5/A6).
 *  Not httpOnly so logout can clear it client-side. A forged cookie only skips a UX redirect —
 *  RLS is the security boundary. */
const ONBOARDED_COOKIE = 'hc-onboarded';

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Hidden [locale] segment: /sets -> /{locale}/sets, visible URL unchanged (B1/B2).
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  const target = request.nextUrl.clone();
  target.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  const response = NextResponse.rewrite(target, { request });

  const protectedPaths = ['/sets', '/reader', '/tracker', '/wird'];
  if (!protectedPaths.some(p => pathname.startsWith(p))) return response;

  // Fully bypass auth for E2E tests in test environment
  // Env only: the x-e2e-test header is client-controlled and must never bypass auth.
  const isE2E = process.env.PLAYWRIGHT_TEST === 'true';
  if (isE2E) {
    response.cookies.set('x-e2e-test', 'true');
    return response;
  }

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

  // Local JWT verification with asymmetric signing keys; invalid/expired -> no claims (A1/A4).
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  // Where to return after auth/onboarding — preserves invite links (/tracker/join/*).
  const next = pathname + search;

  if (!userId) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', next);
    return NextResponse.redirect(login);
  }

  // Onboarding gate: DB query only when the cookie is absent. /wird only needs a session
  // (it moved here from its page's server check when the page became a static shell).
  if (!pathname.startsWith('/wird') && request.cookies.get(ONBOARDED_COOKIE)?.value !== '1') {
    const { data: row } = await supabase
      .from('user_hifth')
      .select('onboarded_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (!row || row.onboarded_at == null) {
      const onb = new URL('/onboarding', request.url);
      onb.searchParams.set('next', next);
      return NextResponse.redirect(onb);
    }
    response.cookies.set(ONBOARDED_COOKIE, '1', { path: '/', maxAge: 31536000, sameSite: 'lax' });
  }

  return response;
}

export const config = {
  // Every app page; not route handlers outside [locale], Next internals, or files with an extension.
  matcher: ['/((?!api/|auth/|_next/|.*[.]).*)'],
};

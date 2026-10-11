// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getClaims = vi.fn();
const maybeSingle = vi.fn();
const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }));
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getClaims, getUser: () => { throw new Error('getUser must not be called'); } }, from }),
}));

const { proxy } = await import('@/proxy');

function req(path: string, cookie = '') {
  return new NextRequest(new URL(path, 'http://localhost'), { headers: cookie ? { cookie } : {} });
}

beforeEach(() => {
  delete process.env.PLAYWRIGHT_TEST;
  vi.clearAllMocks();
  getClaims.mockResolvedValue({ data: { claims: { sub: 'u1' } } });
  maybeSingle.mockResolvedValue({ data: { onboarded_at: '2026-01-01' } });
});

describe('proxy', () => {
  it('rewrites to the cookie locale, default en (B2)', async () => {
    expect((await proxy(req('/login', 'locale=ar'))).headers.get('x-middleware-rewrite')).toBe('http://localhost/ar/login');
    getClaims.mockResolvedValue({ data: null });
    expect((await proxy(req('/', 'locale=zz'))).headers.get('x-middleware-rewrite')).toBe('http://localhost/en');
  });

  // An in-page redirect streams after the layout under cacheComponents (meta refresh -> double load).
  it('redirects signed-in "/" to /wird with a real HTTP redirect', async () => {
    expect((await proxy(req('/'))).headers.get('location')).toBe('http://localhost/wird');
  });

  it('redirects unauthenticated/invalid JWT to /login?next (A3/A4)', async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error('bad jwt') });
    const res = await proxy(req('/tracker/join/abc?x=1'));
    expect(res.headers.get('location')).toBe('http://localhost/login?next=%2Ftracker%2Fjoin%2Fabc%3Fx%3D1');
  });

  it('skips user_hifth query when hc-onboarded=1 (A5)', async () => {
    const res = await proxy(req('/sets', 'hc-onboarded=1'));
    expect(from).not.toHaveBeenCalled();
    expect(res.headers.get('x-middleware-rewrite')).toBe('http://localhost/en/sets');
  });

  it('queries once and sets the cookie when onboarded (A6)', async () => {
    const res = await proxy(req('/sets'));
    expect(maybeSingle).toHaveBeenCalledTimes(1);
    expect(res.cookies.get('hc-onboarded')?.value).toBe('1');
  });

  it('redirects to onboarding when not onboarded (A6)', async () => {
    maybeSingle.mockResolvedValue({ data: { onboarded_at: null } });
    const res = await proxy(req('/reader/5'));
    expect(res.headers.get('location')).toBe('http://localhost/onboarding?next=%2Freader%2F5');
  });

  it('E2E bypass skips auth (A9)', async () => {
    process.env.PLAYWRIGHT_TEST = 'true';
    const res = await proxy(req('/sets'));
    expect(getClaims).not.toHaveBeenCalled();
    expect(res.cookies.get('x-e2e-test')?.value).toBe('true');
  });

  it('x-e2e-test header without the env does NOT bypass auth', async () => {
    getClaims.mockResolvedValue({ data: null });
    const res = await proxy(new NextRequest(new URL('/sets', 'http://localhost'), { headers: { 'x-e2e-test': 'true', cookie: 'x-e2e-test=true' } }));
    expect(res.headers.get('location')).toBe('http://localhost/login?next=%2Fsets');
    expect(res.cookies.get('x-e2e-test')).toBeUndefined();
  });
});

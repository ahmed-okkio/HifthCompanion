import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { __resetMockStore, __seedMockStore } from '@/lib/supabase/mock';

// Test-only route handler: lets Playwright reset/seed the SERVER-side mock store
// (a process global the server components read). Reachable ONLY under the E2E
// env gate — same gate the mock client uses — so it cannot activate in prod.
async function isE2E() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  return (
    process.env.PLAYWRIGHT_TEST === 'true' ||
    cookieStore.get('x-e2e-test')?.value === 'true' ||
    headerStore.get('x-e2e-test') === 'true'
  );
}

export async function POST(req: Request) {
  if (!(await isE2E())) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  if (body?.reset) __resetMockStore();
  if (body?.seed) __seedMockStore(body.seed);
  return NextResponse.json({ ok: true });
}

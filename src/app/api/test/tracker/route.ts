import { NextResponse } from 'next/server';
import { __resetMockStore, __seedMockStore } from '@/lib/supabase/mock';

// Test-only route handler: lets Playwright reset/seed the SERVER-side mock store
// (a process global the server components read). Reachable ONLY under the E2E
// env gate — same gate the mock client uses — so it cannot activate in prod.
// Env only: cookie/header are client-controlled.
function isE2E() {
  return process.env.PLAYWRIGHT_TEST === 'true';
}

export async function POST(req: Request) {
  if (!(await isE2E())) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  // reset: true wipes everything; reset: ['wird', ...] wipes only those tables.
  if (body?.reset) __resetMockStore(Array.isArray(body.reset) ? body.reset : undefined);
  if (body?.seed) __seedMockStore(body.seed);
  return NextResponse.json({ ok: true });
}

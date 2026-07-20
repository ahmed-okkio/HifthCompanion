import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * S1-S5: notify helpers + call-site wiring, with the Supabase admin client and
 * Resend fetch mocked. No network, no DB.
 */

const sendEmail = vi.fn(async (_to: string, _subject: string, _html: string) => ({
  sent: true,
  skipped: false,
}));
vi.mock('@/lib/email/send', () => ({
  sendEmail: (to: string, subject: string, html: string) => sendEmail(to, subject, html),
}));

const getUserById = vi.fn();
let prefs: Record<string, unknown> | null = {};
const tables: Record<string, unknown> = {};

function fromStub(table: string) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({
      data: table === 'profiles' ? { email_prefs: prefs, first_name: 'Amina', last_name: 'S' } : tables[table],
      error: null,
    }),
  };
  return chain;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { admin: { getUserById: (id: string) => getUserById(id) } },
    from: (t: string) => fromStub(t),
  }),
}));

import {
  notifyInvite,
  notifyHomework,
  notifySessionChange,
} from '@/lib/email/notify';

describe('notify helpers (S1-S5)', () => {
  beforeEach(() => {
    sendEmail.mockClear();
    getUserById.mockReset();
    getUserById.mockResolvedValue({ data: { user: { email: 'student@example.com' } }, error: null });
    prefs = {};
    tables.circle = { name: 'Al-Fajr', teacher_id: 'teacher-1' };
    tables.membership = { user_id: 'student-1' };
    tables.session = { scheduled_at: '2026-07-01T10:00:00Z', membership: { user_id: 'student-1' } };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('S3: resolves the recipient address via the service-role admin client, returns nothing', async () => {
    const res = await notifyInvite('student-1', 'circle-1');
    expect(getUserById).toHaveBeenCalledWith('student-1');
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toBe('student@example.com');
    expect(res).toBeUndefined();
  });

  it('S2: homework notify targets the membership student', async () => {
    await notifyHomework('m-1', 'pages 1-3', '2026-07-05');
    expect(getUserById).toHaveBeenCalledWith('student-1');
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('S2: session change notify fires for both move and cancel', async () => {
    await notifySessionChange('s-1', '2026-07-02T10:00:00Z', '2026-07-01T10:00:00Z');
    await notifySessionChange('s-1', null);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it('S4: an explicit false pref suppresses the send', async () => {
    prefs = { invite: false };
    await notifyInvite('student-1', 'circle-1');
    expect(sendEmail).not.toHaveBeenCalled();

    prefs = { homework: false };
    await notifyHomework('m-1', 'pages 1-3', null);
    expect(sendEmail).not.toHaveBeenCalled();

    prefs = { session_change: false };
    await notifySessionChange('s-1', null);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('S4/S5: absent keys (incl. reminder-ready layer) still send', async () => {
    prefs = { reminder: false };
    await notifyInvite('student-1', 'circle-1');
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('S1: a lookup failure is swallowed, never thrown', async () => {
    getUserById.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(notifyInvite('student-1', 'circle-1')).resolves.toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('S1: missing service-role config is a no-op, not a throw', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await expect(notifyHomework('m-1', 'pages 1-3', null)).resolves.toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

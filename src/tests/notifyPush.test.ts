import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The push side of deliver(): every event mirrors its email to push, EXCEPT to
 * the person who performed the action. They still get the email — it carries
 * the calendar update — but a notification about your own tap is noise.
 */

const sendEmail = vi.fn();
const sendPushToUser = vi.fn();

vi.mock('@/lib/email/send', () => ({
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}));
vi.mock('@/lib/push/send', () => ({
  sendPushToUser: (...args: unknown[]) => sendPushToUser(...args),
}));

/** Minimal chainable Supabase stub: every query resolves to one canned row. */
function fakeDb() {
  const row = (table: string) =>
    table === 'circle'
      ? { name: 'Al-Furqan', teacher_id: 'teacher-1' }
      : { first_name: 'Sara', last_name: 'K', email_prefs: {}, locale: 'en', timezone: 'UTC' };
  return {
    auth: {
      admin: {
        getUserById: vi.fn(async () => ({ data: { user: { email: 'x@example.com' } }, error: null })),
      },
    },
    from: (table: string) => {
      const result = { data: row(table), error: null };
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'in', 'delete']) chain[m] = () => chain;
      chain.maybeSingle = async () => result;
      chain.single = async () => result;
      return chain;
    },
  };
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => fakeDb(),
}));

describe('deliver() push gate', () => {
  beforeEach(() => {
    sendEmail.mockReset();
    sendPushToUser.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('pushes to a recipient who did not perform the action', async () => {
    const { notifyInvite } = await import('@/lib/email/notify');
    await notifyInvite('student-1', 'circle-1', 'teacher-1');

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
    expect(sendPushToUser.mock.calls[0][0]).toBe('student-1');
    expect(sendPushToUser.mock.calls[0][1]).toMatchObject({ url: '/tracker' });
  });

  it('emails but does NOT push the actor themselves', async () => {
    const { notifyInvite } = await import('@/lib/email/notify');
    await notifyInvite('student-1', 'circle-1', 'student-1');

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });
});

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
let locale: string | null = null;
let timezone: string | null = null;
const tables: Record<string, unknown> = {};

function fromStub(table: string) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({
      data: table === 'profiles'
        ? { email_prefs: prefs, locale, timezone, first_name: 'Amina', last_name: 'S' }
        : tables[table],
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
    locale = null;
    timezone = null;
    tables.circle = { name: 'Al-Fajr', teacher_id: 'teacher-1' };
    tables.membership = {
      user_id: 'student-1',
      circle: { schedule: { weekdays: [1], time: '17:00', timezone: 'Europe/Amsterdam' } },
    };
    tables.session = {
      scheduled_at: '2026-07-01T10:00:00Z',
      membership: {
        user_id: 'student-1',
        circle: { schedule: { weekdays: [1], time: '17:00', timezone: 'Europe/Amsterdam' } },
      },
    };
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

  it("S6: recipient locale 'en' ⇒ English-only subject and body", async () => {
    locale = 'en';
    await notifyInvite('student-1', 'circle-1');
    const [, subject, html] = sendEmail.mock.calls[0];
    expect(subject).toBe('You have been invited to a circle');
    expect(html).not.toContain('dir="rtl"');
  });

  it("S6: recipient locale 'ar' ⇒ Arabic-only subject and body", async () => {
    locale = 'ar';
    await notifyHomework('m-1', 'pages 1-3', null);
    const [, subject, html] = sendEmail.mock.calls[0];
    expect(subject).toBe('واجب جديد');
    expect(html).toContain('dir="rtl"');
    expect(html).not.toContain('dir="ltr"');
    // the no-deadline placeholder follows the same locale
    expect(html).toContain('بدون موعد');
    expect(html).not.toContain('no deadline');
  });

  it('S6: null locale ⇒ English subject and body, never bilingual', async () => {
    await notifySessionChange('s-1', null);
    const [, subject, html] = sendEmail.mock.calls[0];
    expect(subject).toBe('Session canceled');
    expect(html).toContain('dir="ltr"');
    expect(html).not.toContain('dir="rtl"');
  });

  it('S6: an unrecognized stored locale ⇒ English, not a crash', async () => {
    locale = 'fr';
    await notifyInvite('student-1', 'circle-1');
    const [, subject, html] = sendEmail.mock.calls[0];
    expect(subject).toBe('You have been invited to a circle');
    expect(html).not.toContain('dir="rtl"');
  });

  it("L5: with no recipient timezone, falls back to the circle's schedule zone", async () => {
    timezone = null;
    await notifySessionChange('s-1', null);
    const [, , html] = sendEmail.mock.calls[0];
    // 2026-07-01T10:00:00Z in Europe/Amsterdam (CEST) = 12:00 on Wednesday.
    expect(html).toContain('Wednesday');
    expect(html).toContain('12:00 PM');
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });

  it("L5: the recipient's own timezone wins over the circle's", async () => {
    timezone = 'Asia/Riyadh'; // UTC+3 ⇒ 1:00 PM, vs Amsterdam's 12:00 PM
    await notifySessionChange('s-1', null);
    const [, , html] = sendEmail.mock.calls[0];
    expect(html).toContain('1:00 PM');
    expect(html).not.toContain('12:00 PM');
  });

  it('L5: displayed times always carry a zone label', async () => {
    timezone = 'Asia/Riyadh';
    await notifySessionChange('s-1', null);
    const [, , html] = sendEmail.mock.calls[0];
    expect(html).toMatch(/UTC\+3/);
  });

  it('L5: neither recipient nor circle zone ⇒ UTC', async () => {
    timezone = null;
    (tables.session as { membership: { circle: unknown } }).membership.circle = { schedule: null };
    await notifySessionChange('s-1', null);
    const [, , html] = sendEmail.mock.calls[0];
    expect(html).toContain('10:00 AM');
  });

  it('L5: homework deadline is formatted, not a raw ISO string', async () => {
    await notifyHomework('m-1', 'pages 1-3', '2026-07-05T08:00:00Z');
    const [, , html] = sendEmail.mock.calls[0];
    expect(html).toContain('July 2026');
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
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

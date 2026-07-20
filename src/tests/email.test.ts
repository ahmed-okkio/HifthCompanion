import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { sendEmail, __resetTransport } from '@/lib/email/send';
import {
  prefEnabled,
  inviteBody,
  homeworkBody,
  sessionChangeBody,
  pickText,
  formatWhen,
} from '@/lib/email/templates';

const sendMail = vi.fn();
const createTransport = vi.fn((_opts: Record<string, unknown>) => ({ sendMail }));

vi.mock('nodemailer', () => ({
  default: { createTransport: (opts: Record<string, unknown>) => createTransport(opts) },
}));

describe('sendEmail (L1, L2)', () => {
  beforeEach(() => {
    sendMail.mockReset();
    createTransport.mockClear();
    __resetTransport();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.SMTP_USER = 'sender@gmail.com';
    process.env.SMTP_PASSWORD = 'app-password';
    process.env.EMAIL_FROM = 'Hifth <no-reply@example.com>';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.EMAIL_FROM;
  });

  it('L1: one SMTP send with from/to/subject/html', async () => {
    sendMail.mockResolvedValue({ messageId: 'x' });

    const res = await sendEmail('student@example.com', 'Subject', '<p>hi</p>');

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toEqual({
      from: 'Hifth <no-reply@example.com>',
      to: 'student@example.com',
      subject: 'Subject',
      html: '<p>hi</p>',
    });
    expect(res).toEqual({ sent: true, skipped: false });
  });

  it('L1: gmail defaults when host/port unset, transporter reused across sends', async () => {
    sendMail.mockResolvedValue({ messageId: 'x' });

    await sendEmail('a@b.c', 'S', '<p>h</p>');
    await sendEmail('a@b.c', 'S', '<p>h</p>');

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport.mock.calls[0][0]).toMatchObject({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: 'sender@gmail.com', pass: 'app-password' },
    });
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it('L2: no credentials ⇒ no connection, one warn, skipped result, no throw', async () => {
    delete process.env.SMTP_PASSWORD;

    const res = await sendEmail('a@b.c', 'S', '<p>h</p>');

    expect(createTransport).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ sent: false, skipped: true });
  });

  it('L2: never throws when the transport fails', async () => {
    sendMail.mockRejectedValue(new Error('EAUTH'));
    await expect(sendEmail('a@b.c', 'S', '<p>h</p>')).resolves.toEqual({
      sent: false,
      skipped: false,
    });
  });
});

describe('single-locale bodies (L3, amended 2026-07-20 — English default)', () => {
  it("locale 'en' ⇒ English only, ltr, no Arabic", () => {
    const html = inviteBody({ teacherName: 'Ustadh Ali', circleName: 'Fajr' }, 'en');
    expect(html).toContain('dir="ltr"');
    expect(html).not.toContain('dir="rtl"');
    expect(html).toContain('invited you to their circle');
    expect(html).not.toContain('دعاك');
    expect(html).toContain('Fajr');
  });

  it("locale 'ar' ⇒ Arabic only, rtl container, mirrored alignment", () => {
    const html = homeworkBody(
      { studentName: 'Zayd', range: 'p. 12-14', deadline: '2026-07-25' },
      'ar',
    );
    expect(html).toContain('dir="rtl"');
    expect(html).not.toContain('dir="ltr"');
    expect(html).toContain('text-align:right');
    expect(html).toContain('واجب جديد');
    expect(html).not.toContain('New homework');
    expect(html).toContain('p. 12-14');
  });

  it('null/undefined/unrecognized locale ⇒ English only, never bilingual', () => {
    for (const html of [
      inviteBody({ teacherName: 'Ustadh Ali', circleName: 'Fajr' }),
      inviteBody({ teacherName: 'Ustadh Ali', circleName: 'Fajr' }, null),
      inviteBody({ teacherName: 'Ustadh Ali', circleName: 'Fajr' }, undefined),
    ]) {
      expect(html).toContain('dir="ltr"');
      expect(html).not.toContain('dir="rtl"');
      expect(html).not.toContain('دعاك');
      expect(html).toContain('invited you to their circle');
    }
  });

  it('unknown locale renders identically to explicit en', () => {
    const facts = { studentName: 'Zayd', oldTime: '2026-07-20T16:00:00+00:00', newTime: null };
    expect(sessionChangeBody(facts, null)).toEqual(sessionChangeBody(facts, 'en'));
  });

  it('cancel body respects a known locale', () => {
    const en = sessionChangeBody({ studentName: 'Zayd', oldTime: 'Mon 5pm', newTime: null }, 'en');
    expect(en).not.toContain('dir="rtl"');
    expect(en).toContain('Session canceled');

    const ar = sessionChangeBody({ studentName: 'Zayd', oldTime: 'Mon 5pm', newTime: null }, 'ar');
    expect(ar).toContain('dir="rtl"');
    expect(ar).toContain('إلغاء الجلسة');
  });

  it('reinstated body never reuses the cancel copy', () => {
    const facts = { studentName: 'Zayd', oldTime: 'Mon 5pm', newTime: null, reinstated: true };

    const en = sessionChangeBody(facts, 'en');
    expect(en).toContain('Session back on');
    expect(en).toContain('no longer canceled');
    expect(en).not.toContain('Session canceled');
    expect(en).toContain('Mon 5pm'); // the time it is back on

    const ar = sessionChangeBody(facts, 'ar');
    expect(ar).toContain('dir="rtl"');
    expect(ar).toContain('إعادة الجلسة');
    expect(ar).not.toContain('تم إلغاء جلستك');
  });

  it('pickText defaults to English for anything that is not ar', () => {
    expect(pickText('en', 'New homework', 'واجب جديد')).toBe('New homework');
    expect(pickText('ar', 'New homework', 'واجب جديد')).toBe('واجب جديد');
    expect(pickText(null, 'New homework', 'واجب جديد')).toBe('New homework');
    expect(pickText(undefined, 'New homework', 'واجب جديد')).toBe('New homework');
  });
});

describe('formatWhen + no raw ISO in any body (L5)', () => {
  const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

  it('formats an ISO instant in the given timezone and locale, zone labelled', () => {
    const en = formatWhen('2026-07-20T16:00:00+00:00', 'en', 'Europe/Amsterdam');
    expect(en).toContain('Monday');
    expect(en).toContain('20 July 2026');
    expect(en).toContain('6:00 PM'); // CEST = UTC+2
    expect(en).toMatch(/UTC\+2/); // never an unlabelled time
    expect(en).not.toMatch(ISO);

    const ar = formatWhen('2026-07-20T16:00:00+00:00', 'ar', 'Europe/Amsterdam');
    expect(ar).not.toMatch(ISO);
    expect(ar).not.toEqual(en);
  });

  it('falls back to UTC when the timezone is unset', () => {
    expect(formatWhen('2026-07-20T16:00:00+00:00', 'en', null)).toContain('4:00 PM');
    expect(formatWhen('2026-07-20T16:00:00+00:00', 'en')).toContain('4:00 PM');
  });

  it('date-only deadline renders without a clock time or zone label', () => {
    const out = formatWhen('2026-07-25', 'en', 'Europe/Amsterdam');
    expect(out).toContain('25 July 2026');
    expect(out).not.toMatch(/\d{2}:\d{2}/);
    expect(out).not.toContain('UTC');
  });

  it('renders the same instant differently per zone — the label disambiguates', () => {
    const iso = '2026-07-20T16:00:00+00:00';
    const student = formatWhen(iso, 'en', 'Asia/Riyadh');
    const teacher = formatWhen(iso, 'en', 'Europe/London');
    expect(student).toContain('7:00 PM');
    expect(teacher).toContain('5:00 PM');
    expect(student).not.toEqual(teacher);
  });

  it('passes an unparseable free-form deadline through unchanged', () => {
    expect(formatWhen('before Jumuah', 'en', 'UTC')).toBe('before Jumuah');
  });

  it('no builder emits a raw ISO string', () => {
    const bodies = [
      homeworkBody(
        { studentName: 'Zayd', range: 'p. 12-14', deadline: '2026-07-25T09:00:00Z', timezone: 'Asia/Riyadh' },
        'en',
      ),
      sessionChangeBody(
        {
          studentName: 'Zayd',
          oldTime: '2026-07-20T16:00:00+00:00',
          newTime: '2026-07-21T17:00:00+00:00',
          timezone: 'Asia/Riyadh',
        },
        'en',
      ),
      sessionChangeBody(
        { studentName: 'Zayd', oldTime: '2026-07-20T16:00:00+00:00', newTime: null, timezone: 'Asia/Riyadh' },
        'ar',
      ),
    ];
    for (const html of bodies) expect(html).not.toMatch(ISO);
  });
});

describe('shared HTML shell (L6)', () => {
  const all = [
    inviteBody({ teacherName: 'Ustadh Ali', circleName: 'Fajr' }, 'en'),
    homeworkBody({ studentName: 'Zayd', range: 'p. 12-14', deadline: '2026-07-25' }, 'en'),
    sessionChangeBody({ studentName: 'Zayd', oldTime: 'Mon 5pm', newTime: 'Tue 6pm' }, 'en'),
  ];

  it('every builder renders the wordmark, card, and footer', () => {
    for (const html of all) {
      expect(html).toContain('Hifth Companion');
      expect(html).toContain('max-width:600px');
      expect(html).toContain('<table');
      expect(html).toContain('automatic message');
      expect(html).toContain('Settings');
    }
  });

  it('no <style> block, external CSS, web font, or image', () => {
    for (const html of all) {
      expect(html).not.toContain('<style');
      expect(html).not.toContain('<link');
      expect(html).not.toContain('<img');
      expect(html).not.toContain('http://');
      expect(html).not.toContain('fonts.googleapis');
    }
  });

  it('builders are pure — same facts in, same HTML out', () => {
    const facts = { teacherName: 'Ustadh Ali', circleName: 'Fajr' };
    expect(inviteBody(facts, 'en')).toEqual(inviteBody(facts, 'en'));
  });
});

describe('prefEnabled (L4)', () => {
  it('absent key ⇒ enabled; {} enables every event', () => {
    expect(prefEnabled({}, 'invite')).toBe(true);
    expect(prefEnabled({}, 'homework')).toBe(true);
    expect(prefEnabled({}, 'session_change')).toBe(true);
    expect(prefEnabled({}, 'reminder')).toBe(true);
  });

  it('null/undefined prefs ⇒ enabled', () => {
    expect(prefEnabled(null, 'invite')).toBe(true);
    expect(prefEnabled(undefined, 'invite')).toBe(true);
  });

  it('only an explicit false disables', () => {
    expect(prefEnabled({ invite: false }, 'invite')).toBe(false);
    expect(prefEnabled({ invite: true }, 'invite')).toBe(true);
    expect(prefEnabled({ invite: false }, 'homework')).toBe(true);
  });
});

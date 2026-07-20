import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { sendEmail, __resetTransport } from '@/lib/email/send';
import {
  prefEnabled,
  inviteBody,
  homeworkBody,
  sessionChangeBody,
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

describe('bilingual bodies (L3)', () => {
  const isBilingual = (html: string) => {
    expect(html).toContain('dir="rtl"');
    expect(html.indexOf('dir="ltr"')).toBeLessThan(html.indexOf('dir="rtl"'));
  };

  it('invite carries teacher + circle in both blocks', () => {
    const html = inviteBody({ teacherName: 'Ustadh Ali', circleName: 'Fajr' });
    isBilingual(html);
    expect(html.match(/Ustadh Ali/g)).toHaveLength(2);
    expect(html.match(/Fajr/g)).toHaveLength(2);
  });

  it('homework carries range + deadline in both blocks', () => {
    const html = homeworkBody({
      studentName: 'Zayd',
      range: 'p. 12-14',
      deadline: '2026-07-25',
    });
    isBilingual(html);
    expect(html.match(/p\. 12-14/g)).toHaveLength(2);
    expect(html.match(/2026-07-25/g)).toHaveLength(2);
  });

  it('session change carries old→new time in both blocks', () => {
    const html = sessionChangeBody({
      studentName: 'Zayd',
      oldTime: 'Mon 5pm',
      newTime: 'Tue 6pm',
    });
    isBilingual(html);
    expect(html.match(/Mon 5pm/g)).toHaveLength(2);
    expect(html.match(/Tue 6pm/g)).toHaveLength(2);
  });

  it('session cancel keeps the old time in both blocks', () => {
    const html = sessionChangeBody({
      studentName: 'Zayd',
      oldTime: 'Mon 5pm',
      newTime: null,
    });
    isBilingual(html);
    expect(html.match(/Mon 5pm/g)).toHaveLength(2);
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

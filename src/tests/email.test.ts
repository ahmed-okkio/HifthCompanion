import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { sendEmail } from '@/lib/email/send';
import {
  prefEnabled,
  inviteBody,
  homeworkBody,
  sessionChangeBody,
} from '@/lib/email/templates';

describe('sendEmail (L1, L2)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM = 'Hifth <no-reply@example.com>';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('L1: one authenticated POST to the Resend endpoint with from/to/subject/html', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    const res = await sendEmail('student@example.com', 'Subject', '<p>hi</p>');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    expect(JSON.parse(init.body)).toEqual({
      from: 'Hifth <no-reply@example.com>',
      to: 'student@example.com',
      subject: 'Subject',
      html: '<p>hi</p>',
    });
    expect(res).toEqual({ sent: true, skipped: false });
  });

  it('L2: no key ⇒ no network, one warn, skipped result, no throw', async () => {
    delete process.env.RESEND_API_KEY;

    const res = await sendEmail('a@b.c', 'S', '<p>h</p>');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ sent: false, skipped: true });
  });

  it('L2: never throws when the network fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(sendEmail('a@b.c', 'S', '<p>h</p>')).resolves.toEqual({
      sent: false,
      skipped: false,
    });
  });

  it('L2: never throws on a non-ok API response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 422 });
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

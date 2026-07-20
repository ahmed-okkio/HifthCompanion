import type { Locale } from '@/lib/i18n/config';

/** Per-event email opt-outs stored on profiles.email_prefs. Default-on. */
export type EmailPrefKey = 'invite' | 'homework' | 'session_change' | 'reminder';

/**
 * Default-on gate: a missing key means enabled; only an explicit `false`
 * disables. `{}` ⇒ every event enabled.
 */
export function prefEnabled(
  prefs: Record<string, unknown> | null | undefined,
  key: EmailPrefKey | string,
): boolean {
  return prefs?.[key] !== false;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Recipient language as stored on profiles.locale — null/undefined = unknown ⇒ English. */
export type RecipientLocale = Locale | null | undefined;

/** English unless the recipient is known to read Arabic (contract L3, amended 2026-07-20). */
export function pickText(locale: RecipientLocale, en: string, ar: string): string {
  return locale === 'ar' ? ar : en;
}

/**
 * The one place Intl is called. `value` is an ISO timestamp; anything that
 * isn't parseable (a free-form deadline like "before Jumuah") is returned
 * as-is so builders stay dumb.
 * ponytail: no memoized formatter cache — three emails per mutation.
 */
export function formatWhen(
  value: string,
  locale: RecipientLocale,
  timezone?: string | null,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  // A date-only deadline ("2026-07-25") has no meaningful clock time to show.
  const dateOnly = !value.includes('T');
  const zone = dateOnly ? 'UTC' : timezone || 'UTC';

  const out = new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    // 12-hour clock: a lesson time is read at a glance, and "5:00 PM" is
    // harder to misread than "17:00".
    ...(dateOnly ? {} : { hour: 'numeric' as const, minute: '2-digit' as const, hour12: true }),
    timeZone: zone,
  }).format(date);

  // en-GB yields lowercase "pm"; uppercase it. Arabic uses ص/م, leave alone.
  const time = locale === 'ar' ? out : out.replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase());
  if (dateOnly) return time;

  const utc = offsetLabel(date, zone);
  return utc ? `${time} ${utc}` : time;
}

/**
 * A Latin "UTC±n" offset for `zone` — never a named abbreviation.
 *
 * The zone label is not decoration: teacher and student are often in different
 * timezones, and an unlabelled time is how a lesson gets missed. Named
 * abbreviations are not an option: no single English locale knows them all
 * (en-GB renders New York as GMT-4, en-US renders London as GMT+1), so they'd
 * appear for some recipients and not others. A fixed offset is uniform, and
 * stays Latin in Arabic rather than becoming "غرينتش+3".
 */
function offsetLabel(date: Date, zone: string): string {
  const label = new Intl.DateTimeFormat('en-GB', { timeZone: zone, timeZoneName: 'shortOffset' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName')?.value;
  if (!label) return '';
  // Intl says "GMT+1"; say "UTC+1". Same offset, and UTC is the term people
  // recognise. Zero offset reads "UTC", not "UTC+0".
  return label.replace(/^GMT/, 'UTC').replace(/^UTC\+0$/, 'UTC');
}

/**
 * A session shown the way the app shows it: a date-chip (weekday + hour) beside
 * the full date and time. Mirrors StudentCircle's session card. `value` must be
 * an ISO timestamp; anything unparseable falls back to the plain formatted line
 * (a free-form deadline never reaches here — only real sessions do).
 */
function whenChip(value: string, locale: RecipientLocale, timezone?: string | null): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    return `<div style="font-size:15px;color:#1F2937;">${formatWhen(value, locale, timezone)}</div>`;

  const loc = locale === 'ar' ? 'ar' : 'en-GB';
  const zone = timezone || 'UTC';
  const upper = (s: string) => (locale === 'ar' ? s : s.replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase()));
  const part = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(loc, { ...opts, timeZone: zone }).format(date);
  const wkShort = part({ weekday: 'short' });
  const dateLong = part({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  // Bare hour for the chip ("5 PM"); full clock + zone for the muted line.
  const hour = upper(part({ hour: 'numeric', hour12: true }));
  const off = offsetLabel(date, zone);
  const clock = `${upper(part({ hour: 'numeric', minute: '2-digit', hour12: true }))}${off ? ` ${off}` : ''}`;

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="52" style="width:52px;height:52px;background-color:#E7F3EE;border-radius:10px;text-align:center;font-family:${FONTS};color:${GREEN};">
<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;line-height:1.6;">${wkShort}</div>
<div style="font-size:15px;font-weight:700;line-height:1;">${hour}</div>
</td>
<td style="padding-${locale === 'ar' ? 'right' : 'left'}:12px;font-family:${FONTS};vertical-align:middle;">
<div style="font-size:15px;font-weight:600;color:#111827;line-height:1.4;">${dateLong}</div>
<div style="font-size:13px;color:#6B7280;line-height:1.4;">${clock}</div>
</td></tr></table>`;
}

const GREEN = '#0F8A67';
// 'Inter' is the enhancement: Apple Mail / iOS load it from the @import in the
// <head> below; Gmail/Outlook strip the @import and fall back to the system
// stack, which still looks clean. No web-safe serif — everyone hated Georgia.
const FONTS =
  "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = FONTS;

// Logo is a hosted absolute URL, not a data URI: Gmail blocks data: images.
// Trailing slash tolerated. Empty when unset ⇒ img omitted, wordmark stands alone.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
function logoImg(rtl: boolean): string {
  if (!SITE_URL) return '';
  const side = rtl ? 'left' : 'right';
  return `<img src="${SITE_URL}/logo.png" width="40" height="40" alt="" style="display:inline-block;vertical-align:middle;margin-${side}:10px;border:0;border-radius:8px;">`;
}

/**
 * Table-based, inline-CSS shell — Gmail/Outlook strip <style> and ignore
 * flex/grid, so every rule lives on the element. Images must be absolute URLs
 * (clients block data: URIs); no web fonts.
 */
function shell(
  locale: RecipientLocale,
  parts: {
    preheader: string;
    heading: string;
    /** Muted one-liner under the heading, e.g. "Al-Furqan · Sh. Bilal". */
    subline?: string;
    message: string;
    /** Composed HTML blocks (callout box, session card…), each its own element. */
    content: string;
    footer: string;
  },
): string {
  const rtl = locale === 'ar';
  const dir = rtl ? 'rtl' : 'ltr';
  const align = rtl ? 'right' : 'left';
  const subline = parts.subline
    ? `<p style="margin:0 0 18px;font-size:13px;font-weight:600;color:${GREEN};letter-spacing:0.2px;">${parts.subline}</p>`
    : '';

  return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');</style></head>
<body style="margin:0;padding:0;">
<div dir="${dir}" style="margin:0;padding:0;background-color:#F4F6F5;">
<div style="display:none;font-size:1px;color:#F4F6F5;max-height:0;overflow:hidden;">${parts.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F6F5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border:1px solid #E3E8E6;border-radius:8px;">
<tr><td style="padding:20px 28px;border-bottom:1px solid #E3E8E6;text-align:${align};">
${logoImg(rtl)}<span style="font-family:${SERIF};font-size:20px;font-weight:700;color:${GREEN};letter-spacing:0.2px;vertical-align:middle;">Hifth Companion</span>
</td></tr>
<tr><td style="padding:28px;font-family:${FONTS};text-align:${align};">
<h1 style="margin:0 0 ${parts.subline ? '6px' : '12px'};font-family:${SERIF};font-size:20px;line-height:1.4;font-weight:600;color:#111827;">${parts.heading}</h1>
${subline}<p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#374151;">${parts.message}</p>
${parts.content}
</td></tr>
<tr><td style="padding:16px 28px 22px;border-top:1px solid #E3E8E6;font-family:${FONTS};font-size:12px;line-height:1.6;color:#6B7280;text-align:${align};">${parts.footer}</td></tr>
</table>
</td></tr>
</table>
</div>
</body></html>`;
}

const FOOTER_EN =
  'This is an automatic message from Hifth Companion. You can change which emails you receive in Settings.';
const FOOTER_AR =
  'هذه رسالة تلقائية من تطبيق حفظ. يمكنك تغيير الرسائل التي تصلك من الإعدادات.';

/**
 * Circle + teacher as one muted line under the heading — "Al-Furqan · Sh. Bilal"
 * — not boxed fields. Empty when neither is known.
 */
function circleTeacherLine(circleName?: string, teacherName?: string, ar?: boolean): string {
  const bits: string[] = [];
  if (circleName) bits.push(escapeHtml(circleName));
  if (teacherName) bits.push((ar ? 'مع ' : 'with ') + escapeHtml(teacherName));
  return bits.join(' · ');
}

/** The green-accent callout box holding plain label rows (range, due…). */
function callout(rows: string[], rtl: boolean): string {
  const inner = rows
    .map((r) => `<div style="font-size:15px;line-height:1.6;color:#1F2937;padding:3px 0;">${r}</div>`)
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:#F1F7F4;border-${rtl ? 'right' : 'left'}:3px solid ${GREEN};border-radius:4px;padding:14px 16px;font-family:${FONTS};">${inner}</td></tr></table>`;
}

/** A session shown as its own bordered card, standalone from any callout. */
function sessionCard(label: string, chip: string, rtl: boolean): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;"><tr><td style="border:1px solid #E3E8E6;border-radius:8px;padding:14px 16px;font-family:${FONTS};text-align:${rtl ? 'right' : 'left'};">
<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#6B7280;margin-bottom:10px;">${label}</div>
${chip}
</td></tr></table>`;
}

export function inviteBody(
  facts: { teacherName: string; circleName: string },
  locale?: RecipientLocale,
): string {
  const teacher = escapeHtml(facts.teacherName);
  const rtl = locale === 'ar';
  const ar = rtl;
  return shell(locale, {
    preheader: ar ? `دعاك ${teacher} للانضمام إلى حلقة` : `${teacher} invited you to a circle`,
    heading: ar ? 'دعوة إلى حلقة' : 'You have been invited to a circle',
    subline: circleTeacherLine(facts.circleName, facts.teacherName, ar),
    message: ar
      ? `دعاك ${teacher} للانضمام إلى حلقة في تطبيق حفظ.`
      : `${teacher} invited you to their circle on Hifth Companion.`,
    content: '',
    footer: ar ? FOOTER_AR : FOOTER_EN,
  });
}

export function homeworkBody(
  facts: {
    studentName: string;
    range: string;
    deadline: string;
    circleName?: string;
    teacherName?: string;
    timezone?: string | null;
  },
  locale?: RecipientLocale,
): string {
  const student = escapeHtml(facts.studentName);
  const range = escapeHtml(facts.range);
  const deadline = escapeHtml(formatWhen(facts.deadline, locale, facts.timezone));
  const rtl = locale === 'ar';
  const ar = rtl;
  return shell(locale, {
    preheader: ar ? `واجب جديد: ${range}` : `New homework: ${range}`,
    heading: ar ? 'واجب جديد' : 'New homework',
    subline: circleTeacherLine(facts.circleName, facts.teacherName, ar),
    message: ar
      ? `${student}، عيَّن معلمك واجبًا جديدًا.`
      : `${student}, your teacher has set new homework.`,
    content: callout(
      [
        ar ? `<strong>المقرر:</strong> ${range}` : `<strong>Range:</strong> ${range}`,
        ar ? `<strong>الموعد النهائي:</strong> ${deadline}` : `<strong>Due:</strong> ${deadline}`,
      ],
      rtl,
    ),
    footer: ar ? FOOTER_AR : FOOTER_EN,
  });
}

export function sessionChangeBody(
  facts: {
    studentName: string;
    oldTime: string;
    newTime: string | null;
    circleName?: string;
    teacherName?: string;
    timezone?: string | null;
    /** The session was un-canceled. `oldTime` is when it is back on. */
    reinstated?: boolean;
  },
  locale?: RecipientLocale,
): string {
  const student = escapeHtml(facts.studentName);
  const oldChip = whenChip(facts.oldTime, locale, facts.timezone);
  const rtl = locale === 'ar';
  const ar = rtl;
  const subline = circleTeacherLine(facts.circleName, facts.teacherName, ar);

  // A reinstated session must never reuse the cancel copy — a student told
  // "canceled" when the lesson is back on is exactly the missed lesson this
  // feature exists to prevent.
  if (facts.reinstated) {
    return shell(locale, {
      preheader: ar ? 'عادت جلستك' : 'Your session is back on',
      heading: ar ? 'إعادة الجلسة' : 'Session back on',
      subline,
      message: ar
        ? `${student}، لم تعد جلستك ملغاة وستُعقد في موعدها.`
        : `${student}, your session is no longer canceled and will go ahead.`,
      content: sessionCard(ar ? 'الموعد' : 'When', oldChip, rtl),
      footer: ar ? FOOTER_AR : FOOTER_EN,
    });
  }

  if (!facts.newTime) {
    return shell(locale, {
      preheader: ar ? 'تم إلغاء جلستك' : 'Your session has been canceled',
      heading: ar ? 'إلغاء الجلسة' : 'Session canceled',
      subline,
      message: ar
        ? `${student}، تم إلغاء جلستك القادمة.`
        : `${student}, your upcoming session has been canceled.`,
      content: sessionCard(ar ? 'الموعد الملغى' : 'Canceled session', oldChip, rtl),
      footer: ar ? FOOTER_AR : FOOTER_EN,
    });
  }

  const newChip = whenChip(facts.newTime, locale, facts.timezone);
  return shell(locale, {
    preheader: ar ? 'تم نقل جلستك إلى موعد جديد' : 'Your session has been moved',
    heading: ar ? 'تغيير موعد الجلسة' : 'Session rescheduled',
    subline,
    message: ar
      ? `${student}، تم نقل جلستك إلى موعد جديد.`
      : `${student}, your session has been moved to a new time.`,
    content:
      sessionCard(ar ? 'الموعد السابق' : 'Previously', oldChip, rtl) +
      sessionCard(ar ? 'الموعد الجديد' : 'Now', newChip, rtl),
    footer: ar ? FOOTER_AR : FOOTER_EN,
  });
}

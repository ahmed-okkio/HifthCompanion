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

  // The zone label is not decoration: teacher and student are often in
  // different timezones, and an unlabelled time is how a lesson gets missed.
  //
  // Always a Latin GMT offset, in both locales. Named abbreviations are not
  // an option here: no single English locale knows them all — en-GB renders
  // New York as GMT-4, en-US renders London as GMT+1 — so abbreviations
  // would appear for some recipients and not others. A fixed offset is
  // uniform and unambiguous, and stays Latin in Arabic rather than becoming
  // "غرينتش+3".
  const label = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    timeZoneName: 'shortOffset',
  })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName')?.value;

  if (!label) return time;
  // Intl says "GMT+1"; say "UTC+1". Same offset, and UTC is the term people
  // recognise. Zero offset reads "UTC", not "UTC+0".
  const utc = label.replace(/^GMT/, 'UTC').replace(/^UTC\+0$/, 'UTC');
  return `${time} ${utc}`;
}

const GREEN = '#0F8A67';
const FONTS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/**
 * Table-based, inline-CSS shell — Gmail/Outlook strip <style> and ignore
 * flex/grid, so every rule lives on the element. No images, no web fonts.
 */
function shell(
  locale: RecipientLocale,
  parts: { preheader: string; heading: string; message: string; facts: string[]; footer: string },
): string {
  const rtl = locale === 'ar';
  const dir = rtl ? 'rtl' : 'ltr';
  const align = rtl ? 'right' : 'left';
  const facts = parts.facts
    .map(
      (f) =>
        `<div style="font-size:15px;line-height:1.6;color:#1F2937;">${f}</div>`,
    )
    .join('');

  return `<div dir="${dir}" style="margin:0;padding:0;background-color:#F4F6F5;">
<div style="display:none;font-size:1px;color:#F4F6F5;max-height:0;overflow:hidden;">${parts.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F6F5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border:1px solid #E3E8E6;border-radius:8px;">
<tr><td style="padding:20px 28px;border-bottom:1px solid #E3E8E6;text-align:${align};">
<span style="font-family:${FONTS};font-size:16px;font-weight:700;color:${GREEN};letter-spacing:0.2px;">Hifth Companion</span>
</td></tr>
<tr><td style="padding:28px;font-family:${FONTS};text-align:${align};">
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.4;font-weight:600;color:#111827;">${parts.heading}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#374151;">${parts.message}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:#F1F7F4;border-${rtl ? 'right' : 'left'}:3px solid ${GREEN};border-radius:4px;padding:14px 16px;font-family:${FONTS};text-align:${align};">${facts}</td></tr></table>
</td></tr>
<tr><td style="padding:16px 28px 22px;border-top:1px solid #E3E8E6;font-family:${FONTS};font-size:12px;line-height:1.6;color:#6B7280;text-align:${align};">${parts.footer}</td></tr>
</table>
</td></tr>
</table>
</div>`;
}

const FOOTER_EN =
  'This is an automatic message from Hifth Companion. You can change which emails you receive in Settings.';
const FOOTER_AR =
  'هذه رسالة تلقائية من تطبيق حفظ. يمكنك تغيير الرسائل التي تصلك من الإعدادات.';

export function inviteBody(
  facts: { teacherName: string; circleName: string },
  locale?: RecipientLocale,
): string {
  const teacher = escapeHtml(facts.teacherName);
  const circle = escapeHtml(facts.circleName);
  const ar = locale === 'ar';
  return shell(locale, {
    preheader: ar ? `دعاك ${teacher} للانضمام إلى حلقة` : `${teacher} invited you to a circle`,
    heading: ar ? 'دعوة إلى حلقة' : 'You have been invited to a circle',
    message: ar
      ? `دعاك ${teacher} للانضمام إلى حلقة في تطبيق حفظ.`
      : `${teacher} invited you to their circle on Hifth Companion.`,
    facts: [ar ? `<strong>الحلقة:</strong> ${circle}` : `<strong>Circle:</strong> ${circle}`],
    footer: ar ? FOOTER_AR : FOOTER_EN,
  });
}

export function homeworkBody(
  facts: { studentName: string; range: string; deadline: string; timezone?: string | null },
  locale?: RecipientLocale,
): string {
  const student = escapeHtml(facts.studentName);
  const range = escapeHtml(facts.range);
  const deadline = escapeHtml(formatWhen(facts.deadline, locale, facts.timezone));
  const ar = locale === 'ar';
  return shell(locale, {
    preheader: ar ? `واجب جديد: ${range}` : `New homework: ${range}`,
    heading: ar ? 'واجب جديد' : 'New homework',
    message: ar
      ? `${student}، عيَّن معلمك واجبًا جديدًا.`
      : `${student}, your teacher has set new homework.`,
    facts: [
      ar ? `<strong>المقرر:</strong> ${range}` : `<strong>Range:</strong> ${range}`,
      ar ? `<strong>الموعد النهائي:</strong> ${deadline}` : `<strong>Due:</strong> ${deadline}`,
    ],
    footer: ar ? FOOTER_AR : FOOTER_EN,
  });
}

export function sessionChangeBody(
  facts: {
    studentName: string;
    oldTime: string;
    newTime: string | null;
    timezone?: string | null;
    /** The session was un-canceled. `oldTime` is when it is back on. */
    reinstated?: boolean;
  },
  locale?: RecipientLocale,
): string {
  const student = escapeHtml(facts.studentName);
  const oldTime = escapeHtml(formatWhen(facts.oldTime, locale, facts.timezone));
  const ar = locale === 'ar';

  // A reinstated session must never reuse the cancel copy — a student told
  // "canceled" when the lesson is back on is exactly the missed lesson this
  // feature exists to prevent.
  if (facts.reinstated) {
    return shell(locale, {
      preheader: ar ? 'عادت جلستك' : 'Your session is back on',
      heading: ar ? 'إعادة الجلسة' : 'Session back on',
      message: ar
        ? `${student}، لم تعد جلستك ملغاة وستُعقد في موعدها.`
        : `${student}, your session is no longer canceled and will go ahead.`,
      facts: [
        ar ? `<strong>الموعد:</strong> ${oldTime}` : `<strong>When:</strong> ${oldTime}`,
      ],
      footer: ar ? FOOTER_AR : FOOTER_EN,
    });
  }

  if (!facts.newTime) {
    return shell(locale, {
      preheader: ar ? 'تم إلغاء جلستك' : 'Your session has been canceled',
      heading: ar ? 'إلغاء الجلسة' : 'Session canceled',
      message: ar
        ? `${student}، تم إلغاء جلستك القادمة.`
        : `${student}, your upcoming session has been canceled.`,
      facts: [
        ar
          ? `<strong>الموعد الملغى:</strong> ${oldTime}`
          : `<strong>Canceled session:</strong> ${oldTime}`,
      ],
      footer: ar ? FOOTER_AR : FOOTER_EN,
    });
  }

  const newTime = escapeHtml(formatWhen(facts.newTime, locale, facts.timezone));
  return shell(locale, {
    preheader: ar ? 'تم نقل جلستك إلى موعد جديد' : 'Your session has been moved',
    heading: ar ? 'تغيير موعد الجلسة' : 'Session rescheduled',
    message: ar
      ? `${student}، تم نقل جلستك إلى موعد جديد.`
      : `${student}, your session has been moved to a new time.`,
    facts: [
      ar ? `<strong>الموعد السابق:</strong> ${oldTime}` : `<strong>Previously:</strong> ${oldTime}`,
      ar ? `<strong>الموعد الجديد:</strong> ${newTime}` : `<strong>Now:</strong> ${newTime}`,
    ],
    footer: ar ? FOOTER_AR : FOOTER_EN,
  });
}

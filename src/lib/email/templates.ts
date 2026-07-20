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

/** EN block then AR block (dir="rtl"), same facts in both. */
function bilingual(en: string, ar: string): string {
  return `<div dir="ltr">${en}</div><hr /><div dir="rtl">${ar}</div>`;
}

export function inviteBody(facts: { teacherName: string; circleName: string }): string {
  const teacher = escapeHtml(facts.teacherName);
  const circle = escapeHtml(facts.circleName);
  return bilingual(
    `<p>${teacher} invited you to the circle "${circle}" on Hifth Companion.</p>`,
    `<p>دعاك ${teacher} للانضمام إلى حلقة "${circle}" في تطبيق حفظ.</p>`,
  );
}

export function homeworkBody(facts: {
  studentName: string;
  range: string;
  deadline: string;
}): string {
  const student = escapeHtml(facts.studentName);
  const range = escapeHtml(facts.range);
  const deadline = escapeHtml(facts.deadline);
  return bilingual(
    `<p>${student}, new homework: ${range}. Due ${deadline}.</p>`,
    `<p>${student}، واجب جديد: ${range}. الموعد النهائي ${deadline}.</p>`,
  );
}

export function sessionChangeBody(facts: {
  studentName: string;
  oldTime: string;
  newTime: string | null;
}): string {
  const student = escapeHtml(facts.studentName);
  const oldTime = escapeHtml(facts.oldTime);
  if (!facts.newTime) {
    return bilingual(
      `<p>${student}, your session on ${oldTime} has been canceled.</p>`,
      `<p>${student}، تم إلغاء جلستك بتاريخ ${oldTime}.</p>`,
    );
  }
  const newTime = escapeHtml(facts.newTime);
  return bilingual(
    `<p>${student}, your session moved from ${oldTime} to ${newTime}.</p>`,
    `<p>${student}، تم نقل جلستك من ${oldTime} إلى ${newTime}.</p>`,
  );
}

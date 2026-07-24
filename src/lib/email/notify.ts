// ponytail: no `server-only` import — every caller is a 'use server' service file,
// and the guard is unresolvable under vitest without touching vitest.config.ts.
import { createClient as createSupabaseAdmin, type SupabaseClient } from '@supabase/supabase-js';

import { displayName } from '@/lib/displayName';
import { sendEmail } from '@/lib/email/send';
import {
  prefEnabled,
  inviteBody,
  homeworkBody,
  sessionChangeBody,
  substitutionBody,
  pickText,
  type EmailPrefKey,
  type RecipientLocale,
} from '@/lib/email/templates';
import { isLocale } from '@/lib/i18n/config';

/**
 * Service-role client — recipient email addresses are resolved server-side only
 * (auth.admin.getUserById) and never handed back to the triggering teacher.
 * Same pattern as push/send.ts. Returns null when unconfigured so every notify
 * degrades to a no-op instead of throwing (S1).
 */
function admin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.warn('[email] SUPABASE_SERVICE_ROLE_KEY not set — notify is a no-op.');
    return null;
  }
  return createSupabaseAdmin(url, serviceKey, { auth: { persistSession: false } });
}

/**
 * Resolve address + prefs + locale, gate, send. Never returns the address.
 * The message is built *after* the profile read so it can be written in the
 * recipient's own language; `build` receives null when that language is unknown
 * and the templates then default to English (contract L3, amended 2026-07-20).
 */
async function deliver(
  db: SupabaseClient,
  userId: string,
  key: EmailPrefKey,
  build: (locale: RecipientLocale, timezone: string | null) => { subject: string; html: string },
): Promise<void> {
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error) throw error;
  const to = data.user?.email;
  if (!to) return;

  const { data: profile } = await db
    .from('profiles')
    .select('email_prefs, locale, timezone')
    .eq('id', userId)
    .maybeSingle();
  if (!prefEnabled(profile?.email_prefs, key)) return;

  const locale = isLocale(profile?.locale) ? profile.locale : null;
  // Same select, no extra round trip. Null ⇒ the caller's own fallback.
  const { subject, html } = build(locale, profile?.timezone ?? null);
  await sendEmail(to, subject, html);
}

/** ponytail: one swallow-and-log wrapper instead of try/catch in each notify. */
async function bestEffort(label: string, fn: (db: SupabaseClient) => Promise<void>): Promise<void> {
  try {
    const db = admin();
    if (!db) return;
    await fn(db);
  } catch (err) {
    console.warn(`[email] ${label} notify failed`, (err as Error).message);
  }
}

/** Supabase types an embedded to-one relation as object | array; normalise. */
function relOne<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null);
}

async function nameOf(db: SupabaseClient, userId: string): Promise<string> {
  const { data } = await db
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', userId)
    .maybeSingle();
  return displayName({ user_id: userId, first_name: data?.first_name, last_name: data?.last_name });
}

/** A teacher added `userId` to `circleId` as a pending member. */
export async function notifyInvite(userId: string, circleId: string): Promise<void> {
  await bestEffort('invite', async (db) => {
    const { data: circle } = await db
      .from('circle')
      .select('name, teacher_id')
      .eq('id', circleId)
      .maybeSingle();
    if (!circle) return;
    const teacherName = await nameOf(db, circle.teacher_id);
    await deliver(
      db,
      userId,
      'invite',
      (locale) => ({
        subject: pickText(locale, 'You have been invited to a circle', 'دعوة إلى حلقة'),
        html: inviteBody({ teacherName, circleName: circle.name ?? '' }, locale),
      }),
    );
  });
}

/** New homework prescribed on `membershipId` — recipient is that membership's student. */
export async function notifyHomework(
  membershipId: string,
  range: string,
  deadline: string | null,
): Promise<void> {
  await bestEffort('homework', async (db) => {
    const { data: membership } = await db
      .from('membership')
      // The schedule lives on membership, not circle: the 1:1 restructure
      // (20260701000001) dropped circle.schedule and added membership.schedule.
      .select('user_id, schedule, circle(name, teacher_id)')
      .eq('id', membershipId)
      .maybeSingle();
    if (!membership?.user_id) return;
    const scheduleTz =
      (membership.schedule as { timezone?: string } | null)?.timezone ?? null;
    const circle = relOne(membership.circle);
    const studentName = await nameOf(db, membership.user_id);
    const teacherName = circle?.teacher_id ? await nameOf(db, circle.teacher_id) : '';
    await deliver(
      db,
      membership.user_id,
      'homework',
      (locale, recipientTz) => ({
        subject: pickText(locale, 'New homework', 'واجب جديد'),
        html: homeworkBody(
          {
            studentName,
            range,
            deadline: deadline ?? pickText(locale, 'no deadline', 'بدون موعد'),
            circleName: circle?.name ?? '',
            teacherName,
            // Recipient's own zone first — the two parties may differ.
            timezone: recipientTz ?? scheduleTz ?? 'UTC',
          },
          locale,
        ),
      }),
    );
  });
}

export interface SubAssignment {
  membershipId: string;
  scheduledAt: string;
  substituteUserId: string;
}

/** membership → student user_id, names, tz, circle/teacher — one query per membership. */
async function membershipSessionInfo(
  db: SupabaseClient,
  membershipId: string,
): Promise<{
  studentId: string;
  studentName: string;
  circleName: string;
  teacherName: string;
  tz: string | null;
} | null> {
  const { data } = await db
    .from('membership')
    .select('user_id, schedule, circle(name, teacher_id)')
    .eq('id', membershipId)
    .maybeSingle();
  if (!data?.user_id) return null;
  const circle = relOne(data.circle as { name?: string; teacher_id?: string } | { name?: string; teacher_id?: string }[] | null);
  return {
    studentId: data.user_id,
    studentName: await nameOf(db, data.user_id),
    circleName: circle?.name ?? '',
    teacherName: circle?.teacher_id ? await nameOf(db, circle.teacher_id) : '',
    tz: (data.schedule as { timezone?: string } | null)?.timezone ?? null,
  };
}

/**
 * Substitute assigned (`assignments`) and/or reclaimed (`removed`). Emails the
 * substitute a digest of the sessions they now / no longer cover (H1/H3) and
 * each affected student that a named sub — or their own teacher again — will run
 * their session(s) (H2/H3). Best-effort: a send failure never rolls back the
 * DB write (H4) — same swallow-and-log shape as every notify above.
 */
export async function notifySubstitution(
  assignments: SubAssignment[] = [],
  removed: SubAssignment[] = [],
): Promise<void> {
  await bestEffort('substitution', async (db) => {
    // Resolve each touched membership once; reused across both audiences.
    const ids = [...new Set([...assignments, ...removed].map((a) => a.membershipId))];
    const info = new Map<string, Awaited<ReturnType<typeof membershipSessionInfo>>>();
    for (const id of ids) info.set(id, await membershipSessionInfo(db, id));

    // Both flavours build the same per-instant item shape.
    const itemOf = (a: SubAssignment) => {
      const m = info.get(a.membershipId);
      return m
        ? { studentName: m.studentName, circleName: m.circleName, teacherName: m.teacherName, when: a.scheduledAt, timezone: m.tz }
        : null;
    };

    // Digest per substitute (assigned vs reclaimed sent separately). H1 / H3.
    const bySub = (rows: SubAssignment[], removedFlag: boolean) => {
      const groups = new Map<string, SubAssignment[]>();
      for (const r of rows) (groups.get(r.substituteUserId) ?? groups.set(r.substituteUserId, []).get(r.substituteUserId)!).push(r);
      return [...groups.entries()].map(async ([subId, rs]) => {
        const items = rs.map(itemOf).filter((x): x is NonNullable<typeof x> => x !== null);
        if (items.length === 0) return;
        const subName = await nameOf(db, subId);
        await deliver(db, subId, 'session_change', (locale) => ({
          subject: removedFlag
            ? pickText(locale, 'Substitute coverage canceled', 'إلغاء التغطية')
            : pickText(locale, 'Sessions you are covering', 'جلسات ستغطيها'),
          html: substitutionBody({ audience: 'substitute', removed: removedFlag, substituteName: subName, recipientName: subName, items }, locale),
        }));
      });
    };

    // One email per affected student. H2 / H3.
    const byStudent = (rows: SubAssignment[], removedFlag: boolean) => {
      const groups = new Map<string, SubAssignment[]>();
      for (const r of rows) (groups.get(r.membershipId) ?? groups.set(r.membershipId, []).get(r.membershipId)!).push(r);
      return [...groups.entries()].map(async ([mid, rs]) => {
        const m = info.get(mid);
        if (!m) return;
        const items = rs.map(itemOf).filter((x): x is NonNullable<typeof x> => x !== null);
        if (items.length === 0) return;
        const subName = await nameOf(db, rs[0].substituteUserId);
        await deliver(db, m.studentId, 'session_change', (locale) => ({
          subject: removedFlag
            ? pickText(locale, 'Your teacher is back', 'عاد معلمك')
            : pickText(locale, 'A substitute for your session', 'معلم بديل لجلستك'),
          html: substitutionBody({ audience: 'student', removed: removedFlag, substituteName: subName, recipientName: m.studentName, items }, locale),
        }));
      });
    };

    await Promise.all([
      ...bySub(assignments, false),
      ...bySub(removed, true),
      ...byStudent(assignments, false),
      ...byStudent(removed, true),
    ]);
  });
}

/**
 * Session moved (newTime) or canceled (newTime null) — recipient is its student.
 * `oldTime` is passed by reschedule (the row already holds the new time by then);
 * cancel omits it and the stored scheduled_at is correct.
 */
export async function notifySessionChange(
  sessionId: string,
  newTime: string | null,
  oldTime?: string,
  reinstated = false,
): Promise<void> {
  await bestEffort('session_change', async (db) => {
    const { data: session } = await db
      .from('session')
      // ponytail: one query — the schedule tz rides along with the membership
      // hop already needed to find the student. It lives on membership, not
      // circle: the 1:1 restructure (20260701000001) dropped circle.schedule.
      .select('scheduled_at, membership(user_id, schedule, circle(name, teacher_id))')
      .eq('id', sessionId)
      .maybeSingle();
    type Rel = {
      user_id?: string;
      schedule?: { timezone?: string } | null;
      circle?: { name?: string; teacher_id?: string } | { name?: string; teacher_id?: string }[] | null;
    };
    const membership = relOne(session?.membership as Rel | Rel[] | null);
    const userId = membership?.user_id;
    if (!userId) return;
    const scheduleTz = membership?.schedule?.timezone ?? null;
    const circle = relOne(membership?.circle);
    const studentName = await nameOf(db, userId);
    const teacherName = circle?.teacher_id ? await nameOf(db, circle.teacher_id) : '';
    await deliver(
      db,
      userId,
      'session_change',
      (locale, recipientTz) => ({
        subject: reinstated
          ? pickText(locale, 'Session back on', 'إعادة الجلسة')
          : newTime
            ? pickText(locale, 'Session rescheduled', 'تغيير موعد الجلسة')
            : pickText(locale, 'Session canceled', 'إلغاء الجلسة'),
        html: sessionChangeBody(
          {
            studentName,
            oldTime: oldTime ?? session?.scheduled_at ?? '',
            newTime,
            reinstated,
            circleName: circle?.name ?? '',
            teacherName,
            // Recipient's own zone first — teacher and student may differ.
            timezone: recipientTz ?? scheduleTz ?? 'UTC',
          },
          locale,
        ),
      }),
    );
  });
}

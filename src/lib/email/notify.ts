// ponytail: no `server-only` import — every caller is a 'use server' service file,
// and the guard is unresolvable under vitest without touching vitest.config.ts.
import { createClient as createSupabaseAdmin, type SupabaseClient } from '@supabase/supabase-js';

import { displayName } from '@/lib/displayName';
import type { IcsEvent } from '@/lib/email/ics';
import { sendEmail, type EmailInvite } from '@/lib/email/send';
import {
  prefEnabled,
  inviteBody,
  homeworkBody,
  scheduleBody,
  sessionChangeBody,
  substitutionBody,
  pickText,
  type EmailPrefKey,
  type RecipientLocale,
} from '@/lib/email/templates';
import { isLocale } from '@/lib/i18n/config';
import { recurringSlots } from '@/lib/recurrence';
import type { Recurrence } from '@/types';

/**
 * Calendar UIDs. A student's recurring lessons are ONE calendar series keyed by
 * membership, so moving or cancelling a single lesson is an override of that
 * series (same uid + RECURRENCE-ID) rather than an unrelated second event —
 * otherwise a reschedule would leave the original occurrence sitting on the
 * calendar beside the new one. Ad-hoc sessions belong to no series and get
 * their own standalone uid.
 */
const seriesUid = (membershipId: string) => `series-${membershipId}@hifth-companion`;
const adhocUid = (sessionId: string) => `adhoc-${sessionId}@hifth-companion`;
const subUid = (membershipId: string, instant: string) =>
  `sub-${membershipId}-${instant}@hifth-companion`;

/** How far ahead a schedule invite lists occurrences. */
// ponytail: two years of RDATEs is a few KB and is refreshed by any schedule
// edit. If a 1:1 ever runs untouched past the horizon, add a periodic re-send.
const INVITE_HORIZON_DAYS = 730;

/** Teacher's own copy reads as a day of named students, not ten identical blocks. */
const teacherSummary = (studentName: string, locale: RecipientLocale, coveredBy?: string | null) =>
  `${pickText(locale, 'Hifth', 'حفظ')} — ${studentName}` +
  (coveredBy ? ` (${pickText(locale, 'covered by', 'يغطيها')} ${coveredBy})` : '');

const studentSummary = (circleName: string, locale: RecipientLocale) =>
  `${pickText(locale, 'Hifth session', 'جلسة حفظ')}${circleName ? ` — ${circleName}` : ''}`;

/**
 * Who the other party is, in the event body. ORGANIZER;CN is not enough to
 * carry this: Google resolves a Gmail organizer address to that account's own
 * profile name and drops our CN, so the name has to live in the event itself.
 */
const withTeacher = (teacherName: string, locale: RecipientLocale) =>
  teacherName ? `${pickText(locale, 'Teacher', 'المعلم')}: ${teacherName}` : '';
const withStudent = (studentName: string, locale: RecipientLocale) =>
  studentName ? `${pickText(locale, 'Student', 'الطالب')}: ${studentName}` : '';

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
  build: (
    locale: RecipientLocale,
    timezone: string | null,
  ) => { subject: string; html: string; invite?: EmailInvite },
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
  const { subject, html, invite } = build(locale, profile?.timezone ?? null);
  await sendEmail(to, subject, html, invite);
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
  teacherId: string | null;
  teacherName: string;
  schedule: Recurrence | null;
  tz: string | null;
} | null> {
  const { data } = await db
    .from('membership')
    .select('user_id, schedule, circle(name, teacher_id)')
    .eq('id', membershipId)
    .maybeSingle();
  if (!data?.user_id) return null;
  const circle = relOne(data.circle as { name?: string; teacher_id?: string } | { name?: string; teacher_id?: string }[] | null);
  const schedule = (data.schedule as Recurrence | null) ?? null;
  return {
    studentId: data.user_id,
    studentName: await nameOf(db, data.user_id),
    circleName: circle?.name ?? '',
    teacherId: circle?.teacher_id ?? null,
    teacherName: circle?.teacher_id ? await nameOf(db, circle.teacher_id) : '',
    schedule,
    tz: schedule?.timezone ?? null,
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
          // The substitute has no prior event for these instants, so the ICS is
          // theirs alone; UID is (membership, instant) and reused on reclaim so
          // the CANCEL removes exactly what the REQUEST added. Students get no
          // ICS here — their own event has not moved.
          invite: {
            method: removedFlag ? ('CANCEL' as const) : ('REQUEST' as const),
            events: rs.map((r) => ({
              uid: subUid(r.membershipId, r.scheduledAt),
              start: r.scheduledAt,
              summary: pickText(locale, 'Hifth session (covering)', 'جلسة حفظ (تغطية)'),
              description: info.get(r.membershipId)?.studentName ?? '',
            })),
          },
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

    /**
     * One digest for the teacher covering every touched instant, rather than a
     * mail per session. The teacher's occurrence is retitled, never cancelled:
     * the slot is still theirs to see, just run by someone else, and a reclaim
     * simply flips the title back.
     */
    const byTeacher = (rows: SubAssignment[], removedFlag: boolean) => {
      const groups = new Map<string, SubAssignment[]>();
      for (const r of rows) {
        const t = info.get(r.membershipId)?.teacherId;
        if (!t) continue;
        (groups.get(t) ?? groups.set(t, []).get(t)!).push(r);
      }
      return [...groups.entries()].map(async ([teacherId, rs]) => {
        const items = rs.map(itemOf).filter((x): x is NonNullable<typeof x> => x !== null);
        if (items.length === 0) return;
        const subName = await nameOf(db, rs[0].substituteUserId);
        const teacherName = info.get(rs[0].membershipId)?.teacherName ?? '';
        await deliver(db, teacherId, 'session_change', (locale) => ({
          subject: removedFlag
            ? pickText(locale, 'Substitute coverage canceled', 'إلغاء التغطية')
            : pickText(locale, 'Substitute assigned', 'تعيين معلم بديل'),
          html: substitutionBody(
            { audience: 'substitute', removed: removedFlag, substituteName: subName, recipientName: teacherName, items },
            locale,
          ),
          invite: {
            // REQUEST both ways — the reclaim is a retitle, not a withdrawal.
            method: 'REQUEST' as const,
            organizerName: teacherName || undefined,
            events: rs.flatMap((r) => {
              const m = info.get(r.membershipId);
              if (!m) return [];
              // ponytail: substitution rows are keyed by the series instant, so
              // the override targets the series uid. A sub on an ad-hoc session
              // would need its own uid — not reachable from the current UI.
              return [
                {
                  uid: seriesUid(r.membershipId),
                  recurrenceId: r.scheduledAt,
                  start: r.scheduledAt,
                  summary: teacherSummary(m.studentName, locale, removedFlag ? null : subName),
                },
              ];
            }),
          },
        }));
      });
    };

    await Promise.all([
      ...bySub(assignments, false),
      ...bySub(removed, true),
      ...byStudent(assignments, false),
      ...byStudent(removed, true),
      ...byTeacher(assignments, false),
      ...byTeacher(removed, true),
    ]);
  });
}


/**
 * One session moved (`newTime`), canceled (`newTime` null), reinstated or newly
 * added — recipient is its student, mirrored to the circle's teacher.
 *
 * `oldTime` is passed by reschedule (the row already holds the new time by
 * then); the other paths omit it and the stored scheduled_at is correct.
 *
 * The calendar side is an override of the student's weekly series, keyed by
 * RECURRENCE-ID = the ORIGINAL series instant. That is `moved_from` once a row
 * has been moved (it keeps pointing at the very first slot across repeated
 * reschedules, which is exactly what RECURRENCE-ID requires) and `scheduled_at`
 * otherwise. Ad-hoc rows belong to no series and carry a standalone uid.
 */
export async function notifySessionChange(
  sessionId: string,
  newTime: string | null,
  oldTime?: string,
  reinstated = false,
  added = false,
): Promise<void> {
  await bestEffort('session_change', async (db) => {
    const { data: session } = await db
      .from('session')
      // ponytail: one query — the schedule tz rides along with the membership
      // hop already needed to find the student. It lives on membership, not
      // circle: the 1:1 restructure (20260701000001) dropped circle.schedule.
      .select(
        'scheduled_at, is_adhoc, moved_from, membership_id, membership(user_id, schedule, circle(name, teacher_id))',
      )
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
    const teacherId = circle?.teacher_id ?? null;
    const teacherName = teacherId ? await nameOf(db, teacherId) : '';

    const when = newTime ?? session?.scheduled_at ?? '';
    const isAdhoc = Boolean(session?.is_adhoc);
    // A cancel withdraws only this occurrence, never the whole series (RFC 5546).
    const method = newTime || reinstated || added ? ('REQUEST' as const) : ('CANCEL' as const);
    const event = (summary: string, description: string): IcsEvent => ({
      uid: isAdhoc ? adhocUid(sessionId) : seriesUid(session!.membership_id),
      // An ad-hoc row overrides nothing; a recurring one overrides its own
      // original slot so the client moves that occurrence in place.
      recurrenceId: isAdhoc
        ? undefined
        : (session?.moved_from ?? session?.scheduled_at ?? undefined),
      start: when,
      summary,
      description,
      status: method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED',
    });

    const facts = {
      studentName,
      oldTime: oldTime ?? session?.scheduled_at ?? '',
      newTime,
      reinstated,
      added,
      circleName: circle?.name ?? '',
      teacherName,
    };
    const subject = (locale: RecipientLocale) =>
      added
        ? pickText(locale, 'Extra session added', 'جلسة إضافية')
        : reinstated
          ? pickText(locale, 'Session back on', 'إعادة الجلسة')
          : newTime
            ? pickText(locale, 'Session rescheduled', 'تغيير موعد الجلسة')
            : pickText(locale, 'Session canceled', 'إلغاء الجلسة');

    await deliver(db, userId, 'session_change', (locale, recipientTz) => ({
      subject: subject(locale),
      html: sessionChangeBody(
        // Recipient's own zone first — teacher and student may differ.
        { ...facts, timezone: recipientTz ?? scheduleTz ?? 'UTC' },
        locale,
      ),
      invite: {
        method,
        organizerName: teacherName || undefined,
        events: [event(studentSummary(circle?.name ?? '', locale), withTeacher(teacherName, locale))],
      },
    }));

    // Teacher's mirror — same uid namespace (a separate mailbox, so no clash),
    // titled by student because every event on their calendar is their own.
    if (!teacherId) return;
    await deliver(db, teacherId, 'session_change', (locale, recipientTz) => ({
      subject: subject(locale),
      html: sessionChangeBody({ ...facts, timezone: recipientTz ?? scheduleTz ?? 'UTC' }, locale),
      invite: {
        method,
        organizerName: teacherName || undefined,
        events: [event(teacherSummary(studentName, locale), withStudent(studentName, locale))],
      },
    }));
  });
}

/**
 * A teacher set, changed or cleared a membership's weekly recurrence. Sends the
 * student — and the teacher — one calendar series covering the whole slot, and
 * an email that states the days and time in words (a recipient whose client
 * ignores the .ics must still learn the schedule).
 *
 * Occurrences are an explicit RDATE list straight out of `recurringSlots`, the
 * same DST-aware generator that materializes the session rows, so the calendar
 * cannot drift from the app the way a UTC-anchored weekly rule would.
 */
export async function notifySchedule(
  membershipId: string,
  schedule: Recurrence | null,
): Promise<void> {
  await bestEffort('schedule', async (db) => {
    const info = await membershipSessionInfo(db, membershipId);
    if (!info) return;

    const slots = schedule ? recurringSlots(schedule, new Date(), INVITE_HORIZON_DAYS) : [];
    // A schedule with no reachable occurrence has nothing to anchor DTSTART to.
    if (schedule && slots.length === 0) return;

    const cleared = !schedule;
    const method = cleared ? ('CANCEL' as const) : ('REQUEST' as const);
    const event = (summary: string, description: string): IcsEvent => ({
      uid: seriesUid(membershipId),
      // Re-sending the same uid replaces the series rather than stacking a
      // second copy beside it, which is why editing a rule is safe to repeat.
      start: slots[0] ?? new Date().toISOString(),
      rdates: slots.slice(1),
      summary,
      description,
      status: cleared ? 'CANCELLED' : 'CONFIRMED',
    });
    const facts = {
      weekdays: schedule?.weekdays ?? [],
      time: schedule?.time ?? '',
      timezone: schedule?.timezone ?? null,
      circleName: info.circleName,
      teacherName: info.teacherName,
      cleared,
    };
    const subject = (locale: RecipientLocale) =>
      cleared
        ? pickText(locale, 'Session schedule canceled', 'إلغاء مواعيد الجلسات')
        : pickText(locale, 'Your session schedule', 'مواعيد جلساتك');

    await deliver(db, info.studentId, 'session_change', (locale) => ({
      subject: subject(locale),
      html: scheduleBody({ ...facts, studentName: info.studentName }, locale),
      invite: {
        method,
        organizerName: info.teacherName || undefined,
        events: [event(studentSummary(info.circleName, locale), withTeacher(info.teacherName, locale))],
      },
    }));

    if (!info.teacherId) return;
    await deliver(db, info.teacherId, 'session_change', (locale) => ({
      subject: subject(locale),
      html: scheduleBody({ ...facts, studentName: info.studentName }, locale),
      invite: {
        method,
        organizerName: info.teacherName || undefined,
        events: [event(teacherSummary(info.studentName, locale), withStudent(info.studentName, locale))],
      },
    }));
  });
}

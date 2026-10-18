import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgendaTask, Circle, Exam, Homework, Membership, MembershipNote, MemberWithProfile, Profile, ProgressLog, Session, MemorizedRange } from '@/types';
import type { MembershipWithCircle, RosterMember } from '@/lib/services/membership';
import type { NoteWithAuthor } from '@/lib/services/membershipNotes';
import type { CoveringSession } from '@/lib/services/substitution';
import type { StudentWirdSummary } from '@/lib/services/wird';
import { markedPages } from '@/lib/services/markedPages';
import { sectionAgenda, DONE_RETENTION_DAYS } from '@/lib/agenda';
import { displayName } from '@/lib/displayName';
import { rangesTotals } from '@/lib/analytics';
import { floatingNow, sectionSessions } from '@/lib/recurrence';
import { addDays, localDate } from '@/lib/localDate';
import { dayNumber } from '@/lib/wirdRead';
import { railCircles, COVERING_RAIL_ID, type RailCircle } from '@/lib/tracker/railCircles';

// Tracker reads, client-agnostic (PRD 0016 E1, like wirdRead.ts): the browser reads them
// through TanStack Query (RLS is the boundary) and the server actions in services/* reuse
// the ones they still need. The load* functions are what each tracker page used to await.

type Supa = SupabaseClient;

function ok<T>({ data, error }: { data: T | null; error: unknown }): T | null {
  if (error) throw error;
  return data;
}

export async function getCircle(sb: Supa, id: string): Promise<Circle | null> {
  return ok(await sb.from('circle').select('*').eq('id', id).maybeSingle());
}

export async function getCircleMembers(sb: Supa, circleId: string): Promise<Membership[]> {
  return ok(await sb.from('membership').select('*').eq('circle_id', circleId).order('joined_at', { ascending: true })) ?? [];
}

/** Profiles for these ids, keyed by id. RLS returns only readable rows; callers fall back to a short-id tag. */
export async function getProfilesByIds(sb: Supa, ids: string[]): Promise<Map<string, Profile>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const rows = ok(await sb.from('profiles').select('id, first_name, last_name').in('id', unique)) ?? [];
  return new Map((rows as Profile[]).map((p) => [p.id, p] as const));
}

export async function getCircleMembersWithProfiles(sb: Supa, circleId: string): Promise<MemberWithProfile[]> {
  const members = await getCircleMembers(sb, circleId);
  const profiles = await getProfilesByIds(sb, members.map((m) => m.user_id));
  return members.map((m) => {
    const p = profiles.get(m.user_id);
    return { ...m, first_name: p?.first_name, last_name: p?.last_name };
  });
}

/** Must scope to the caller: membership RLS also shows a teacher their students' rows. */
export async function getMyMembershipsWithCircle(sb: Supa, userId: string): Promise<MembershipWithCircle[]> {
  return (ok(await sb.from('membership').select('*, circle:circle_id(*)').eq('user_id', userId).order('joined_at', { ascending: false })) ?? []) as MembershipWithCircle[];
}

export async function getSessions(sb: Supa, membershipId: string): Promise<Session[]> {
  return ok(await sb.from('session').select('*').eq('membership_id', membershipId).order('scheduled_at', { ascending: true })) ?? [];
}

export async function getSessionsForMemberships(sb: Supa, ids: string[]): Promise<Session[]> {
  if (ids.length === 0) return [];
  return ok(await sb.from('session').select('*').in('membership_id', ids).order('scheduled_at', { ascending: true })) ?? [];
}

async function getLogs(sb: Supa, membershipId: string): Promise<ProgressLog[]> {
  return ok(await sb.from('progress_log').select('*').eq('membership_id', membershipId).order('log_date', { ascending: false })) ?? [];
}

async function listHomework(sb: Supa, membershipId: string): Promise<Homework[]> {
  return ok(await sb.from('homework').select('*').eq('membership_id', membershipId).order('created_at', { ascending: false })) ?? [];
}

async function getExams(sb: Supa, membershipId: string): Promise<Exam[]> {
  return ok(await sb.from('exam').select('*').eq('membership_id', membershipId).order('scheduled_date', { ascending: false })) ?? [];
}

async function listNotes(sb: Supa, membershipId: string): Promise<NoteWithAuthor[]> {
  const rows = (ok(await sb.from('membership_note').select('*').eq('membership_id', membershipId).order('created_at', { ascending: false })) ?? []) as MembershipNote[];
  const profiles = await getProfilesByIds(sb, rows.map((r) => r.author_id));
  return rows.map((r) => {
    const p = profiles.get(r.author_id);
    return { ...r, first_name: p?.first_name, last_name: p?.last_name };
  });
}

/** Student read-only view: open items only, oldest-first (RLS also hides done ones). */
async function listOpenAgenda(sb: Supa, membershipId: string): Promise<AgendaTask[]> {
  const rows = ok(await sb.from('agenda_item').select('*').eq('membership_id', membershipId).is('done_at', null)) ?? [];
  return sectionAgenda(rows as AgendaTask[], new Date());
}

/** Open items oldest-first, then items done in the last 30 days (0014 C1/C2). RLS (B1) is the gate. */
async function listAgenda(sb: Supa, membershipId: string): Promise<AgendaTask[]> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - DONE_RETENTION_DAYS * 24 * 60 * 60_000).toISOString();
  const rows = ok(await sb.from('agenda_item').select('*').eq('membership_id', membershipId).or(`done_at.is.null,done_at.gte.${cutoff}`)) ?? [];
  return sectionAgenda(rows as AgendaTask[], now);
}

/** Circle roster names via the circle_roster definer RPC (a student can't read sibling rows). */
async function getCircleRoster(sb: Supa, circleId: string): Promise<RosterMember[]> {
  return (ok(await sb.rpc('circle_roster', { _circle: circleId })) ?? []) as RosterMember[];
}

/** The student's default set id (D13); RLS exposes it only while the membership is active. */
async function getStudentDefaultSetId(sb: Supa, membershipId: string): Promise<string | null> {
  const member = ok(await sb.from('membership').select('user_id').eq('id', membershipId).maybeSingle()) as { user_id: string } | null;
  if (!member) return null;
  const set = ok(await sb.from('annotation_sets').select('id').eq('user_id', member.user_id).eq('is_default', true).maybeSingle()) as { id: string } | null;
  return set?.id ?? null;
}

async function getMemorization(sb: Supa, userId: string): Promise<MemorizedRange[]> {
  const row = ok(await sb.from('user_hifth').select('memorized_ranges').eq('user_id', userId).maybeSingle()) as { memorized_ranges?: MemorizedRange[] } | null;
  return row?.memorized_ranges ?? [];
}

type SubRow = { membership_id: string; scheduled_at: string; substitute_user_id: string };

/** Substitution rows for these memberships (F5 covered-by); RLS scopes them. */
export async function listSubstitutions(sb: Supa, ids: string[]): Promise<SubRow[]> {
  if (ids.length === 0) return [];
  return ok(await sb.from('substitution').select('membership_id, scheduled_at, substitute_user_id').in('membership_id', ids)) ?? [];
}

/** The caller's own live coverage (0013 G3). */
export async function getCovering(sb: Supa): Promise<CoveringSession[]> {
  return (ok(await sb.rpc('covering_sessions')) ?? []) as CoveringSession[];
}

/** Every entry_date of the caller's wird entries (merged streak, 0015 E5). */
async function listWirdEntryDates(sb: Supa, userId: string): Promise<string[]> {
  const rows = ok(await sb.from('wird_entry').select('entry_date, wird!inner(user_id)').eq('wird.user_id', userId)) ?? [];
  return (rows as { entry_date: string }[]).map((e) => e.entry_date);
}

/** Read-only wird summary of one student for their teacher (0015 L1); RLS B3 is the gate. */
export async function getStudentWirdSummary(sb: Supa, userId: string, today: string): Promise<StudentWirdSummary | null> {
  const list = (ok(await sb.from('wird').select('id, name').eq('user_id', userId).is('deleted_at', null).order('created_at', { ascending: true })) ?? []) as { id: string; name: string }[];
  if (list.length === 0) return null;
  const entries = (ok(await sb.from('wird_entry').select('wird_id, entry_date').in('wird_id', list.map((w) => w.id))) ?? []) as { wird_id: string; entry_date: string }[];
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const lastDone = entries.reduce<string | null>((max, e) => (max === null || e.entry_date > max ? e.entry_date : max), null);
  return {
    wirds: list.map((w) => {
      const done = new Set(entries.filter((e) => e.wird_id === w.id).map((e) => e.entry_date));
      return { id: w.id, name: w.name, week: days.map((d) => done.has(d)) };
    }),
    days_since_last: lastDone === null ? null : dayNumber(today) - dayNumber(lastDone),
  };
}

/** Session user id (local session read; RLS, not this id, gates the data). */
async function myId(sb: Supa): Promise<string | null> {
  const { data } = await sb.auth.getSession();
  return data.session?.user.id ?? null;
}

const nameOf = (profiles: Map<string, Profile>, id: string) => {
  const p = profiles.get(id);
  return displayName({ user_id: id, first_name: p?.first_name, last_name: p?.last_name });
};

// --- Page loaders ------------------------------------------------------------

/** Rail circles (active, pending, then the 0013 covering pseudo-circle while there is coverage). */
export async function loadRail(sb: Supa): Promise<{ circles: RailCircle[]; first: string | null; covering: boolean }> {
  const uid = await myId(sb);
  if (!uid) return { circles: [], first: null, covering: false };
  const [memberships, covering] = await Promise.all([getMyMembershipsWithCircle(sb, uid), getCovering(sb)]);
  const circles = railCircles(memberships);
  if (covering.length > 0) circles.push({ id: COVERING_RAIL_ID, name: '', pending: false, teaching: false, covering: true });
  // /tracker opens the first circle (active preferred, else a pending invite).
  const first = memberships.find((m) => m.status === 'active') ?? memberships.find((m) => m.status === 'pending');
  return { circles, first: first?.circle_id ?? null, covering: covering.length > 0 };
}

export type CircleView =
  | { kind: 'notFound' }
  | { kind: 'teacher'; circle: Circle; teacher?: MemberWithProfile; students: MemberWithProfile[];
      nextSlots: Record<string, { slots: { scheduled_at: string; canceled: boolean }[]; minutes: number }> }
  | { kind: 'pending'; membershipId: string; circleName: string; teacherName: string }
  | { kind: 'student'; circle: Circle; membership: Membership; sessions: Session[]; logs: ProgressLog[]; homework: Homework[];
      notes: NoteWithAuthor[]; exams: Exam[]; roster: RosterMember[]; selfUserId: string; memorized: ReturnType<typeof rangesTotals>;
      defaultSetId: string | null; markedPages: Awaited<ReturnType<typeof markedPages>>; coveredBy: Record<string, string>; wirdDates: string[];
      agenda: AgendaTask[] };

export async function loadCircle(sb: Supa, circleId: string): Promise<CircleView> {
  const [uid, circle, members] = await Promise.all([myId(sb), getCircle(sb, circleId), getCircleMembersWithProfiles(sb, circleId)]);
  if (!uid || !circle) return { kind: 'notFound' };

  if (circle.teacher_id === uid) {
    const students = members.filter((m) => m.role === 'student');
    // 0014 G1/G3: one query for the whole roster, next slot + a few upcoming derived in memory.
    const active = students.filter((m) => m.status === 'active');
    const rosterSessions = await getSessionsForMemberships(sb, active.map((m) => m.id));
    const nowDate = floatingNow();
    const nextSlots: Extract<CircleView, { kind: 'teacher' }>['nextSlots'] = {};
    for (const m of active) {
      const { next, upcoming } = sectionSessions(m.schedule, rosterSessions.filter((s) => s.membership_id === m.id), nowDate);
      const slots = [next, ...upcoming.slice(0, 3)].filter((x) => x !== null)
        .map((x) => ({ scheduled_at: x.scheduled_at, canceled: x.session?.canceled ?? false }));
      if (slots.length) nextSlots[m.id] = { slots, minutes: m.schedule?.minutes ?? 60 };
    }
    return { kind: 'teacher', circle, teacher: members.find((m) => m.role === 'teacher'), students, nextSlots };
  }

  // Student self-view. Left/deactivated = not theirs to open, same as never joined.
  const membership = members.find((m) => m.user_id === uid);
  if (!membership || membership.status === 'inactive' || membership.status === 'blocked') return { kind: 'notFound' };

  // Consent gate (C3/C4): a pending student must accept before any data view.
  if (membership.status === 'pending') {
    const tp = await getProfilesByIds(sb, [circle.teacher_id]);
    return { kind: 'pending', membershipId: membership.id, circleName: circle.name, teacherName: nameOf(tp, circle.teacher_id) };
  }

  const [logs, sessions, homework, notes, roster, exams, defaultSetId, ranges, wirdDates, subs, agenda] = await Promise.all([
    getLogs(sb, membership.id),
    getSessions(sb, membership.id),
    listHomework(sb, membership.id),
    listNotes(sb, membership.id),
    getCircleRoster(sb, circleId),
    getExams(sb, membership.id),
    getStudentDefaultSetId(sb, membership.id),
    getMemorization(sb, uid),
    listWirdEntryDates(sb, uid),
    listSubstitutions(sb, [membership.id]),
    listOpenAgenda(sb, membership.id),
  ]);
  // C2: own default-set marked pages; covered-by names are best-effort (F5/D13).
  const [marked, subProfiles] = await Promise.all([
    defaultSetId ? markedPages(sb, defaultSetId) : [],
    getProfilesByIds(sb, subs.map((s) => s.substitute_user_id)),
  ]);
  const coveredBy: Record<string, string> = {};
  for (const s of subs) coveredBy[String(new Date(s.scheduled_at).getTime())] = nameOf(subProfiles, s.substitute_user_id);

  return {
    kind: 'student', circle, membership, sessions, logs, homework, notes, exams, roster, selfUserId: uid,
    memorized: rangesTotals(ranges), defaultSetId, markedPages: marked, coveredBy, wirdDates, agenda,
  };
}

export type StudentView =
  | { kind: 'notFound' }
  | { kind: 'sub'; rows: CoveringSession[]; sessions: Session[]; logs: ProgressLog[]; homework: Homework[] }
  | { kind: 'teacher'; circle: Circle; member: MemberWithProfile; sessions: Session[]; defaultSetId: string | null; homework: Homework[];
      logs: ProgressLog[]; memorized: ReturnType<typeof rangesTotals>; notes: NoteWithAuthor[]; exams: Exam[];
      markedPages: Awaited<ReturnType<typeof markedPages>>; subByInstant: Record<string, string>; actorNames: Record<string, string>;
      agenda: AgendaTask[]; wirdSummary: StudentWirdSummary | null };

export async function loadStudent(sb: Supa, circleId: string, membershipId: string): Promise<StudentView> {
  const [uid, circle, members] = await Promise.all([myId(sb), getCircle(sb, circleId), getCircleMembersWithProfiles(sb, circleId)]);
  if (!uid) return { kind: 'notFound' };

  // 0013 G2: the circle teacher gets the full surface; an ACTIVE covering substitute the scoped
  // one. Coverage is the DB helper's call (12h expiry stays the DB's single source of truth).
  if (!circle || circle.teacher_id !== uid) {
    const covers = ok(await sb.rpc('covers_membership', { _membership: membershipId }));
    if (!covers) return { kind: 'notFound' };
    // covering_sessions() is the sub's only readable source of names + instants (D4/D5).
    const rows = (await getCovering(sb)).filter((r) => r.membership_id === membershipId);
    if (rows.length === 0) return { kind: 'notFound' };
    const [sessions, logs, homework] = await Promise.all([getSessions(sb, membershipId), getLogs(sb, membershipId), listHomework(sb, membershipId)]);
    return { kind: 'sub', rows, sessions, logs, homework };
  }

  // Only active students have a control surface (pending = RLS-empty, C1/S1).
  const member = members.find((m) => m.id === membershipId);
  if (!member || member.role !== 'student' || member.status !== 'active') return { kind: 'notFound' };

  const [logs, sessions, defaultSetId, homework, notes, ranges, exams, agenda, subs, wirdSummary] = await Promise.all([
    getLogs(sb, membershipId),
    getSessions(sb, membershipId),
    getStudentDefaultSetId(sb, membershipId),
    listHomework(sb, membershipId),
    listNotes(sb, membershipId),
    getMemorization(sb, member.user_id),
    getExams(sb, membershipId),
    listAgenda(sb, membershipId),
    listSubstitutions(sb, [membershipId]),
    // Today in the viewer's zone: the browser's own clock is the user's day (0015 D20).
    getStudentWirdSummary(sb, member.user_id, localDate(Intl.DateTimeFormat().resolvedOptions().timeZone)),
  ]);
  const actorIds = [
    circle.teacher_id,
    ...sessions.map((s) => s.marked_by).filter((x): x is string => !!x),
    ...logs.map((l) => l.graded_by).filter((x): x is string => !!x),
    ...subs.map((s) => s.substitute_user_id),
  ];
  const [marked, profiles] = await Promise.all([
    defaultSetId ? markedPages(sb, defaultSetId) : [],
    getProfilesByIds(sb, actorIds),
  ]);
  const actorNames: Record<string, string> = {};
  for (const id of new Set(actorIds)) actorNames[id] = nameOf(profiles, id);
  const subByInstant: Record<string, string> = {};
  for (const s of subs) subByInstant[String(new Date(s.scheduled_at).getTime())] = nameOf(profiles, s.substitute_user_id);

  return {
    kind: 'teacher', circle, member, sessions, defaultSetId, homework, logs, memorized: rangesTotals(ranges),
    notes, exams, markedPages: marked, subByInstant, actorNames, agenda, wirdSummary,
  };
}

/** One assignable instant in the Manage-sessions list (mirrors AgendaItem). */
export interface ManageSlot {
  key: string;
  membershipId: string;
  sessionId: string | null;
  scheduled_at: string;
  isAdhoc: boolean;
  canceled: boolean;
  movedFrom: string | null;
  student: string;
  substituteName: string | null;
}

/**
 * Every upcoming instant across the circle's active students out to `horizonDays`. Unlike the
 * dashboard agenda (one next slot per student) this is the full expansion, so the Manage-sessions
 * tab pages forward by asking for a bigger horizon. Slots are virtual until touched: the
 * recurrence rule IS the source, so there is nothing to paginate in the database.
 */
export async function getManageSlots(sb: Supa, circleId: string, horizonDays: number): Promise<ManageSlot[]> {
  const active = (await getCircleMembersWithProfiles(sb, circleId))
    .filter((m) => m.role === 'student' && m.status === 'active');
  if (active.length === 0) return [];
  const ids = active.map((m) => m.id);
  const nowDate = floatingNow();
  const now = nowDate.getTime();
  const [sessions, subs] = await Promise.all([getSessionsForMemberships(sb, ids), listSubstitutions(sb, ids)]);
  const subProfiles = await getProfilesByIds(sb, subs.map((s) => s.substitute_user_id));
  const subKey = (mid: string, at: string) => `${mid}|${new Date(at).getTime()}`;
  const subByInstant = new Map(subs.map((s) => {
    const p = subProfiles.get(s.substitute_user_id);
    return [subKey(s.membership_id, s.scheduled_at), displayName({ user_id: s.substitute_user_id, first_name: p?.first_name, last_name: p?.last_name })] as const;
  }));
  return active
    .flatMap((m) => {
      const { next, upcoming } = sectionSessions(m.schedule, sessions.filter((s) => s.membership_id === m.id), nowDate, horizonDays);
      return [...(next ? [next] : []), ...upcoming]
        .filter((slot) => new Date(slot.scheduled_at).getTime() >= now)
        .map((slot) => ({
          key: slot.session?.id ?? `${m.id}-${slot.scheduled_at}`,
          membershipId: m.id,
          sessionId: slot.session?.id ?? null,
          scheduled_at: slot.scheduled_at,
          isAdhoc: slot.session?.is_adhoc ?? false,
          canceled: slot.session?.canceled ?? false,
          movedFrom: slot.session?.moved_from ?? null,
          student: displayName(m),
          substituteName: subByInstant.get(subKey(m.id, slot.scheduled_at)) ?? null,
        }));
    })
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
}

import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { getCircle } from '@/lib/services/circle';
import { getCircleMembersWithProfiles, getStudentDefaultSetId } from '@/lib/services/membership';
import { getLogsForMembership } from '@/lib/services/progressLog';
import { getSessions } from '@/lib/services/sessions';
import { listHomework } from '@/lib/services/homework';
import { listNotes } from '@/lib/services/membershipNotes';
import { getExamsForMembership } from '@/lib/services/exam';
import { getStudentMemorization, getProfilesByIds } from '@/lib/services/profile';
import { listSubstitutions, getCoveringFor } from '@/lib/services/substitution';
import SubStudent from '@/components/tracker/SubStudent';
import { displayName } from '@/lib/displayName';
import { rangesTotals } from '@/lib/analytics';
import { markedPages as fetchMarkedPages } from '@/lib/services/markedPages';
import TeacherStudent from '@/components/tracker/TeacherStudent';
import MarkCircleReady from '@/components/tracker/CircleReady';
import { getLocale } from '@/lib/i18n/server';
import { getDictionary } from '@/lib/i18n/dictionaries';

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ circleId: string; membershipId: string }>;
}) {
  const { circleId, membershipId } = await params;
  const dict = getDictionary(await getLocale());
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 0013 G2: the circle teacher gets the full surface; an ACTIVE covering
  // substitute gets the scoped one. Coverage is decided by the DB helper — never
  // re-derived here — so the 12h expiry (B1/B4) stays the DB's single source of
  // truth. Anyone else is notFound(), exactly as before. getCircle() is not a
  // guard for the sub: they may not be able to read the circle at all (D5).
  const circle = await getCircle(circleId);
  if (!circle || circle.teacher_id !== user.id) {
    const { data: covers } = await supabase.rpc('covers_membership', { _membership: membershipId });
    if (!covers) notFound();
    // covering_sessions() is the sub's only readable source of names + instants
    // (membership/circle/profiles are RLS-hidden from them, D4/D5).
    const rows = await getCoveringFor(membershipId);
    if (rows.length === 0) notFound();
    const [sessions, subLogs] = await Promise.all([
      getSessions(membershipId),
      getLogsForMembership(membershipId),
    ]);
    return (
      <main className="px-4 py-6 animate-fade-in w-full" style={{ overflowY: 'auto', height: '100%' }}>
        <SubStudent
          membershipId={membershipId}
          studentName={rows[0].student_name || dict['tracker.roleStudent']}
          circleName={rows[0].circle_name}
          teacherName={rows[0].teacher_name}
          coveredInstants={rows.map((r) => r.scheduled_at)}
          initialSessions={sessions}
          logs={subLogs}
          teacherStatuses={rows[0].teacher_statuses ?? []}
          defaultSetId={rows[0].default_set_id}
          teacherId={rows[0].teacher_id}
        />
      </main>
    );
  }

  const member = (await getCircleMembersWithProfiles(circleId)).find((m) => m.id === membershipId);
  // Only active students have a control surface (pending = RLS-empty, C1/S1).
  if (!member || member.role !== 'student' || member.status !== 'active') notFound();

  const [logs, sessions, defaultSetId, homework, notes, memorizedRanges, exams] = await Promise.all([
    getLogsForMembership(membershipId),
    getSessions(membershipId),
    getStudentDefaultSetId(membershipId),
    listHomework(membershipId),
    listNotes(membershipId),
    getStudentMemorization(member.user_id),
    getExamsForMembership(membershipId),
  ]);

  const memorized = rangesTotals(memorizedRanges);
  // C1: default-set marked pages. RLS: teacher reads via the set_collaborators grant
  // created at membership-accept. No default set → empty list (C3 empty state).
  const marked = defaultSetId ? await fetchMarkedPages(supabase, defaultSetId) : [];

  // 0013: covered-by per instant (F5) + attribution names (E4/E5). Actor names
  // are best-effort — a substitute's profile may be RLS-hidden from the teacher.
  const subs = await listSubstitutions([membershipId]);
  const actorIds = [
    circle.teacher_id,
    ...sessions.map((s) => s.marked_by).filter((x): x is string => !!x),
    ...logs.map((l) => l.graded_by).filter((x): x is string => !!x),
    ...subs.map((s) => s.substitute_user_id),
  ];
  const profiles = await getProfilesByIds(actorIds);
  const nameOf = (id: string) => {
    const p = profiles.get(id);
    return displayName({ user_id: id, first_name: p?.first_name, last_name: p?.last_name });
  };
  const actorNames: Record<string, string> = {};
  for (const id of new Set(actorIds)) actorNames[id] = nameOf(id);
  const subByInstant: Record<string, string> = {};
  for (const s of subs) subByInstant[String(new Date(s.scheduled_at).getTime())] = nameOf(s.substitute_user_id);

  return (
    <main className="px-4 py-6 animate-fade-in w-full" style={{ overflowY: 'auto', height: '100%' }}>
      <MarkCircleReady />
      <div className="max-w-[96rem] mx-auto w-full" style={{ position: 'relative' }}>
        <TeacherStudent
          circle={circle}
          member={member}
          initialSessions={sessions}
          defaultSetId={defaultSetId}
          initialHomework={homework}
          logs={logs}
          memorized={memorized}
          initialNotes={notes}
          initialExams={exams}
          markedPages={marked}
          subByInstant={subByInstant}
          actorNames={actorNames}
        />
      </div>
    </main>
  );
}

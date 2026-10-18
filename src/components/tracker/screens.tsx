'use client';

import { useEffect } from 'react';
import { notFound, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { qk } from '@/lib/query/keys';
import { usePathname, useHydrated } from '@/lib/i18n/usePathname';
import { loadCircle, loadStudent, getCovering } from '@/lib/tracker/reads';
import { useRail } from './CircleRail';
import { useI18n } from '@/components/I18nProvider';
import QueryFallback from '@/components/QueryFallback';
import MarkCircleReady from './CircleReady';
import CircleSkeleton from './CircleSkeleton';
import CoveringSection from './CoveringSection';
import TeacherCircle from './TeacherCircle';
import StudentCircle from './StudentCircle';
import AcceptInvite from './AcceptInvite';
import TeacherStudent from './TeacherStudent';
import SubStudent from './SubStudent';
import { EmptyState } from './ui';

// Tracker screens (PRD 0016 M6). Each route is a static shell; data is read in the browser
// through TanStack Query (RLS is the boundary). Dynamic ids come from the visible URL after
// hydration: /tracker/<id> is served by the static /tracker/circle route (src/lib/shellRewrites.json).

const COLUMN = 'px-4 py-6 animate-fade-in w-full overflow-y-auto h-full';

/** Visible path segments once hydrated; null while the shell hydrates (its own path is the static one). */
function useSegments() {
  const hydrated = useHydrated();
  const path = usePathname();
  return hydrated ? path.split('/') : null;
}

/** /tracker: open the first circle, else the substitute's coverage, else the empty state. */
export function TrackerIndexScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const q = useRail();
  const target = q.data?.first ? `/tracker/${q.data.first}` : q.data?.covering ? '/tracker/covering' : null;
  useEffect(() => { if (target) router.replace(target); }, [target, router]);
  if (!q.data) return <QueryFallback q={q} skeleton={<CircleSkeleton />} />;
  if (target) return <CircleSkeleton />;
  return (
    <main className="max-w-5xl mx-auto px-4 py-8 sm:py-10 animate-fade-in w-full overflow-y-auto h-full">
      <MarkCircleReady />
      <EmptyState>
        <span className="text-secondary font-semibold">{t('tracker.emptyTitle')}</span>
        <span>{t('tracker.emptyHint')}</span>
      </EmptyState>
    </main>
  );
}

/** /tracker/<circleId>: teacher dashboard, consent gate, or student self-view. */
export function CircleScreen() {
  const seg = useSegments();
  // Keyed: every circle shares one static route, so a switch must remount the seeded local state.
  return seg ? <CircleView key={seg[2]} circleId={seg[2]} /> : <CircleSkeleton />;
}

function CircleView({ circleId }: { circleId: string }) {
  const q = useQuery({ queryKey: qk.trackerCircle(circleId), queryFn: () => loadCircle(createClient(), circleId) });
  if (!q.data) return <QueryFallback q={q} skeleton={<CircleSkeleton />} />;
  const d = q.data;
  if (d.kind === 'notFound') notFound();
  if (d.kind === 'pending') {
    return (
      <main className="max-w-2xl mx-auto px-4 py-8 sm:py-10 animate-fade-in w-full overflow-y-auto h-full">
        <MarkCircleReady />
        <AcceptInvite membershipId={d.membershipId} circleName={d.circleName} teacherName={d.teacherName} />
      </main>
    );
  }
  return (
    <main className={COLUMN}>
      <MarkCircleReady />
      <div className="max-w-shell mx-auto w-full relative">
        {d.kind === 'teacher' ? (
          <TeacherCircle circle={d.circle} teacher={d.teacher} initialStudents={d.students} nextSlots={d.nextSlots} />
        ) : (
          <StudentCircle
            circle={d.circle}
            membership={d.membership}
            initialSessions={d.sessions}
            initialLogs={d.logs}
            initialHomework={d.homework}
            initialNotes={d.notes}
            initialExams={d.exams}
            roster={d.roster}
            selfUserId={d.selfUserId}
            memorized={d.memorized}
            defaultSetId={d.defaultSetId}
            markedPages={d.markedPages}
            coveredBy={d.coveredBy}
            initialWirdDates={d.wirdDates}
            agenda={d.agenda}
          />
        )}
      </div>
    </main>
  );
}

/** /tracker/<circleId>/student/<membershipId>: the teacher's control surface or a sub's scoped one. */
export function StudentScreen() {
  const seg = useSegments();
  return seg ? <StudentView key={seg[4]} circleId={seg[2]} membershipId={seg[4]} /> : <CircleSkeleton />;
}

function StudentView({ circleId, membershipId }: { circleId: string; membershipId: string }) {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: qk.trackerStudent(circleId, membershipId),
    queryFn: () => loadStudent(createClient(), circleId, membershipId),
  });
  if (!q.data) return <QueryFallback q={q} skeleton={<CircleSkeleton />} />;
  const d = q.data;
  if (d.kind === 'notFound') notFound();
  return (
    <main className={COLUMN}>
      <MarkCircleReady />
      <div className="max-w-shell mx-auto w-full relative">
        {d.kind === 'sub' ? (
          <SubStudent
            membershipId={membershipId}
            studentName={d.rows[0].student_name || t('tracker.roleStudent')}
            circleName={d.rows[0].circle_name}
            teacherName={d.rows[0].teacher_name}
            coveredInstants={d.rows.map((r) => r.scheduled_at)}
            initialSessions={d.sessions}
            logs={d.logs}
            teacherStatuses={d.rows[0].teacher_statuses ?? []}
            defaultSetId={d.rows[0].default_set_id}
            teacherId={d.rows[0].teacher_id}
            homework={d.homework}
          />
        ) : (
          <TeacherStudent
            circle={d.circle}
            member={d.member}
            initialSessions={d.sessions}
            defaultSetId={d.defaultSetId}
            initialHomework={d.homework}
            logs={d.logs}
            memorized={d.memorized}
            initialNotes={d.notes}
            initialExams={d.exams}
            markedPages={d.markedPages}
            subByInstant={d.subByInstant}
            actorNames={d.actorNames}
            initialAgenda={d.agenda}
            wirdSummary={d.wirdSummary}
          />
        )}
      </div>
    </main>
  );
}

/** /tracker/covering (0013 G1): the substitute's own temporary "circle". */
export function CoveringScreen() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: qk.trackerCovering, queryFn: () => getCovering(createClient()) });
  if (!q.data) return <QueryFallback q={q} skeleton={<CircleSkeleton />} />;
  return (
    <main className="max-w-5xl mx-auto px-4 py-6 animate-fade-in w-full overflow-y-auto h-full">
      <MarkCircleReady />
      {/* Empty once the last covered instant expired out of the RPC. */}
      {q.data.length === 0 ? <EmptyState>{t('subs.coveringEmpty')}</EmptyState> : <CoveringSection rows={q.data} />}
    </main>
  );
}

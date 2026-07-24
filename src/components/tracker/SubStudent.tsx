'use client';

// 0013 G2 — the covering substitute's scoped student page. Same SHELL as the
// teacher's view (profile sidebar + tab feed) so it reads as the familiar
// screen, but only the tabs a sub may act on: sessions they cover, homework
// they can mark, and the progress feed. Every teacher control (cancel,
// reschedule, ad-hoc, schedule, exams, notes, roster, deactivate, assign-sub)
// is absent rather than rendered-and-403'd (D1-D5). RLS is still the real gate.
import { useMemo, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import type { AttendanceStatus, Homework, ProgressLog, Session, StatusConfig } from '@/types';
import { materializeSession, setSessionAttendance } from '@/lib/services/sessions';
import { GradeableLog, HomeworkPanel, StudentProfileCard } from './TeacherStudent';
import { homeworkStatus } from '@/lib/homework';
import { Attribution, AttributionProvider } from './subs';
import { SectionTitle, EmptyState, DateChip, TabBar } from './ui';

const ATT_STATUSES: AttendanceStatus[] = ['present', 'late', 'absent', 'excused'];
const today = () => new Date().toISOString().slice(0, 10);
const key = (iso: string) => String(new Date(iso).getTime());

export default function SubStudent({
  membershipId, studentName, circleName, teacherName, coveredInstants, initialSessions, logs,
  teacherStatuses, studentStatuses, defaultSetId, teacherId, homework,
}: {
  membershipId: string;
  studentName: string;
  circleName: string;
  teacherName: string;
  /** E5: without it every graded log would read "· sub", including the teacher's own. */
  teacherId: string;
  /** C4: grade labels straight off covering_sessions() — no circle read (D5). */
  teacherStatuses: StatusConfig[];
  /** Student-status chips for the homework result form (same RPC, same reason). */
  studentStatuses: StatusConfig[];
  /** Prescriptions the sub may mark against — read-only; they can't set homework. */
  homework: Homework[];
  /** C5: the covered student's default set, opened READ-ONLY via /share. */
  defaultSetId: string | null;
  /** Instants this user actively covers (from covering_sessions()). */
  coveredInstants: string[];
  initialSessions: Session[];
  logs: ProgressLog[];
}) {
  const { t, locale, fmtNum } = useI18n();
  const [tab, setTab] = useState('sessions');
  const [sessions, setSessions] = useState(initialSessions);
  const [logRows, setLogRows] = useState(logs);
  const [err, setErr] = useState<string | null>(null);

  // C4: grade fields only. The DB stamps graded_by — never sent from here.
  const onGraded = (id: string, grade: { teacher_status: string | null; teacher_comment: string | null }) =>
    setLogRows((p) => p.map((l) => (l.id === id ? { ...l, ...grade, reviewed_at: new Date().toISOString() } : l)));

  const covered = new Set(coveredInstants.map(key));
  const rowFor = (iso: string) => sessions.find((s) => key(s.scheduled_at) === key(iso));
  // Sessions outside the covered instants are read-only history (C1 read only).
  const others = sessions
    .filter((s) => !covered.has(key(s.scheduled_at)))
    .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));

  // Same KPI inputs the teacher's sidebar uses, off the data a sub can read.
  const attendance = useMemo(
    () => sessions.filter((s) => s.attendance_status).map((s) => ({ status: s.attendance_status! })),
    [sessions],
  );
  const openHomework = useMemo(() => {
    const linked = new Map<string, number>();
    for (const l of logRows) if (l.homework_id) linked.set(l.homework_id, (linked.get(l.homework_id) ?? 0) + 1);
    return homework.filter((h) => homeworkStatus(h, linked.get(h.id) ?? 0, today()) === 'open').length;
  }, [homework, logRows]);

  async function mark(iso: string, status: AttendanceStatus) {
    try {
      // A3: the covered instant may be virtual — materialize on first touch.
      const s = rowFor(iso) ?? await materializeSession(membershipId, iso);
      setSessions((p) => (p.some((x) => x.id === s.id) ? p : [...p, s]));
      const next = s.attendance_status === status ? null : status;
      await setSessionAttendance(s.id, next);
      setSessions((p) => p.map((x) => (x.id === s.id ? { ...x, attendance_status: next } : x)));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const dateLine = (iso: string) =>
    fmtNum(new Date(iso).toLocaleString(locale, {
      weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    }));

  return (
    // E5: the away teacher is the only name a sub can resolve (their own and any
    // other sub's profile stays RLS-hidden → generic "· sub" label).
    <AttributionProvider teacherId={teacherId} names={{ [teacherId]: teacherName }}>
    <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_280px] gap-5">
      {/* memorized omitted: user_hifth is not readable by a sub, so the rings
          are hidden rather than shown as zeros. */}
      <StudentProfileCard
        name={studentName}
        circleName={`${circleName} · ${t('subs.awayTeacher', { teacher: teacherName })}`}
        defaultSetId={defaultSetId}
        attendance={attendance}
        openHomework={openHomework}
      />

      <div className="flex flex-col gap-5 min-w-0">
        {/* The feed starts with the TabBar exactly as the teacher's does — the
            covering context lives in the sidebar subtitle, not a banner. */}
        <TabBar
          tabs={[
            { key: 'sessions', label: t('sessions.tabSessions') },
            { key: 'homework', label: t('homework.title') },
            { key: 'progress', label: t('subs.recentProgress') },
          ]}
          active={tab}
          onSelect={setTab}
        />

        {err && (
          <div className="card" role="alert" style={{ padding: '10px 14px', color: 'var(--danger)', background: 'var(--danger-muted)', borderColor: 'var(--danger-muted)', fontSize: 13 }}>
            {err}
          </div>
        )}

        {tab === 'sessions' && (<>
          {/* Covered instants — the only attendance-writable slots (C2/D1). */}
          <div className="flex flex-col gap-2">
            <SectionTitle trailing={<span className="badge" style={{ fontSize: 10 }}>{t('subs.badge')}</span>}>
              {t('subs.covering')}
            </SectionTitle>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('subs.scopedNote')}</span>
            {coveredInstants.map((iso) => {
              const s = rowFor(iso);
              return (
                <div key={iso} className="card flex flex-col gap-2" style={{ padding: '12px 14px' }}>
                  <div className="flex items-center gap-3">
                    <DateChip iso={iso} locale={locale} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{dateLine(iso)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ATT_STATUSES.map((st) => (
                      <button key={st} onClick={() => mark(iso, st)}
                              className={s?.attendance_status === st ? 'btn btn-primary' : 'btn btn-ghost'}
                              style={{ minHeight: 30, fontSize: 11, padding: '0 12px' }}>
                        {t(`att.${st}`)}
                      </button>
                    ))}
                  </div>
                  <Attribution actorId={s?.marked_by} />
                </div>
              );
            })}
          </div>

          {/* Read-only context: past/other sessions (C1). */}
          {others.length > 0 && (
            <div className="flex flex-col gap-2">
              <SectionTitle>{t('sessions.history')}</SectionTitle>
              {others.slice(0, 10).map((s) => (
                <div key={s.id} className="card flex items-center gap-3" style={{ padding: '10px 14px', opacity: s.canceled ? 0.5 : 1 }}>
                  <DateChip iso={s.scheduled_at} locale={locale} />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{dateLine(s.scheduled_at)}</span>
                  {s.canceled && <span className="badge badge-muted" style={{ fontSize: 10 }}>{t('sessions.canceled')}</span>}
                  {!s.canceled && s.attendance_status && (
                    <span className="badge" style={{ fontSize: 10 }}>{t(`att.${s.attendance_status}`)}</span>
                  )}
                  <Attribution actorId={s.marked_by} />
                </div>
              ))}
            </div>
          )}
        </>)}

        {/* Marking a homework is a graded progress_log against it — prescribing,
            deadline edits and delete stay teacher-only (canPrescribe=false). */}
        {tab === 'homework' && (
          <HomeworkPanel
            membershipId={membershipId}
            initial={homework}
            logs={logRows}
            teacherStatuses={teacherStatuses}
            studentStatuses={studentStatuses}
            canPrescribe={false}
          />
        )}

        {tab === 'progress' && (
          <div className="flex flex-col gap-2">
            {logRows.length === 0 ? (
              <EmptyState>{t('log.empty')}</EmptyState>
            ) : (
              // C4 — the same inline grader the teacher gets: grade + comment only
              // (D2: no page/surah/ayah/student-field editing anywhere in it).
              logRows.slice(0, 10).map((l) => (
                <div key={l.id} className="card" style={{ padding: '10px 14px' }}>
                  <GradeableLog log={l} statuses={teacherStatuses} onGraded={onGraded} />
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Mirrors the sidebar width so the feed sits centered, as on the teacher view. */}
      <div className="hidden lg:block" aria-hidden />
    </div>
    </AttributionProvider>
  );
}

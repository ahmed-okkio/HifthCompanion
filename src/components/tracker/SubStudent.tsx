'use client';

// 0013 G2 — the covering substitute's scoped student page. Deliberately NOT the
// teacher surface: a sub may only read sessions/progress and mark attendance on
// the instants they cover (C1-C3), so every teacher control (cancel, reschedule,
// ad-hoc, schedule, homework, exams, notes, roster, deactivate, assign-sub) is
// absent here rather than rendered-and-403'd (D1-D5). RLS is still the real gate.
import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import type { AttendanceStatus, ProgressLog, Session, StatusConfig } from '@/types';
import { materializeSession, setSessionAttendance } from '@/lib/services/sessions';
import { GradeableLog, MushafButton } from './TeacherStudent';
import { Attribution, AttributionProvider } from './subs';
import { SectionTitle, EmptyState, Avatar, DateChip } from './ui';

const ATT_STATUSES: AttendanceStatus[] = ['present', 'late', 'absent', 'excused'];
const key = (iso: string) => String(new Date(iso).getTime());

export default function SubStudent({
  membershipId, studentName, circleName, teacherName, coveredInstants, initialSessions, logs,
  teacherStatuses, defaultSetId, teacherId,
}: {
  membershipId: string;
  studentName: string;
  circleName: string;
  teacherName: string;
  /** E5: without it every graded log would read "· sub", including the teacher's own. */
  teacherId: string;
  /** C4: grade labels straight off covering_sessions() — no circle read (D5). */
  teacherStatuses: StatusConfig[];
  /** C5: the covered student's default set, opened READ-ONLY via /share. */
  defaultSetId: string | null;
  /** Instants this user actively covers (from covering_sessions()). */
  coveredInstants: string[];
  initialSessions: Session[];
  logs: ProgressLog[];
}) {
  const { t, locale, fmtNum } = useI18n();
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
    <div className="flex flex-col gap-4 max-w-[48rem] mx-auto w-full">
      <div className="card flex items-center gap-3" style={{ padding: '16px 18px' }}>
        <Avatar seed={studentName} size={48} />
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-bold truncate" style={{ color: 'var(--text-primary)', fontSize: 18 }}>{studentName}</span>
          <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
            {circleName} · {t('subs.awayTeacher', { teacher: teacherName })}
          </span>
        </div>
        <span className="badge shrink-0" style={{ fontSize: 10, marginInlineStart: 'auto' }}>{t('subs.badge')}</span>
      </div>

      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('subs.scopedNote')}</div>

      {/* C5 — read-only mushaf. /share resolves the sub to the READ_ONLY branch
          (see resolveShareCapability), so there is no draw/erase/note affordance. */}
      <div><MushafButton setId={defaultSetId} /></div>

      {err && (
        <div className="card" role="alert" style={{ padding: '10px 14px', color: 'var(--danger)', background: 'var(--danger-muted)', borderColor: 'var(--danger-muted)', fontSize: 13 }}>
          {err}
        </div>
      )}

      {/* Covered instants — the only attendance-writable slots (C2/D1). */}
      <div className="flex flex-col gap-2">
        <SectionTitle>{t('subs.covering')}</SectionTitle>
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

      {/* Read-only context: past/other sessions and the progress history (C1/C3). */}
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

      <div className="flex flex-col gap-2">
        <SectionTitle>{t('subs.recentProgress')}</SectionTitle>
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
    </div>
    </AttributionProvider>
  );
}

'use client';

import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { useI18n } from '@/components/I18nProvider';
import type { Attendance, AttendanceStatus, Halaqah, MemberWithProfile, Session } from '@/types';
import { displayName } from '@/lib/displayName';
import { materializeSession } from '@/lib/services/sessions';
import { markAttendance } from '@/lib/services/attendance';
import { dateKeyOf, formatSessionTime, type Slot } from './TeacherSessions';

const ATT_STATUSES: AttendanceStatus[] = ['present', 'late', 'absent', 'excused'];

/** Today's session — where attendance is actually marked. */
export default function ActiveSession({
  halaqah,
  students,
  sessions,
  setSessions,
  attendance,
  setAttendance,
}: {
  halaqah: Halaqah;
  students: MemberWithProfile[];
  sessions: Session[];
  setSessions: Dispatch<SetStateAction<Session[]>>;
  attendance: Attendance[];
  setAttendance: Dispatch<SetStateAction<Attendance[]>>;
}) {
  const { t } = useI18n();
  const todayKey = dateKeyOf(new Date().toISOString());

  // A real non-canceled session today, else the virtual recurring slot if today
  // is a scheduled day. Null when there's nothing on today.
  const active = useMemo<Slot | null>(() => {
    const real = sessions.find((s) => dateKeyOf(s.scheduled_at) === todayKey && !s.canceled);
    if (real) return real;
    const sched = halaqah.schedule;
    if (sched && sched.weekdays.includes(new Date().getDay())) {
      const iso = new Date(`${todayKey}T${sched.time}:00`).toISOString();
      return { id: `v-${iso}`, halaqah_id: halaqah.id, scheduled_at: iso, is_adhoc: false, canceled: false, created_at: '', virtual: true };
    }
    return null;
  }, [sessions, todayKey, halaqah]);

  const statusByMember = useMemo(() => {
    const m = new Map<string, AttendanceStatus>();
    if (active) for (const a of attendance) if (a.session_id === active.id) m.set(a.membership_id, a.status);
    return m;
  }, [attendance, active]);

  async function mark(membershipId: string, status: AttendanceStatus) {
    if (!active) return;
    let id = active.id;
    if (active.virtual) {
      const row = await materializeSession(halaqah.id, active.scheduled_at);
      setSessions((p) => (p.some((x) => x.id === row.id) ? p : [...p, row]));
      id = row.id;
    }
    const r = await markAttendance(id, membershipId, status);
    setAttendance((p) => {
      const i = p.findIndex((a) => a.session_id === r.session_id && a.membership_id === membershipId);
      if (i >= 0) { const next = [...p]; next[i] = r; return next; }
      return [...p, r];
    });
  }

  if (!active) {
    return (
      <div className="card text-center" style={{ padding: '24px', color: 'var(--text-muted)', fontSize: 14 }}>
        {t('sessions.noActive')}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0" style={{ overflowY: 'auto' }}>
      <div className="card flex flex-col gap-3" style={{ padding: '20px' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {t('sessions.activeToday')}
          </span>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {formatSessionTime(active.scheduled_at)}
          </span>
        </div>

        {students.length === 0 ? (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('tracker.noStudents')}</span>
        ) : (
          students.map((m) => {
            const cur = statusByMember.get(m.id);
            return (
              <div key={m.id} className="flex items-center justify-between gap-2" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{displayName(m)}</span>
                <div className="flex gap-1">
                  {ATT_STATUSES.map((st) => (
                    <button key={st} onClick={() => mark(m.id, st)}
                            className={cur === st ? 'btn btn-primary' : 'btn btn-ghost'}
                            style={{ minHeight: 30, fontSize: 11, padding: '0 8px' }}>
                      {t(`att.${st}` as Parameters<typeof t>[0])}
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

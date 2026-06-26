'use client';

import { useMemo, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import type { Attendance, AttendanceStatus, Halaqah, MemberWithProfile, Recurrence, Session } from '@/types';
import { displayName } from '@/lib/displayName';
import {
  createAdhocSession,
  generateSessions,
  setSchedule,
  setSessionCanceled,
} from '@/lib/services/sessions';
import { markAttendance } from '@/lib/services/attendance';

const WEEKDAY_KEYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const ATT_STATUSES: AttendanceStatus[] = ['present', 'late', 'absent', 'excused'];

export default function TeacherSessions({
  halaqah,
  students,
  initialSessions,
  initialAttendance,
}: {
  halaqah: Halaqah;
  students: MemberWithProfile[];
  initialSessions: Session[];
  initialAttendance: Attendance[];
}) {
  const { t } = useI18n();
  const [sessions, setSessions] = useState(initialSessions);
  const [attendance, setAttendance] = useState(initialAttendance);
  const [weekdays, setWeekdays] = useState<number[]>(halaqah.schedule?.weekdays ?? []);
  const [time, setTime] = useState(halaqah.schedule?.time ?? '17:00');
  const [adhoc, setAdhoc] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  // session_id -> (membership_id -> attendance row)
  const attBySession = useMemo(() => {
    const m = new Map<string, Map<string, Attendance>>();
    for (const a of attendance) {
      if (!m.has(a.session_id)) m.set(a.session_id, new Map());
      m.get(a.session_id)!.set(a.membership_id, a);
    }
    return m;
  }, [attendance]);

  function toggleDay(d: number) {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  async function handleSaveSchedule() {
    const rule: Recurrence | null = weekdays.length ? { weekdays, time } : null;
    await setSchedule(halaqah.id, rule);
    const fresh = await generateSessions(halaqah.id, rule, sessions);
    if (fresh.length) setSessions((p) => [...p, ...fresh].sort(byTime));
  }

  async function handleAdhoc() {
    if (!adhoc) return;
    const s = await createAdhocSession(halaqah.id, new Date(adhoc).toISOString());
    setSessions((p) => [...p, s].sort(byTime));
    setAdhoc('');
  }

  async function handleCancel(s: Session) {
    await setSessionCanceled(s.id, !s.canceled);
    setSessions((p) => p.map((x) => (x.id === s.id ? { ...x, canceled: !s.canceled } : x)));
  }

  async function handleMark(sessionId: string, membershipId: string, status: AttendanceStatus) {
    const row = await markAttendance(sessionId, membershipId, status);
    setAttendance((p) => {
      const i = p.findIndex((a) => a.session_id === sessionId && a.membership_id === membershipId);
      if (i >= 0) { const next = [...p]; next[i] = row; return next; }
      return [...p, row];
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Weekly schedule */}
      <div className="card flex flex-col gap-3" style={{ padding: '16px 18px' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {t('sessions.schedule')}
        </span>
        <div className="flex flex-wrap gap-1">
          {WEEKDAY_KEYS.map((k, d) => (
            <button key={k} onClick={() => toggleDay(d)}
                    className={weekdays.includes(d) ? 'btn btn-primary' : 'btn btn-ghost'}
                    style={{ minHeight: 36, minWidth: 40, fontSize: 12 }}>
              {k}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('sessions.time')}</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input input-sm" style={{ minHeight: 36 }} />
          <button onClick={handleSaveSchedule} className="btn btn-primary" style={{ minHeight: 40, fontSize: 13 }}>
            {t('sessions.saveSchedule')}
          </button>
        </div>
        <div className="flex gap-2 items-center">
          <input type="datetime-local" value={adhoc} onChange={(e) => setAdhoc(e.target.value)} className="input input-sm" style={{ flex: 1, minWidth: 0, minHeight: 36 }} />
          <button onClick={handleAdhoc} disabled={!adhoc} className="btn btn-ghost" style={{ minHeight: 40, fontSize: 13 }}>
            {t('sessions.addAdhoc')}
          </button>
        </div>
      </div>

      {/* Session list */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {t('sessions.title')}
        </h2>
        {sessions.length === 0 && (
          <div className="card text-center" style={{ padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>
            {t('sessions.none')}
          </div>
        )}
        {sessions.map((s) => (
          <div key={s.id} className="card flex flex-col gap-2" style={{ padding: '12px 16px', opacity: s.canceled ? 0.55 : 1 }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                {new Date(s.scheduled_at).toLocaleString()}
                {s.is_adhoc && <span className="badge" style={{ marginInlineStart: 6 }}>{t('sessions.adhoc')}</span>}
                {s.canceled && <span className="badge" style={{ marginInlineStart: 6 }}>{t('sessions.canceled')}</span>}
              </span>
              <div className="flex gap-1">
                <button onClick={() => setOpenId(openId === s.id ? null : s.id)} className="btn btn-ghost" style={{ minHeight: 32, fontSize: 12 }}>
                  {t('sessions.markAttendance')}
                </button>
                <button onClick={() => handleCancel(s)} className="btn btn-ghost" style={{ minHeight: 32, fontSize: 12 }}>
                  {s.canceled ? t('sessions.reinstate') : t('sessions.cancel')}
                </button>
              </div>
            </div>

            {openId === s.id && !s.canceled && (
              <div className="flex flex-col gap-2" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                {students.length === 0 && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('tracker.noStudents')}</span>
                )}
                {students.map((m) => {
                  const cur = attBySession.get(s.id)?.get(m.id)?.status;
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{displayName(m)}</span>
                      <div className="flex gap-1">
                        {ATT_STATUSES.map((st) => (
                          <button key={st} onClick={() => handleMark(s.id, m.id, st)}
                                  className={cur === st ? 'btn btn-primary' : 'btn btn-ghost'}
                                  style={{ minHeight: 30, fontSize: 11, padding: '0 8px' }}>
                            {t(`att.${st}` as Parameters<typeof t>[0])}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function byTime(a: Session, b: Session) {
  return a.scheduled_at < b.scheduled_at ? -1 : a.scheduled_at > b.scheduled_at ? 1 : 0;
}

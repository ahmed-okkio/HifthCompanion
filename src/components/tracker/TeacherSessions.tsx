'use client';

import { useMemo, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import type { Attendance, AttendanceStatus, Halaqah, MemberWithProfile, Recurrence, Session } from '@/types';
import { displayName } from '@/lib/displayName';
import {
  cancelRecurringSessions,
  createAdhocSession,
  generateSessions,
  setSchedule,
  setSessionCanceled,
} from '@/lib/services/sessions';
import { markAttendance } from '@/lib/services/attendance';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
  const [adhocDate, setAdhocDate] = useState('');
  const [adhocTime, setAdhocTime] = useState('17:00');
  const [openId, setOpenId] = useState<string | null>(null);
  const PAGE_SIZE = 4;
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // session_id -> (membership_id -> attendance row)
  const attBySession = useMemo(() => {
    const m = new Map<string, Map<string, Attendance>>();
    for (const a of attendance) {
      if (!m.has(a.session_id)) m.set(a.session_id, new Map());
      m.get(a.session_id)!.set(a.membership_id, a);
    }
    return m;
  }, [attendance]);

  // Group sessions by YYYY-MM-DD for calendar dots
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      const d = new Date(s.scheduled_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [sessions]);

  // Sessions for the selected calendar date
  const selectedSessions = useMemo(() => {
    if (!selectedDate) return [];
    return sessionsByDate.get(selectedDate) ?? [];
  }, [selectedDate, sessionsByDate]);

  // Click a calendar date — auto-generate missing recurring session on demand
  async function handleSelectDate(dateKey: string) {
    setSelectedDate((prev) => (prev === dateKey ? null : dateKey));
    setPage(0);

    // Already have sessions for this date — nothing to generate
    if (sessionsByDate.has(dateKey)) return;

    // Check if this date matches the recurring schedule
    const d = new Date(`${dateKey}T12:00:00`);
    if (!weekdays.includes(d.getDay())) return;

    // Only generate for future dates (or today)
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (d < now) return;

    // Generate sessions up to this date + 1 day
    const horizonDays = Math.ceil((d.getTime() - Date.now()) / 86400000) + 2;
    const rule: Recurrence | null = weekdays.length ? { weekdays, time } : null;
    const fresh = await generateSessions(halaqah.id, rule, sessions, horizonDays);
    if (fresh.length) setSessions((p) => [...p, ...fresh].sort(byTime));
  }

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
    if (!adhocDate) return;
    const iso = new Date(`${adhocDate}T${adhocTime}:00`).toISOString();
    const s = await createAdhocSession(halaqah.id, iso);
    setSessions((p) => [...p, s].sort(byTime));
    setAdhocDate('');
    setAdhocTime('17:00');
  }

  async function handleCancel(s: Session) {
    await setSessionCanceled(s.id, !s.canceled);
    setSessions((p) => p.map((x) => (x.id === s.id ? { ...x, canceled: !s.canceled } : x)));
  }

  async function handleCancelRecurring() {
    if (!confirm(t('sessions.stopRecurringConfirm'))) return;
    await cancelRecurringSessions(halaqah.id);
    setSessions((p) =>
      p.map((x) => (x.is_adhoc ? x : { ...x, canceled: true })),
    );
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
    <div className="flex flex-col gap-4 flex-1 min-h-0" style={{ overflow: 'hidden' }}>
      {/* Calendar + sessions side-by-side — same card container, both 100% height */}
      <div className="flex gap-4 lg:flex-row flex-col flex-1 min-h-0">
        {/* Left: calendar card */}
        <div className="card flex flex-col shrink-0" style={{ padding: '16px 18px', width: '100%', maxWidth: 400 }}>
          <CalendarView
            viewDate={viewDate}
            onNavigate={setViewDate}
            sessionsByDate={sessionsByDate}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            weekdays={weekdays}
          />
          {!selectedDate && sessions.length === 0 && (
            <div className="card text-center" style={{ marginTop: 8, padding: '16px', color: 'var(--text-muted)', fontSize: 13 }}>
              {t('sessions.none')}
            </div>
          )}
        </div>

        {/* Right: session list card */}
        <div className="card flex flex-col flex-1 min-w-0 min-h-0" style={{ padding: '16px 18px' }}>
          {selectedDate ? (
            <SessionList
              heading={formatDateHeading(selectedDate)}
              sessions={selectedSessions}
              page={page}
              pageSize={PAGE_SIZE}
              onPage={setPage}
              onClose={() => setSelectedDate(null)}
              emptyText={t('sessions.none')}
              {...{ t, openId, setOpenId, handleCancel, handleMark, students, attBySession }}
            />
          ) : (
            <SessionList
              heading={t('sessions.title')}
              sessions={sessions.slice(0, 5)}
              page={0}
              pageSize={5}
              onPage={setPage}
              emptyText={t('sessions.none')}
              {...{ t, openId, setOpenId, handleCancel, handleMark, students, attBySession }}
            />
          )}
        </div>
      </div>

      {/* Weekly schedule — below the calendar */}
      <div className="card flex flex-col gap-4 shrink-0" style={{ padding: '20px' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {t('sessions.schedule')}
        </span>

        {/* Day-of-week toggle pills */}
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_LABELS.map((label, d) => {
            const active = weekdays.includes(d);
            return (
              <button
                key={d}
                onClick={() => toggleDay(d)}
                className={active ? 'btn btn-primary' : 'btn btn-ghost'}
                style={{
                  minHeight: 40,
                  minWidth: 56,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  borderRadius: 'var(--radius-full)',
                  padding: '6px 16px',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Time picker + save row */}
        <div className="flex gap-3 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              {t('sessions.time')}
            </span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="input"
              style={{ minHeight: 40, width: 140, fontSize: 15 }}
            />
          </label>
          <button
            onClick={handleSaveSchedule}
            disabled={weekdays.length === 0}
            className="btn btn-primary"
            style={{ minHeight: 40, fontSize: 13, padding: '0 20px' }}
          >
            {t('sessions.saveSchedule')}
          </button>
        </div>

        {/* Live preview + stop */}
        {weekdays.length > 0 && (
          <div
            className="flex items-center justify-between gap-3"
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-muted)',
              fontSize: 13,
              color: 'var(--text-accent)',
            }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ opacity: 0.7 }}>{t('sessions.repeatsEvery')}</span>
              <span style={{ fontWeight: 600 }}>
                {weekdays.map((d) => WEEKDAY_LABELS[d]).join(', ')}
              </span>
              <span style={{ opacity: 0.7 }}>{t('sessions.at')}</span>
              <span style={{ fontWeight: 600 }}>{time}</span>
            </div>
            <button
              onClick={handleCancelRecurring}
              className="btn btn-danger-ghost"
              style={{ minHeight: 30, fontSize: 11, flexShrink: 0 }}
            >
              {t('sessions.stopRecurring')}
            </button>
          </div>
        )}

        {/* Adhoc session — one-off, outside the weekly schedule */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
          <div className="flex flex-col gap-1" style={{ marginBottom: 4 }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {t('sessions.adhocTitle')}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('sessions.adhocHint')}
            </span>
          </div>
          <div className="flex gap-2 items-end">
            <label className="flex flex-col gap-1" style={{ flex: 2, minWidth: 0 }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('sessions.date')}
              </span>
              <input
                type="date"
                value={adhocDate}
                onChange={(e) => setAdhocDate(e.target.value)}
                className="input"
                style={{ minHeight: 40, fontSize: 14 }}
              />
            </label>
            <label className="flex flex-col gap-1" style={{ flex: 1, minWidth: 0 }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('sessions.time')}
              </span>
              <input
                type="time"
                value={adhocTime}
                onChange={(e) => setAdhocTime(e.target.value)}
                className="input"
                style={{ minHeight: 40, fontSize: 14 }}
              />
            </label>
            <button
              onClick={handleAdhoc}
              disabled={!adhocDate}
              className="btn btn-outline"
              style={{ minHeight: 40, fontSize: 13, padding: '0 18px', alignSelf: 'flex-end' }}
            >
              {t('sessions.addAdhoc')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function byTime(a: Session, b: Session) {
  return a.scheduled_at < b.scheduled_at ? -1 : a.scheduled_at > b.scheduled_at ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Shared session card (used by both selected-date and upcoming lists)
// ---------------------------------------------------------------------------

function SessionCard({
  s, t, openId, setOpenId, handleCancel, handleMark, students, attBySession,
}: {
  s: Session;
  t: ReturnType<typeof useI18n>['t'];
  openId: string | null;
  setOpenId: (id: string | null) => void;
  handleCancel: (s: Session) => void;
  handleMark: (sessionId: string, membershipId: string, status: AttendanceStatus) => void;
  students: MemberWithProfile[];
  attBySession: Map<string, Map<string, Attendance>>;
}) {
  return (
    <div key={s.id} className="card flex flex-col gap-2" style={{ padding: '12px 16px', opacity: s.canceled ? 0.5 : 1 }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            {formatSessionTime(s.scheduled_at)}
          </span>
          {s.is_adhoc && <span className="badge" style={{ fontSize: 10 }}>{t('sessions.adhoc')}</span>}
          {s.canceled && <span className="badge badge-muted" style={{ fontSize: 10 }}>{t('sessions.canceled')}</span>}
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => setOpenId(openId === s.id ? null : s.id)} className="btn btn-ghost" style={{ minHeight: 30, fontSize: 11 }}>
            {t('sessions.markAttendance')}
          </button>
          <button onClick={() => handleCancel(s)} className="btn btn-ghost" style={{ minHeight: 30, fontSize: 11 }}>
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
                            style={{ minHeight: 28, fontSize: 10, padding: '0 6px' }}>
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
  );
}

// ---------------------------------------------------------------------------
// Session list with internal scroll + pagination
// ---------------------------------------------------------------------------

function SessionList({
  heading, sessions, page, pageSize, onPage, onClose, emptyText,
  t, openId, setOpenId, handleCancel, handleMark, students, attBySession,
}: {
  heading: string;
  sessions: Session[];
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
  onClose?: () => void;
  emptyText: string;
  t: ReturnType<typeof useI18n>['t'];
  openId: string | null;
  setOpenId: (id: string | null) => void;
  handleCancel: (s: Session) => void;
  handleMark: (sessionId: string, membershipId: string, status: AttendanceStatus) => void;
  students: MemberWithProfile[];
  attBySession: Map<string, Map<string, Attendance>>;
}) {
  const totalPages = Math.max(1, Math.ceil(sessions.length / pageSize));
  const p = Math.min(page, totalPages - 1);
  const slice = sessions.slice(p * pageSize, (p + 1) * pageSize);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0" style={{ marginBottom: 8 }}>
        <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {heading}
        </h2>
        {onClose && (
          <button onClick={onClose} className="btn btn-ghost" style={{ minHeight: 28, fontSize: 11 }}>
            ✕
          </button>
        )}
      </div>

      {/* Cards area — scrolls when overflow */}
      <div className="flex-1 min-h-0" style={{ overflowY: 'auto' }}>
        <div className="flex flex-col gap-2">
          {sessions.length === 0 ? (
            <div className="card text-center" style={{ padding: '16px', color: 'var(--text-muted)', fontSize: 13 }}>
              {emptyText}
            </div>
          ) : (
            slice.map((s) => (
              <SessionCard key={s.id} {...{ s, t, openId, setOpenId, handleCancel, handleMark, students, attBySession }} />
            ))
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between shrink-0" style={{ paddingTop: 8 }}>
          <button
            onClick={() => onPage(p - 1)}
            disabled={p === 0}
            className="btn btn-ghost"
            style={{ minHeight: 30, fontSize: 12, opacity: p === 0 ? 0.4 : 1 }}
          >
            ← Prev
          </button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {p + 1} / {totalPages}
          </span>
          <button
            onClick={() => onPage(p + 1)}
            disabled={p >= totalPages - 1}
            className="btn btn-ghost"
            style={{ minHeight: 30, fontSize: 12, opacity: p >= totalPages - 1 ? 0.4 : 1 }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calendar sub-component
// ---------------------------------------------------------------------------

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function CalendarView({
  viewDate,
  onNavigate,
  sessionsByDate,
  selectedDate,
  onSelectDate,
  weekdays,
}: {
  viewDate: Date;
  onNavigate: (d: Date) => void;
  sessionsByDate: Map<string, Session[]>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  weekdays: number[];
}) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="flex flex-col gap-3">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate(new Date(year, month - 1, 1))}
          className="btn btn-ghost"
          style={{ minHeight: 32, minWidth: 32, fontSize: 14, padding: 0 }}
        >
          ←
        </button>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={() => onNavigate(new Date(year, month + 1, 1))}
          className="btn btn-ghost"
          style={{ minHeight: 32, minWidth: 32, fontSize: 14, padding: 0 }}
        >
          →
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center" style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
        {WEEKDAY_LABELS.map((l) => (
          <div key={l} style={{ padding: '4px 0' }}>{l.slice(0, 2)}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7" style={{ gap: '3px' }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;
          const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const hasSessions = sessionsByDate.has(dateKey);
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDate;
          const isRecurringDay = weekdays.includes(new Date(year, month, day).getDay());

          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(dateKey)}
              className="btn btn-ghost"
              style={{
                minHeight: 44,
                minWidth: 0,
                fontSize: 14,
                fontWeight: isToday ? 700 : 400,
                padding: '2px 4px',
                borderRadius: 'var(--radius-md)',
                color: isSelected
                  ? '#fff'
                  : isToday
                    ? 'var(--text-accent)'
                    : 'var(--text-primary)',
                background: isSelected
                  ? 'var(--accent)'
                  : isToday
                    ? 'var(--accent-muted)'
                    : 'transparent',
                position: 'relative',
              }}
            >
              {day}
              {hasSessions && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 5,
                    height: 5,
                    borderRadius: 'var(--radius-full)',
                    background: isSelected ? '#fff' : 'var(--accent)',
                  }}
                />
              )}
              {!hasSessions && isRecurringDay && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 5,
                    height: 5,
                    borderRadius: 'var(--radius-full)',
                    background: isSelected ? '#fff' : 'var(--border-default)',
                    opacity: 0.6,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** "Mon, Jun 29 · 5:00 PM" — no seconds, human-readable. */
function formatSessionTime(iso: string) {
  const d = new Date(iso);
  const weekday = WEEKDAY_LABELS[d.getDay()];
  const month = MONTHS[d.getMonth()].slice(0, 3);
  const day = d.getDate();
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  const min = String(m).padStart(2, '0');
  return `${weekday}, ${month} ${day} · ${h}:${min} ${ampm}`;
}

/** "Sunday, 29 June 2026" for the selected-date heading. */
function formatDateHeading(dateKey: string) {
  const d = new Date(`${dateKey}T12:00:00`);
  const weekday = WEEKDAY_LABELS[d.getDay()];
  const month = MONTHS[d.getMonth()];
  return `${weekday}, ${d.getDate()} ${month} ${d.getFullYear()}`;
}

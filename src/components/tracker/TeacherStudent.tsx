'use client';

import { useMemo, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import type {
  AttendanceStatus, Circle, Homework, LogType, MemberWithProfile,
  ProgressLog, Session,
} from '@/types';
import { displayName } from '@/lib/displayName';
import {
  createAdhocSession, generateSessions, setSchedule, setSessionAttendance, setSessionCanceled,
} from '@/lib/services/sessions';
import { prescribeHomework, editDeadline } from '@/lib/services/homework';
import type { NoteWithAuthor } from '@/lib/services/membershipNotes';
import NotesThread from './NotesThread';
import { homeworkStatus, type HomeworkStatus } from '@/lib/homework';
import {
  SectionTitle, EmptyState, Avatar, StatCard, DateChip, StatusDot, TabBar, NumberStepper,
  HOMEWORK_STATUS_STYLE,
} from './ui';
import StudentAnalytics from './StudentAnalytics';

const LOG_TYPES: LogType[] = ['memorization', 'general_revision', 'targeted_revision'];
const ATT_STATUSES: AttendanceStatus[] = ['present', 'late', 'absent', 'excused'];
const today = () => new Date().toISOString().slice(0, 10);

function fmtTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

/**
 * The teacher's control surface for ONE active student (D1/D4/D5, E1/E5, G1, H1-H3).
 * Everything here is per-membership; the student's own self-service view is M6.
 */
export default function TeacherStudent({
  circle,
  member,
  initialSessions,
  defaultSetId,
  initialHomework,
  logs,
  initialNotes,
  streak,
}: {
  circle: Circle;
  member: MemberWithProfile;
  initialSessions: Session[];
  defaultSetId: string | null;
  initialHomework: Homework[];
  logs: ProgressLog[];
  initialNotes: NoteWithAuthor[];
  streak: number;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState('sessions');
  // Attendance rows for analytics live on the session row now (D3) — derive them.
  const attendance = useMemo(
    () => initialSessions.filter((s) => s.attendance_status).map((s) => ({ status: s.attendance_status! })),
    [initialSessions],
  );

  // KPI inputs — static snapshots from the server payload.
  const now = Date.now();
  const upcomingCount = initialSessions.filter(
    (s) => !s.canceled && new Date(s.scheduled_at).getTime() >= now,
  ).length;
  const linkedCount = new Map<string, number>();
  for (const l of logs) if (l.homework_id) linkedCount.set(l.homework_id, (linkedCount.get(l.homework_id) ?? 0) + 1);
  const openHomework = initialHomework.filter(
    (h) => homeworkStatus(h, linkedCount.get(h.id) ?? 0, today()) === 'open',
  ).length;

  return (
    <div className="flex flex-col gap-5">
      {/* Hero */}
      <div className="card flex items-center justify-between gap-3 flex-wrap" style={{ padding: '20px 22px' }}>
        <div className="flex items-center gap-4 min-w-0">
          <Avatar seed={displayName(member)} size={52} />
          <div className="flex flex-col gap-0.5 min-w-0">
            <h1 className="font-bold tracking-tight truncate"
                style={{ color: 'var(--text-primary)', fontSize: 'var(--type-heading-m-size)' }}>
              {displayName(member)}
            </h1>
            <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              <StatusDot color="var(--success)" />
              {t('tracker.active')} · {circle.name}
            </span>
          </div>
        </div>
        <MushafButton setId={defaultSetId} />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon="🔥" value={streak} label={t('log.streak')} />
        <StatCard icon="📖" value={openHomework} label={t('homework.statusOpen')} />
        <StatCard icon="📅" value={upcomingCount} label={t('sessions.title')} />
      </div>

      <TabBar
        tabs={[
          { key: 'sessions', label: t('tracker.tabSessions') },
          { key: 'homework', label: t('homework.title') },
          { key: 'notes', label: t('notes.title') },
          { key: 'analytics', label: t('analytics.title') },
        ]}
        active={tab}
        onSelect={setTab}
      />

      {tab === 'sessions' && (
        <StudentSessions membershipId={member.id} initial={initialSessions} initialSchedule={member.schedule} />
      )}
      {tab === 'homework' && <HomeworkPanel membershipId={member.id} initial={initialHomework} logs={logs} />}
      {tab === 'notes' && <NotesThread membershipId={member.id} initial={initialNotes} />}
      {tab === 'analytics' && <StudentAnalytics circle={circle} logs={logs} attendance={attendance} />}
    </div>
  );
}

// --- Mushaf button (H1/H2/H3) -------------------------------------------------

function MushafButton({ setId }: { setId: string | null }) {
  const { t } = useI18n();
  // No default set → disabled, no crash (H3). Resolved per render so it follows
  // the student's current default (H2).
  if (!setId) {
    return (
      <span className="btn btn-ghost" style={{ minHeight: 36, fontSize: 12, opacity: 0.5, cursor: 'default' }}>
        {t('tracker.noDefaultSet')}
      </span>
    );
  }
  return (
    <a href={`/share/${setId}/1`} className="btn btn-outline" style={{ minHeight: 36, fontSize: 12 }}>
      {t('tracker.mushaf')}
    </a>
  );
}

// --- Sessions: weekly slot + attendance + ad-hoc (D1/D4/D5) -------------------

function StudentSessions({
  membershipId, initial, initialSchedule,
}: {
  membershipId: string;
  initial: Session[];
  initialSchedule: { weekdays: number[]; time: string } | null;
}) {
  const { t, locale } = useI18n();
  const [sessions, setSessions] = useState(initial);
  const [weekdays, setWeekdays] = useState<number[]>(initialSchedule?.weekdays ?? []);
  const [time, setTime] = useState(initialSchedule?.time ?? '17:00');
  const [adhocDate, setAdhocDate] = useState('');
  const [adhocTime, setAdhocTime] = useState('17:00');

  // Localized weekday short labels (2023-01-01 is a Sunday → index 0 = Sun).
  const dayLabels = useMemo(
    () => Array.from({ length: 7 }, (_, d) =>
      new Date(Date.UTC(2023, 0, 1 + d)).toLocaleDateString(locale, { weekday: 'short' })),
    [locale],
  );

  const rule = weekdays.length ? { weekdays, time } : null;

  function toggleDay(d: number) {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  async function handleSave() {
    await setSchedule(membershipId, rule);
  }

  async function handleGenerate() {
    await setSchedule(membershipId, rule);
    await generateSessions(membershipId, rule);
    // Cheapest way to reflect the new rows: reload. ponytail: full refetch beats
    // re-deriving slots client-side; swap for an optimistic merge if it flickers.
    location.reload();
  }

  async function handleAdhoc() {
    if (!adhocDate) return;
    const iso = new Date(`${adhocDate}T${adhocTime}:00`).toISOString();
    const s = await createAdhocSession(membershipId, iso);
    setSessions((p) => [...p, s].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)));
    setAdhocDate('');
  }

  async function handleCancel(s: Session) {
    await setSessionCanceled(s.id, !s.canceled);
    setSessions((p) => p.map((x) => (x.id === s.id ? { ...x, canceled: !s.canceled } : x)));
  }

  async function handleAttendance(s: Session, status: AttendanceStatus) {
    const next = s.attendance_status === status ? null : status;
    await setSessionAttendance(s.id, next);
    setSessions((p) => p.map((x) => (x.id === s.id ? { ...x, attendance_status: next } : x)));
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Weekly schedule */}
      <div className="card flex flex-col gap-3" style={{ padding: '16px 18px' }}>
        <SectionTitle>{t('sessions.schedule')}</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {dayLabels.map((label, d) => {
            const on = weekdays.includes(d);
            return (
              <button key={d} onClick={() => toggleDay(d)} className={on ? 'btn btn-primary' : 'btn btn-ghost'}
                      style={{ minHeight: 40, minWidth: 52, fontSize: 13, borderRadius: 'var(--radius-full)', padding: '6px 14px' }}>
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('sessions.time')}</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input" style={{ minHeight: 40, width: 140 }} />
          </label>
          <button onClick={handleSave} className="btn btn-outline" style={{ minHeight: 40, fontSize: 13, padding: '0 18px' }}>
            {t('sessions.saveSchedule')}
          </button>
          <button onClick={handleGenerate} disabled={weekdays.length === 0} className="btn btn-primary" style={{ minHeight: 40, fontSize: 13, padding: '0 18px' }}>
            {t('sessions.generate')}
          </button>
        </div>

        {/* Ad-hoc */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }} className="flex gap-2 items-end flex-wrap">
          <label className="flex flex-col gap-1" style={{ flex: 2, minWidth: 120 }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('sessions.adhocTitle')}</span>
            <input type="date" value={adhocDate} onChange={(e) => setAdhocDate(e.target.value)} className="input" style={{ minHeight: 40 }} />
          </label>
          <label className="flex flex-col gap-1" style={{ flex: 1, minWidth: 90 }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('sessions.time')}</span>
            <input type="time" value={adhocTime} onChange={(e) => setAdhocTime(e.target.value)} className="input" style={{ minHeight: 40 }} />
          </label>
          <button onClick={handleAdhoc} disabled={!adhocDate} className="btn btn-outline" style={{ minHeight: 40, fontSize: 13, padding: '0 16px' }}>
            {t('sessions.addAdhoc')}
          </button>
        </div>
      </div>

      {/* Session list + attendance */}
      <div className="flex flex-col gap-2">
        <SectionTitle>{t('sessions.title')}</SectionTitle>
        {sessions.length === 0 && <EmptyState>{t('sessions.none')}</EmptyState>}
        {sessions.map((s) => (
          <div key={s.id} className="card flex flex-col gap-2" style={{ padding: '12px 14px', opacity: s.canceled ? 0.5 : 1 }}>
            <div className="flex items-center gap-3">
              <DateChip iso={s.scheduled_at} locale={locale} />
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {new Date(s.scheduled_at).toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' })}
                  {s.is_adhoc && <span className="badge" style={{ fontSize: 10 }}>{t('sessions.adhoc')}</span>}
                  {s.canceled && <span className="badge badge-muted" style={{ fontSize: 10 }}>{t('sessions.canceled')}</span>}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtTime(s.scheduled_at, locale)}</span>
              </div>
              <button onClick={() => handleCancel(s)} className="btn btn-ghost shrink-0" style={{ minHeight: 30, fontSize: 11 }}>
                {s.canceled ? t('sessions.reinstate') : t('sessions.cancel')}
              </button>
            </div>
            {!s.canceled && (
              <div className="flex flex-wrap gap-1">
                {ATT_STATUSES.map((st) => {
                  const on = s.attendance_status === st;
                  return (
                    <button key={st} onClick={() => handleAttendance(s, st)} className={on ? 'btn btn-primary' : 'btn btn-ghost'}
                            style={{ minHeight: 30, fontSize: 11, padding: '0 12px' }}>
                      {t(`att.${st}`)}
                    </button>
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

// --- Homework prescription (E1/E5) -------------------------------------------

const STATUS_KEY = {
  open: 'homework.statusOpen',
  completed: 'homework.statusCompleted',
  missed: 'homework.statusMissed',
} as const satisfies Record<HomeworkStatus, string>;

function HomeworkPanel({
  membershipId, initial, logs,
}: {
  membershipId: string;
  initial: Homework[];
  logs: ProgressLog[];
}) {
  const { t } = useI18n();
  const [items, setItems] = useState(initial);
  const [type, setType] = useState<LogType>('memorization');
  const [pageStart, setPageStart] = useState(1);
  const [pageEnd, setPageEnd] = useState(1);
  const [deadline, setDeadline] = useState('');
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);

  // Linked-log count per prescription drives derived status (D10/B4).
  const linkedCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of logs) if (l.homework_id) m.set(l.homework_id, (m.get(l.homework_id) ?? 0) + 1);
    return m;
  }, [logs]);

  async function handlePrescribe() {
    if (busy || pageEnd < pageStart) return;
    setBusy(true);
    try {
      const hw = await prescribeHomework({
        membershipId, type, page_start: pageStart, page_end: pageEnd,
        deadline: deadline || null, instructions: instructions || null,
      });
      setItems((p) => [hw, ...p]);
      setInstructions('');
      setDeadline('');
    } finally {
      setBusy(false);
    }
  }

  async function handleEditDeadline(id: string, value: string) {
    const next = value || null;
    await editDeadline(id, next);
    setItems((p) => p.map((h) => (h.id === id ? { ...h, deadline: next } : h)));
  }

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle>{t('homework.prescribe')}</SectionTitle>

      {/* Prescribe form */}
      <div className="card flex flex-col gap-3" style={{ padding: '16px 18px' }}>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('log.type')}</span>
            <select value={type} onChange={(e) => setType(e.target.value as LogType)} className="input" style={{ minHeight: 40 }}>
              {LOG_TYPES.map((lt) => <option key={lt} value={lt}>{t(`logType.${lt}`)}</option>)}
            </select>
          </label>
          <NumberStepper label={t('log.from')} value={pageStart} min={1} max={604} onChange={setPageStart} />
          <NumberStepper label={t('log.to')} value={pageEnd} min={1} max={604} onChange={setPageEnd} />
          <label className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('homework.deadline')}</span>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="input" style={{ minHeight: 40 }} />
          </label>
        </div>
        <input value={instructions} onChange={(e) => setInstructions(e.target.value)}
               placeholder={t('homework.instructions')} className="input" />
        <button onClick={handlePrescribe} disabled={busy || pageEnd < pageStart} className="btn btn-primary" style={{ minHeight: 44 }}>
          {t('homework.prescribe')}
        </button>
      </div>

      {/* Existing prescriptions */}
      {items.map((h) => {
        const status = homeworkStatus(h, linkedCount.get(h.id) ?? 0, today());
        return (
          <div key={h.id} className="card flex flex-col gap-2" style={{ padding: '12px 16px' }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {t(`logType.${h.type}`)} · {t('log.pageRange')} {h.page_start}–{h.page_end}
              </span>
              <span className="badge" style={{ fontSize: 10, ...HOMEWORK_STATUS_STYLE[status] }}>{t(STATUS_KEY[status])}</span>
            </div>
            {h.instructions && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{h.instructions}</span>}
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('homework.deadline')}
              <input type="date" defaultValue={h.deadline ?? ''} onChange={(e) => handleEditDeadline(h.id, e.target.value)}
                     className="input input-sm" style={{ minHeight: 34 }} />
            </label>
          </div>
        );
      })}
    </div>
  );
}


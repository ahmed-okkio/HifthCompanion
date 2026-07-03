'use client';

import { useMemo, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import type {
  AttendanceStatus, Circle, Homework, LogType, MemberWithProfile,
  ProgressLog, Session, StatusConfig,
} from '@/types';
import { displayName } from '@/lib/displayName';
import {
  createAdhocSession, generateSessions, setSchedule, setSessionAttendance, setSessionCanceled,
} from '@/lib/services/sessions';
import { prescribeHomework, editDeadline } from '@/lib/services/homework';
import { gradeLog } from '@/lib/services/progressLog';
import type { NoteWithAuthor } from '@/lib/services/membershipNotes';
import NotesThread from './NotesThread';
import {
  homeworkStatus, aggregateStatus, groupHomework, homeworkEntryLabel, type HomeworkStatus,
} from '@/lib/homework';
import { AYAH_COUNTS, TOTAL_SURAHS, getSurahName } from '@/lib/quran';
import {
  SectionTitle, EmptyState, Avatar, StatCard, DateChip, StatusDot, TabBar,
  HOMEWORK_STATUS_STYLE,
} from './ui';
import StudentAnalytics from './StudentAnalytics';

const LOG_TYPES: LogType[] = ['memorization', 'general_revision', 'targeted_revision'];
const ATT_STATUSES: AttendanceStatus[] = ['present', 'late', 'absent', 'excused'];
const today = () => new Date().toISOString().slice(0, 10);

function fmtTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
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
      {tab === 'homework' && <HomeworkPanel membershipId={member.id} initial={initialHomework} logs={logs} teacherStatuses={circle.teacher_statuses} />}
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
    <a href={`/share/${setId}/1`} className="btn btn-outline" style={{ minHeight: 36, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {/* Open-book glyph reused from NavRail's IconSurahs (M1). */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
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
      new Date(Date.UTC(2023, 0, 1 + d)).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })),
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
    const iso = new Date(`${adhocDate}T${adhocTime}:00Z`).toISOString();
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
                  {new Date(s.scheduled_at).toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}
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

type Entry = { surah: number; ayah_start: number | null; ayah_end: number | null };

function HomeworkPanel({
  membershipId, initial, logs, teacherStatuses,
}: {
  membershipId: string;
  initial: Homework[];
  logs: ProgressLog[];
  teacherStatuses: StatusConfig[];
}) {
  const { t, locale } = useI18n();
  const [items, setItems] = useState(initial);
  // Local copy so a freshly graded log flips to its locked state without a reload.
  const [logRows, setLogRows] = useState(logs);
  const onGraded = (id: string, grade: { teacher_status: string | null; teacher_comment: string | null }) =>
    setLogRows((p) => p.map((l) => (l.id === id ? { ...l, ...grade, reviewed_at: new Date().toISOString() } : l)));

  // Logs linked to a prescription (nested under its card) vs open self-submissions.
  const logsByHomework = useMemo(() => {
    const m = new Map<string, ProgressLog[]>();
    for (const l of logRows) if (l.homework_id) (m.get(l.homework_id) ?? m.set(l.homework_id, []).get(l.homework_id)!).push(l);
    return m;
  }, [logRows]);
  const selfSubmissions = useMemo(() => logRows.filter((l) => !l.homework_id), [logRows]);
  const [type, setType] = useState<LogType>('memorization');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [deadline, setDeadline] = useState('');
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);

  // Linked-log count per prescription drives derived status (D10/B4).
  const linkedCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of logRows) if (l.homework_id) m.set(l.homework_id, (m.get(l.homework_id) ?? 0) + 1);
    return m;
  }, [logRows]);

  async function handlePrescribe() {
    if (busy || entries.length === 0) return;
    setBusy(true);
    try {
      const rows = await prescribeHomework({
        membershipId, type, entries,
        deadline: deadline || null, instructions: instructions || null,
      });
      setItems((p) => [...rows, ...p]);
      setEntries([]);
      setInstructions('');
      setDeadline('');
    } finally {
      setBusy(false);
    }
  }

  // Deadline applies to the whole group → update every row in it (H2).
  async function handleEditDeadline(ids: string[], value: string) {
    const next = value || null;
    await Promise.all(ids.map((id) => editDeadline(id, next)));
    setItems((p) => p.map((h) => (ids.includes(h.id) ? { ...h, deadline: next } : h)));
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
          <label className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('homework.deadline')}</span>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="input" style={{ minHeight: 40 }} />
          </label>
        </div>

        {/* Surah picker — one or more surahs, each whole or narrowed to an ayah range (H1) */}
        <SurahPicker entries={entries} onChange={setEntries} locale={locale} />

        <input value={instructions} onChange={(e) => setInstructions(e.target.value)}
               placeholder={t('homework.instructions')} className="input" />
        <button onClick={handlePrescribe} disabled={busy || entries.length === 0} className="btn btn-primary" style={{ minHeight: 44 }}>
          {t('homework.prescribe')}
        </button>
      </div>

      {/* Existing prescriptions — one card per group (H3), grading per row (H4) */}
      {groupHomework(items).map((group) => {
        const status = aggregateStatus(
          group.items.map((h) => homeworkStatus(h, linkedCount.get(h.id) ?? 0, today())),
        );
        const ids = group.items.map((h) => h.id);
        const instr = group.items.find((h) => h.instructions)?.instructions;
        return (
          <div key={group.key} className="card flex flex-col gap-2" style={{ padding: '12px 16px' }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t(`logType.${group.items[0].type}`)}</span>
              <span className="badge" style={{ fontSize: 10, ...HOMEWORK_STATUS_STYLE[status] }}>{t(STATUS_KEY[status])}</span>
            </div>
            {instr && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{instr}</span>}
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('homework.deadline')}
              <input type="date" defaultValue={group.items[0].deadline ?? ''} onChange={(e) => handleEditDeadline(ids, e.target.value)}
                     className="input input-sm" style={{ minHeight: 34 }} />
            </label>
            {group.items.map((h) => (
              <div key={h.id} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }} className="flex flex-col gap-1">
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {homeworkEntryLabel(h, locale) ?? `${t('log.pageRange')} ${h.page_start}–${h.page_end}`}
                  {h.surah && h.ayah_start == null ? ` ${t('homework.whole')}` : ''}
                </span>
                {(logsByHomework.get(h.id) ?? []).map((l) => (
                  <GradeableLog key={l.id} log={l} statuses={teacherStatuses} onGraded={onGraded} />
                ))}
              </div>
            ))}
          </div>
        );
      })}

      {/* Open self-submissions (homework_id null) — G2 */}
      <SectionTitle>{t('grade.selfSubmissions')}</SectionTitle>
      {selfSubmissions.length === 0 && <EmptyState>{t('grade.noSubmissions')}</EmptyState>}
      {selfSubmissions.map((l) => (
        <div key={l.id} className="card" style={{ padding: '12px 16px' }}>
          <GradeableLog log={l} statuses={teacherStatuses} onGraded={onGraded} />
        </div>
      ))}
    </div>
  );
}

// --- Surah picker: build the list of surah entries for a prescription (H1) ----

function SurahPicker({
  entries, onChange, locale,
}: {
  entries: Entry[];
  onChange: (e: Entry[]) => void;
  locale: 'en' | 'ar';
}) {
  const { t } = useI18n();
  const [surah, setSurah] = useState(1);
  const [whole, setWhole] = useState(true);
  const [ayahStart, setAyahStart] = useState(1);
  const [ayahEnd, setAyahEnd] = useState(1);
  const max = AYAH_COUNTS[surah] ?? 1;
  // Clamp the range to 1..AYAH_COUNTS[surah] (H1).
  const clamp = (n: number) => Math.max(1, Math.min(max, n));

  function add() {
    const start = clamp(ayahStart);
    const end = clamp(ayahEnd);
    onChange([...entries, whole
      ? { surah, ayah_start: null, ayah_end: null }
      : { surah, ayah_start: Math.min(start, end), ayah_end: Math.max(start, end) }]);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2 items-end">
        <label className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('log.surah')}</span>
          <select value={surah} onChange={(e) => setSurah(Number(e.target.value))} className="input" style={{ minHeight: 40 }}>
            {Array.from({ length: TOTAL_SURAHS }, (_, i) => i + 1).map((s) => (
              <option key={s} value={s}>{s}. {getSurahName(s, locale)}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)', paddingBottom: 12 }}>
          <input type="checkbox" checked={whole} onChange={(e) => setWhole(e.target.checked)} />
          {t('homework.whole')}
        </label>
        {!whole && (
          <>
            <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('log.ayahFrom')}
              <input type="number" min={1} max={max} value={ayahStart} onChange={(e) => setAyahStart(clamp(Number(e.target.value)))}
                     className="input input-sm" style={{ minHeight: 40, width: 80 }} />
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('log.ayahTo')}
              <input type="number" min={1} max={max} value={ayahEnd} onChange={(e) => setAyahEnd(clamp(Number(e.target.value)))}
                     className="input input-sm" style={{ minHeight: 40, width: 80 }} />
            </label>
          </>
        )}
        <button onClick={add} className="btn btn-outline" style={{ minHeight: 40, fontSize: 13, padding: '0 16px' }}>
          {t('homework.addSurah')}
        </button>
      </div>
      {entries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {entries.map((e, i) => (
            <span key={i} className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {getSurahName(e.surah, locale)}{e.ayah_start ? ` ${e.ayah_start}–${e.ayah_end}` : ` ${t('homework.whole')}`}
              <button onClick={() => onChange(entries.filter((_, j) => j !== i))}
                      style={{ cursor: 'pointer', fontWeight: 700 }} aria-label="remove">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// --- A single student log with an inline grader (G1-G4) -----------------------

function GradeableLog({
  log: l, statuses, onGraded,
}: {
  log: ProgressLog;
  statuses: StatusConfig[];
  onGraded: (id: string, grade: { teacher_status: string | null; teacher_comment: string | null }) => void;
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleGrade() {
    if (busy || !status) return;
    setBusy(true);
    try {
      const grade = { teacher_status: status, teacher_comment: comment || null };
      await gradeLog(l.id, grade);
      onGraded(l.id, grade);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }} className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {t(`logType.${l.log_type}`)} · p{l.page_start}–{l.page_end}
          {l.surah && l.ayah_start ? ` · ${l.surah}:${l.ayah_start}${l.ayah_end && l.ayah_end !== l.ayah_start ? `–${l.ayah_end}` : ''}` : ''}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{l.log_date}</span>
      </div>
      {l.student_status && <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{l.student_status}</div>}
      {l.student_notes && <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{l.student_notes}</div>}

      {l.reviewed_at ? (
        // Locked/graded — mirrors the student-side treatment (G4).
        <div className="text-xs mt-1" style={{ color: 'var(--text-accent)' }}>
          {t('grade.reviewed')}{l.teacher_status ? `: ${l.teacher_status}` : ''}
          {l.teacher_comment ? ` — ${l.teacher_comment}` : ''}
        </div>
      ) : (
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex flex-wrap gap-2">
            {statuses.map((s) => (
              <button key={s.label} onClick={() => setStatus(s.label)} className="badge" style={{
                cursor: 'pointer',
                background: status === s.label ? 'var(--accent)' : undefined,
                color: status === s.label ? '#fff' : undefined,
              }}>
                {s.label}
              </button>
            ))}
          </div>
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('grade.comment')} className="input input-sm" style={{ minHeight: 34 }} />
          <button onClick={handleGrade} disabled={busy || !status} className="btn btn-primary self-start" style={{ minHeight: 36, fontSize: 13 }}>
            {t('grade.markReviewed')}
          </button>
        </div>
      )}
    </div>
  );
}


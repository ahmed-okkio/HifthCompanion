'use client';

import { useMemo, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import type {
  AttendanceStatus, Circle, Homework, LogType, MemberWithProfile,
  ProgressLog, Session, StatusConfig,
} from '@/types';
import { displayName } from '@/lib/displayName';
import {
  createAdhocSession, materializeSession, setSchedule, setSessionAttendance, setSessionCanceled,
} from '@/lib/services/sessions';
import { sectionSessions, floatingNow, type SessionSlot } from '@/lib/recurrence';
import { prescribeHomework, editDeadline } from '@/lib/services/homework';
import { gradeLog } from '@/lib/services/progressLog';
import type { NoteWithAuthor } from '@/lib/services/membershipNotes';
import NotesThread from './NotesThread';
import {
  homeworkStatus, aggregateStatus, groupHomework, homeworkEntryLabel, homeworkTarget, type HomeworkStatus,
} from '@/lib/homework';
import { AYAH_COUNTS, TOTAL_JUZ, getSurahName } from '@/lib/quran';
import {
  SectionTitle, EmptyState, Avatar, StatCard, DateChip, StatusDot, TabBar,
  SurahCombobox, HOMEWORK_STATUS_STYLE, Chevron, Icon,
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
  const linkedCount = new Map<string, number>();
  for (const l of logs) if (l.homework_id) linkedCount.set(l.homework_id, (linkedCount.get(l.homework_id) ?? 0) + 1);
  const openHomework = initialHomework.filter(
    (h) => homeworkStatus(h, linkedCount.get(h.id) ?? 0, today()) === 'open',
  ).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_280px] gap-5">
      {/* Left sidebar — profile identity + KPIs + Mushaf (Pr1); stacks on top on mobile (Pr2) */}
      <aside className="flex flex-col gap-3 lg:sticky lg:top-6 self-start">
        <div className="card flex flex-col items-center text-center gap-2" style={{ padding: '22px' }}>
          <Avatar seed={displayName(member)} size={64} />
          <h1 className="font-bold tracking-tight truncate max-w-full"
              style={{ color: 'var(--text-primary)', fontSize: 'var(--type-heading-m-size)' }}>
            {displayName(member)}
          </h1>
          <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            <StatusDot color="var(--success)" />
            {t('tracker.active')} · {circle.name}
          </span>
          <div className="mt-1"><MushafButton setId={defaultSetId} /></div>
        </div>

        <StatCard icon={<Icon name="flame" />} value={streak} label={t('log.streak')} />
        <StatCard icon={<Icon name="book" />} value={openHomework} label={t('homework.statusOpen')} />
      </aside>

      {/* Right column — the feed: tabs + panels, unchanged */}
      <div className="flex flex-col gap-5 min-w-0">
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

      {/* Empty right spacer mirrors the sidebar width so the feed sits centered in the page. */}
      <div className="hidden lg:block" aria-hidden />
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
  const [err, setErr] = useState<string | null>(null);
  // Just-marked session id: keeps the slot in Next (showing the selection) for a
  // beat before it reflows into History (T5 linger).
  const [lingerId, setLingerId] = useState<string | null>(null);

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

  // Sections re-derive from the rule + real rows on every schedule/state change (T1).
  const rawSections = useMemo(
    () => sectionSessions(rule, sessions, floatingNow()),
    [rule, sessions],
  );
  // While a mark is lingering, pin that row as Next (editable, so its selection
  // stays highlighted) and pull it out of History until the 3s elapses.
  const sections = useMemo(() => {
    if (!lingerId) return rawSections;
    const row = sessions.find((s) => s.id === lingerId);
    if (!row) return rawSections;
    return {
      ...rawSections,
      next: { scheduled_at: row.scheduled_at, session: row },
      nextEditable: true,
      upcoming: rawSections.upcoming.filter((u) => u.session?.id !== lingerId),
      history: rawSections.history.filter((h) => h.session?.id !== lingerId),
    };
  }, [rawSections, lingerId, sessions]);

  // Save the schedule; the list re-derives from `rule` (no Generate button, T1).
  async function handleSave() {
    await setSchedule(membershipId, rule);
  }

  async function handleAdhoc() {
    if (!adhocDate) return;
    const iso = new Date(`${adhocDate}T${adhocTime}:00Z`).toISOString();
    const s = await createAdhocSession(membershipId, iso);
    setSessions((p) => [...p, s].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)));
    setAdhocDate('');
  }

  /** Real row now, materializing the virtual slot on first touch (T5). */
  async function ensureRow(slot: SessionSlot): Promise<Session> {
    if (slot.session) return slot.session;
    const s = await materializeSession(membershipId, slot.scheduled_at);
    setSessions((p) =>
      p.some((x) => x.id === s.id) ? p : [...p, s].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)));
    return s;
  }

  async function handleCancel(slot: SessionSlot) {
    try {
      const s = await ensureRow(slot);
      await setSessionCanceled(s.id, !s.canceled);
      setSessions((p) => p.map((x) => (x.id === s.id ? { ...x, canceled: !s.canceled } : x)));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function handleAttendance(slot: SessionSlot, status: AttendanceStatus) {
    try {
      const s = await ensureRow(slot);
      const next = s.attendance_status === status ? null : status;
      await setSessionAttendance(s.id, next);
      setSessions((p) => p.map((x) => (x.id === s.id ? { ...x, attendance_status: next } : x)));
      // Linger in Next for 3s showing the selection, then let it reflow to History.
      if (next) {
        setLingerId(s.id);
        setTimeout(() => setLingerId((cur) => (cur === s.id ? null : cur)), 3000);
      } else {
        setLingerId((cur) => (cur === s.id ? null : cur));
      }
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  // One card renderer for all three sections; flags gate attendance/cancel.
  function SlotCard({ slot, attendance, cancelable }: {
    slot: SessionSlot; attendance: boolean; cancelable: boolean;
  }) {
    const s = slot.session;
    const canceled = s?.canceled ?? false;
    return (
      <div className="card flex flex-col gap-2" style={{ padding: '12px 14px', opacity: canceled ? 0.5 : 1 }}>
        <div className="flex items-center gap-3">
          <DateChip iso={slot.scheduled_at} locale={locale} />
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {new Date(slot.scheduled_at).toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}
              {s?.is_adhoc && <span className="badge" style={{ fontSize: 10 }}>{t('sessions.adhoc')}</span>}
              {canceled && <span className="badge badge-muted" style={{ fontSize: 10 }}>{t('sessions.canceled')}</span>}
              {!canceled && s?.attendance_status && (
                <span className="badge" style={{ fontSize: 10 }}>{t(`att.${s.attendance_status}`)}</span>
              )}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtTime(slot.scheduled_at, locale)}</span>
          </div>
          {cancelable && (
            <button onClick={() => handleCancel(slot)} className="btn btn-ghost shrink-0" style={{ minHeight: 30, fontSize: 11 }}>
              {canceled ? t('sessions.reinstate') : t('sessions.cancel')}
            </button>
          )}
        </div>
        {attendance && !canceled && (
          <div className="flex flex-wrap gap-1">
            {ATT_STATUSES.map((st) => {
              const on = s?.attendance_status === st;
              return (
                <button key={st} onClick={() => handleAttendance(slot, st)} className={on ? 'btn btn-primary' : 'btn btn-ghost'}
                        style={{ minHeight: 30, fontSize: 11, padding: '0 12px' }}>
                  {t(`att.${st}`)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const empty = !sections.next && sections.upcoming.length === 0 && sections.history.length === 0;

  return (
    <div className="flex flex-col gap-3">
      {err && (
        <div className="card" role="alert" style={{ padding: '10px 14px', color: 'var(--danger)', background: 'var(--danger-muted)', borderColor: 'var(--danger-muted)', fontSize: 13 }}>
          {err}
        </div>
      )}
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
          <button onClick={handleSave} className="btn btn-primary" style={{ minHeight: 40, fontSize: 13, padding: '0 18px' }}>
            {t('sessions.saveSchedule')}
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

      {empty && (
        <div className="flex flex-col gap-2">
          <SectionTitle>{t('sessions.title')}</SectionTitle>
          <EmptyState>{t('sessions.none')}</EmptyState>
        </div>
      )}

      {/* Next session — the only attendance-editable slot (T2/T3/T4). */}
      {sections.next && (
        <div className="flex flex-col gap-2">
          <SectionTitle>
            {new Date(sections.next.scheduled_at).getTime() <= Date.now()
              ? t('sessions.awaitingAttendance')
              : t('sessions.next')}
          </SectionTitle>
          <SlotCard slot={sections.next} attendance={sections.nextEditable} cancelable />
        </div>
      )}

      {/* Upcoming — read-only, cancelable (T3). */}
      {sections.upcoming.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionTitle>{t('sessions.upcoming')}</SectionTitle>
          {sections.upcoming.map((slot) => (
            <SlotCard key={slot.scheduled_at} slot={slot} attendance={false} cancelable />
          ))}
        </div>
      )}

      {/* History — resolved rows, newest first (T2). */}
      {sections.history.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionTitle>{t('sessions.history')}</SectionTitle>
          {sections.history.map((slot) => (
            // Canceled rows live here (isResolved) — keep them reinstatable; graded rows stay read-only.
            <SlotCard key={slot.scheduled_at} slot={slot} attendance={false} cancelable={slot.session?.canceled ?? false} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Homework prescription (E1/E5) -------------------------------------------

const STATUS_KEY = {
  open: 'homework.statusOpen',
  completed: 'homework.statusCompleted',
  missed: 'homework.statusMissed',
} as const satisfies Record<HomeworkStatus, string>;

type Entry =
  | { kind: 'surah'; surah: number; ayah_start: number | null; ayah_end: number | null }
  | { kind: 'juz'; juz: number };

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
  // Prescribe form is collapsed by default; the tab opens on the review surface (P6).
  const [prescribing, setPrescribing] = useState(false);
  // Review feed is paginated client-side (recency order); reveal more on demand.
  const PER_PAGE = 8;
  const [shown, setShown] = useState(PER_PAGE);

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
      setPrescribing(false); // collapse the form after a successful prescribe (P7).
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

  // Unified review feed: prescription groups + self-submissions in one list,
  // newest first. Each entry carries a sort timestamp (a group uses its newest
  // row's created_at). Self-submissions are no longer a separate section.
  const feed = useMemo(() => {
    const groups = groupHomework(items).map((group) => ({
      kind: 'rx' as const,
      key: `rx-${group.key}`,
      ts: group.items.reduce((m, h) => (h.created_at > m ? h.created_at : m), group.items[0].created_at),
      group,
    }));
    const subs = selfSubmissions.map((l) => ({ kind: 'sub' as const, key: `sub-${l.id}`, ts: l.created_at, log: l }));
    return [...groups, ...subs].sort((a, b) => b.ts.localeCompare(a.ts));
  }, [items, selfSubmissions]);

  return (
    <div className="flex flex-col gap-2">
      {/* Prescribe form collapsed behind a button; review is the default surface (P6/P7). */}
      {!prescribing && (
        <button onClick={() => setPrescribing(true)} className="btn btn-primary self-start" style={{ minHeight: 44 }}>
          {t('homework.prescribe')}
        </button>
      )}
      {prescribing && (
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
        <div className="flex gap-2">
          <button onClick={handlePrescribe} disabled={busy || entries.length === 0} className="btn btn-primary" style={{ minHeight: 44 }}>
            {t('homework.prescribe')}
          </button>
          <button onClick={() => setPrescribing(false)} className="btn btn-ghost" style={{ minHeight: 44 }}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
      )}

      {/* Unified review feed — prescriptions + self-submissions, newest first,
          paginated. Every entry is collapsed until selected (H3/H4/G2). */}
      <SectionTitle>{t('grade.reviewFeed')}</SectionTitle>
      {feed.length === 0 && <EmptyState>{t('grade.noSubmissions')}</EmptyState>}
      {feed.slice(0, shown).map((entry) =>
        entry.kind === 'rx' ? (
          <PrescriptionCard
            key={entry.key} group={entry.group} locale={locale}
            linkedCount={linkedCount} logsByHomework={logsByHomework}
            teacherStatuses={teacherStatuses} onGraded={onGraded} onEditDeadline={handleEditDeadline}
          />
        ) : (
          <div key={entry.key} className="card" style={{ padding: '12px 16px' }}>
            <GradeableLog log={entry.log} statuses={teacherStatuses} onGraded={onGraded} />
          </div>
        ),
      )}
      {feed.length > shown && (
        <button onClick={() => setShown((n) => n + PER_PAGE)} className="btn btn-ghost self-center" style={{ minHeight: 40, fontSize: 13 }}>
          {t('grade.loadMore')}
        </button>
      )}
    </div>
  );
}

// --- One prescription group as a collapsed card (H3/H4) -----------------------
// Header (type + status) is always shown; instructions, deadline editor, entries
// and their gradeable logs appear only once the card is selected.
function PrescriptionCard({
  group, locale, linkedCount, logsByHomework, teacherStatuses, onGraded, onEditDeadline,
}: {
  group: { key: string; items: Homework[] };
  locale: 'en' | 'ar';
  linkedCount: Map<string, number>;
  logsByHomework: Map<string, ProgressLog[]>;
  teacherStatuses: StatusConfig[];
  onGraded: (id: string, grade: { teacher_status: string | null; teacher_comment: string | null }) => void;
  onEditDeadline: (ids: string[], value: string) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const status = aggregateStatus(group.items.map((h) => homeworkStatus(h, linkedCount.get(h.id) ?? 0, today())));
  const ids = group.items.map((h) => h.id);
  const instr = group.items.find((h) => h.instructions)?.instructions;

  return (
    <div className="card flex flex-col gap-2" style={{ padding: '12px 16px' }}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center justify-between gap-2 text-start"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {`${t(group.items[0].type === 'memorization' ? 'homework.verbMemorize' : 'homework.verbReview')} ${homeworkTarget(group.items, locale, t('homework.juz'))}`}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <span className="badge" style={{ fontSize: 10, ...HOMEWORK_STATUS_STYLE[status] }}>{t(STATUS_KEY[status])}</span>
          <Chevron open={open} />
        </span>
      </button>
      {open && (<>
        {instr && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{instr}</span>}
        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('homework.deadline')}
          <input type="date" defaultValue={group.items[0].deadline ?? ''} onChange={(e) => onEditDeadline(ids, e.target.value)}
                 className="input input-sm" style={{ minHeight: 34 }} />
        </label>
        {group.items.map((h) => {
          const subs = logsByHomework.get(h.id) ?? [];
          return (
            <div key={h.id} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }} className="flex flex-col gap-2">
              {/* The prescription target */}
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {t('homework.prescribedLabel')}
                </span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {homeworkEntryLabel(h, locale, t('homework.juz')) ?? `${t('log.pageRange')} ${h.page_start}–${h.page_end}`}
                  {h.surah && h.ayah_start == null ? ` ${t('homework.whole')}` : ''}
                </span>
              </div>
              {/* Student submissions logged against it — indented under a subhead */}
              <div className="flex flex-col gap-1" style={{ marginInlineStart: 10, paddingInlineStart: 10, borderInlineStart: '2px solid var(--border-subtle)' }}>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {t('homework.submissions')}
                </span>
                {subs.length === 0
                  ? <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('homework.noSubmissionsYet')}</span>
                  : subs.map((l, i) => <GradeableLog key={l.id} log={l} statuses={teacherStatuses} onGraded={onGraded} divided={i > 0} />)}
              </div>
            </div>
          );
        })}
      </>)}
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
  const [mode, setMode] = useState<'surah' | 'juz'>('surah');
  const [juz, setJuz] = useState(1);
  const [surah, setSurah] = useState(1);
  const max = AYAH_COUNTS[surah] ?? 1;
  const clamp = (n: number) => Math.max(1, Math.min(max, n));
  // Ayah fields held as raw text so they can be cleared / mid-edited; coerced
  // and clamped only on blur and on Add (P1/P2). Default is the full 1..max.
  const [startText, setStartText] = useState('1');
  const [endText, setEndText] = useState(String(max));

  // coerce a draft field to a valid ayah; empty/NaN falls back to its bound.
  const coerce = (text: string, fallback: number) => {
    const n = Number(text);
    return text.trim() === '' || Number.isNaN(n) ? fallback : clamp(n);
  };

  // When the surah changes, reset the range to the new full surah.
  const pickSurah = (s: number) => {
    setSurah(s);
    setStartText('1');
    setEndText(String(AYAH_COUNTS[s] ?? 1));
  };

  function add() {
    const a = coerce(startText, 1);
    const b = coerce(endText, max);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    // Full range → store null (whole surah) so cards/chips render "whole" (P5).
    const whole = lo === 1 && hi === max;
    onChange([...entries, whole
      ? { kind: 'surah', surah, ayah_start: null, ayah_end: null }
      : { kind: 'surah', surah, ayah_start: lo, ayah_end: hi }]);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Mode toggle: prescribe a surah range or a whole juz. */}
      <div className="flex gap-1">
        {(['surah', 'juz'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={mode === m ? 'btn btn-primary' : 'btn btn-ghost'}
                  style={{ minHeight: 34, fontSize: 12, padding: '0 14px' }}>
            {t(m === 'surah' ? 'homework.modeSurah' : 'homework.modeJuz')}
          </button>
        ))}
      </div>
      {mode === 'juz' ? (
        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('homework.juz')}</span>
            <select value={juz} onChange={(e) => setJuz(Number(e.target.value))} className="input" style={{ minHeight: 40, width: 'auto', paddingInlineStart: 10, paddingInlineEnd: 28 }}>
              {Array.from({ length: TOTAL_JUZ }, (_, i) => i + 1).map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </label>
          <button onClick={() => onChange([...entries, { kind: 'juz', juz }])} className="btn btn-outline"
                  style={{ minHeight: 40, fontSize: 13, padding: '0 16px' }}>
            {t('homework.addJuz')}
          </button>
        </div>
      ) : (
      <div className="flex flex-wrap gap-2 items-end">
        <label className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('log.surah')}</span>
          <SurahCombobox value={surah} onChange={pickSurah} locale={locale} placeholder={t('homework.searchSurah')} />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('log.ayahFrom')}
          <input type="number" inputMode="numeric" min={1} max={max} value={startText}
                 onChange={(e) => setStartText(e.target.value)}
                 onBlur={() => setStartText(String(coerce(startText, 1)))}
                 className="input input-sm" style={{ minHeight: 40, width: 80 }} />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('log.ayahTo')}
          <input type="number" inputMode="numeric" min={1} max={max} value={endText}
                 onChange={(e) => setEndText(e.target.value)}
                 onBlur={() => setEndText(String(coerce(endText, max)))}
                 className="input input-sm" style={{ minHeight: 40, width: 80 }} />
        </label>
        <button onClick={add} className="btn btn-outline" style={{ minHeight: 40, fontSize: 13, padding: '0 16px' }}>
          {t('homework.addSurah')}
        </button>
      </div>
      )}
      {entries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {entries.map((e, i) => (
            <span key={i} className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {e.kind === 'juz'
                ? `${t('homework.juz')} ${e.juz}`
                : `${getSurahName(e.surah, locale)}${e.ayah_start ? ` ${e.ayah_start}–${e.ayah_end}` : ` ${t('homework.whole')}`}`}
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
  log: l, statuses, onGraded, divided = false,
}: {
  log: ProgressLog;
  statuses: StatusConfig[];
  onGraded: (id: string, grade: { teacher_status: string | null; teacher_comment: string | null }) => void;
  // Top divider only when stacked among sibling logs; standalone cards omit it.
  divided?: boolean;
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  // Collapsed by default — details + grade controls only appear once selected.
  const [open, setOpen] = useState(false);

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
    <div style={divided ? { borderTop: '1px solid var(--border-subtle)', paddingTop: 8 } : undefined} className="flex flex-col gap-1">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center justify-between gap-2 text-start"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {t(`logType.${l.log_type}`)} · p{l.page_start}–{l.page_end}
          {l.surah && l.ayah_start ? ` · ${l.surah}:${l.ayah_start}${l.ayah_end && l.ayah_end !== l.ayah_start ? `–${l.ayah_end}` : ''}` : ''}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {!l.reviewed_at && <span className="badge" style={{ fontSize: 10, ...HOMEWORK_STATUS_STYLE.open }}>{t('grade.needsReview')}</span>}
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{l.log_date}</span>
          <Chevron open={open} />
        </span>
      </button>

      {open && (<>
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
      </>)}
    </div>
  );
}


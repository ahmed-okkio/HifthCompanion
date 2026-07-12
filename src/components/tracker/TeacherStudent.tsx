'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';
import { setMembershipStatus } from '@/lib/services/membership';
import type {
  AttendanceStatus, Circle, Exam, ExamStatus, Homework, LogType, MemberWithProfile,
  ProgressLog, Session, StatusConfig,
} from '@/types';
import { displayName } from '@/lib/displayName';
import {
  createAdhocSession, materializeSession, rescheduleSession, setSchedule, setSessionAttendance, setSessionCanceled,
} from '@/lib/services/sessions';
import { sectionSessions, floatingNow, type SessionSlot } from '@/lib/recurrence';
import { prescribeHomework, editDeadline, deleteHomework } from '@/lib/services/homework';
import { gradeLog, logAndReview } from '@/lib/services/progressLog';
import { scheduleExam, gradeExam, deleteExam } from '@/lib/services/exam';
import type { NoteWithAuthor } from '@/lib/services/membershipNotes';
import NotesThread from './NotesThread';
import {
  homeworkStatus, aggregateStatus, groupHomework, homeworkEntryLabel, homeworkTarget, type HomeworkStatus,
} from '@/lib/homework';
import { AYAH_COUNTS, TOTAL_JUZ, TOTAL_SURAHS, getSurahName, getSurahForPage, spreadUrl } from '@/lib/quran';
import {
  SectionTitle, EmptyState, Avatar, StatCard, Ring, StatusDot, DateChip, TabBar,
  SurahCombobox, SegmentedControl, HOMEWORK_STATUS_STYLE, Chevron, Icon, TimeSelect,
} from './ui';
import { attendanceStats } from '@/lib/analytics';
import MarkedPagesList from '@/components/MarkedPagesList';
import type { MarkedPage } from '@/lib/markedPages';

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
  memorized,
  initialNotes,
  initialExams,
  markedPages,
}: {
  circle: Circle;
  member: MemberWithProfile;
  initialSessions: Session[];
  defaultSetId: string | null;
  initialHomework: Homework[];
  logs: ProgressLog[];
  /** Juz/surah totals from the student's persistent user_hifth profile. */
  memorized: { juz: number; surahs: number };
  initialNotes: NoteWithAuthor[];
  initialExams: Exam[];
  /** PRD 0009 C1: default-set marked pages, read-only here. */
  markedPages: MarkedPage[];
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState('sessions');
  // Annotations live in the desktop profile column; below lg they become a tab.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Deactivate lives here (student profile) only, grey + confirm-gated, so it
  // can't be hit by accident from the roster. Redirects back to the circle.
  async function handleDeactivate() {
    if (!window.confirm(t('tracker.deactivateConfirm'))) return;
    await setMembershipStatus(member.id, 'blocked');
    router.push(`/tracker/${circle.id}`);
  }
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
      <StudentProfileCard
        name={displayName(member)} circleName={circle.name} defaultSetId={defaultSetId}
        memorized={memorized} attendance={attendance} openHomework={openHomework}
        markedPages={markedPages} markedDesktopOnly
      />

      {/* Right column — the feed: tabs + panels, unchanged */}
      <div className="flex flex-col gap-5 min-w-0">
        <TabBar
          tabs={[
            { key: 'sessions', label: t('sessions.tabSessions') },
            { key: 'homework', label: t('homework.title') },
            { key: 'exams', label: t('exam.title') },
            { key: 'notes', label: t('notes.title') },
            ...(isMobile ? [{ key: 'annotations', label: t('reader.marked') }] : []),
            { key: 'settings', label: t('common.settings') },
          ]}
          active={tab}
          onSelect={setTab}
        />

        {tab === 'sessions' && (
          <StudentSessions
            membershipId={member.id}
            initial={initialSessions}
            initialSchedule={member.schedule}
          />
        )}
        {tab === 'homework' && <HomeworkPanel membershipId={member.id} initial={initialHomework} logs={logs} teacherStatuses={circle.teacher_statuses} studentStatuses={circle.student_statuses} />}
        {tab === 'exams' && <ExamsPanel membershipId={member.id} initial={initialExams} locale={locale} />}
        {tab === 'notes' && <NotesThread membershipId={member.id} initial={initialNotes} />}
        {isMobile && tab === 'annotations' && (
          <div className="card flex flex-col gap-2" style={{ padding: '16px 0 8px' }}>
            <div className="px-4"><SectionTitle>{t('reader.marked')}</SectionTitle></div>
            <div className="overflow-y-auto thin-scroll" style={{ maxHeight: 400 }}>
              <MarkedPagesList
                rows={markedPages}
                limit={3}
                hrefFor={defaultSetId ? (page) => `/share/${defaultSetId}/${spreadUrl(page)}` : undefined}
              />
            </div>
          </div>
        )}
        {tab === 'settings' && (
          <div className="card flex flex-col gap-3" style={{ padding: '18px 20px' }}>
            <SectionTitle>{t('common.settings')}</SectionTitle>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('tracker.deactivate')}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('tracker.deactivateHint')}
                </span>
              </div>
              {member.status === 'active' ? (
                <button onClick={handleDeactivate} className="btn btn-ghost shrink-0"
                        style={{ minHeight: 34, fontSize: 13, color: 'var(--text-muted)' }}>
                  {t('tracker.deactivate')}
                </button>
              ) : (
                <span className="badge badge-muted shrink-0">{t(`tracker.${member.status}`)}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Empty right spacer mirrors the sidebar width so the feed sits centered in the page. */}
      <div className="hidden lg:block" aria-hidden />
    </div>
  );
}

// --- Profile stat block: compact ring tile + colored attendance line ---------

/**
 * Profile identity + KPIs + Mushaf sidebar. Shared by the teacher's student
 * detail view and the student's own self-service view (same three cards).
 */
export function StudentProfileCard({
  name, circleName, defaultSetId, memorized, attendance, openHomework, markedPages, markedDesktopOnly,
}: {
  name: string;
  circleName: string;
  defaultSetId: string | null;
  memorized: { juz: number; surahs: number };
  attendance: { status: AttendanceStatus }[];
  openHomework: number;
  /** PRD 0009 C1/C2: default-set marked pages, read-only. Omit to hide the card. */
  markedPages?: MarkedPage[];
  /** When set, the marked-pages card only shows ≥lg (mobile surfaces it as a tab instead). */
  markedDesktopOnly?: boolean;
}) {
  const { t, fmtNum } = useI18n();
  const att = useMemo(() => attendanceStats(attendance), [attendance]);
  return (
    <aside className="order-first lg:order-none flex flex-col gap-3 self-start">
      <div className="card flex flex-col items-center text-center gap-2" style={{ padding: '22px' }}>
        <Avatar seed={name} size={64} />
        <h1 className="font-bold tracking-tight truncate max-w-full"
            style={{ color: 'var(--text-primary)', fontSize: 'var(--type-heading-m-size)' }}>
          {name}
        </h1>
        <span className="text-xs truncate max-w-full" style={{ color: 'var(--text-muted)' }}>{circleName}</span>
        <div className="mt-1"><MushafButton setId={defaultSetId} /></div>
      </div>

      <div className="card flex flex-col gap-3" style={{ padding: '16px' }}>
        <div className="grid grid-cols-2 gap-2">
          <RingTile value={memorized.juz} max={TOTAL_JUZ} label={t('analytics.juz')} />
          <RingTile value={memorized.surahs} max={TOTAL_SURAHS} label={t('analytics.surahs')} />
        </div>
        <div style={{ height: 1, background: 'var(--border-subtle)' }} />
        <AttendanceLine marked={att.marked} rate={att.rate} />
      </div>
      <StatCard icon={<Icon name="hourglass" />} value={fmtNum(openHomework)} label={t('homework.openHomework')} />

      {/* PRD 0009 C1/C3: default-set marked pages, read-only. Empty set → in-card empty state. */}
      {markedPages && (
        <div className={`card flex-col gap-2 ${markedDesktopOnly ? 'hidden lg:flex' : 'flex'}`} style={{ padding: '16px 0 8px' }}>
          <div className="px-4"><SectionTitle>{t('reader.marked')}</SectionTitle></div>
          <div className="overflow-y-auto thin-scroll" style={{ maxHeight: 320 }}>
            <MarkedPagesList
              rows={markedPages}
              limit={3}
              hrefFor={defaultSetId ? (page) => `/share/${defaultSetId}/${spreadUrl(page)}` : undefined}
            />
          </div>
        </div>
      )}
    </aside>
  );
}

/** Ring above value/label, centered — the side-by-side variant. */
function RingTile({ value, max, label }: { value: number; max: number; label: string }) {
  const { fmtNum } = useI18n();
  return (
    <div className="flex flex-col items-center text-center gap-1.5" style={{ padding: '4px 0' }}>
      <Ring value={value} max={max} size={52} />
      <span className="font-bold leading-tight" style={{ color: 'var(--text-primary)', fontSize: 16 }}>
        {fmtNum(value)} / {fmtNum(max)}
      </span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

/** "Attendance: Good" with a color keyed to the rate. */
function AttendanceLine({ marked, rate }: { marked: number; rate: number }) {
  const { t, fmtNum } = useI18n();
  if (marked === 0) {
    return (
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
        <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('analytics.attendance')}</span>
        <span>{t('analytics.attNone')}</span>
      </div>
    );
  }
  const [key, color] =
    rate >= 0.85 ? ['analytics.attGood', 'var(--success)'] as const
    : rate >= 0.6 ? ['analytics.attFair', 'var(--warning)'] as const
    : ['analytics.attLow', 'var(--danger)'] as const;
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('analytics.attendance')}</span>
      <span className="flex items-center gap-1.5 font-semibold" style={{ color }}>
        <StatusDot color={color} />
        {t(key)} · {fmtNum(Math.round(rate * 100))}%
      </span>
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
    <a href={`/share/${setId}`} className="btn btn-outline" style={{ minHeight: 36, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
  initialSchedule: { weekdays: number[]; time: string; timezone?: string } | null;
}) {
  const { t, locale, fmtNum } = useI18n();
  const [sessions, setSessions] = useState(initial);
  const [sessTab, setSessTab] = useState<'upcoming' | 'history'>('upcoming');
  // Schedule editor is collapsed behind a button (set once, tweaked rarely).
  const [showSchedule, setShowSchedule] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>(initialSchedule?.weekdays ?? []);
  const [time, setTime] = useState(initialSchedule?.time ?? '17:00');
  const [tz, setTz] = useState(initialSchedule?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [adhocDate, setAdhocDate] = useState('');
  const [adhocTime, setAdhocTime] = useState('17:00');
  const [err, setErr] = useState<string | null>(null);
  // Just-marked session id: keeps the slot in Next (showing the selection) for a
  // beat before it reflows into History (T5 linger).
  const [lingerId, setLingerId] = useState<string | null>(null);
  // Slot currently being rescheduled (keyed by its scheduled_at) + draft fields.
  const [reschedKey, setReschedKey] = useState<string | null>(null);
  const [reschedDate, setReschedDate] = useState('');
  const [reschedTime, setReschedTime] = useState('');
  // overflow:hidden clips the slide-down while it grows; the clock popup needs
  // overflow:visible, so lift the clip once the open animation finishes.
  const [reschedOpen, setReschedOpen] = useState(false);

  // Localized weekday short labels (2023-01-01 is a Sunday → index 0 = Sun).
  const dayLabels = useMemo(
    () => Array.from({ length: 7 }, (_, d) =>
      new Date(Date.UTC(2023, 0, 1 + d)).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })),
    [locale],
  );

  const rule = weekdays.length ? { weekdays, time, timezone: tz } : null;

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

  // Open the inline editor pre-filled with the slot's current local date/time.
  function openReschedule(slot: SessionSlot) {
    const d = new Date(slot.scheduled_at);
    const pad = (n: number) => String(n).padStart(2, '0');
    setReschedDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    setReschedTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setReschedOpen(false);
    setReschedKey(slot.scheduled_at);
  }

  async function handleReschedule(slot: SessionSlot) {
    if (!reschedDate || !reschedTime) return;
    try {
      const s = await ensureRow(slot); // real row at the original time
      const newIso = new Date(`${reschedDate}T${reschedTime}`).toISOString();
      // Keep pointing at the FIRST recurrence slot if this row was already moved.
      const movedFrom = s.moved_from ?? slot.scheduled_at;
      await rescheduleSession(s.id, newIso, movedFrom);
      setSessions((p) =>
        p.map((x) => (x.id === s.id ? { ...x, scheduled_at: newIso, moved_from: movedFrom } : x))
          .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)));
      setReschedKey(null);
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
  function SlotCard({ slot, attendance, cancelable, reschedulable }: {
    slot: SessionSlot; attendance: boolean; cancelable: boolean; reschedulable?: boolean;
  }) {
    const s = slot.session;
    const canceled = s?.canceled ?? false;
    const moved = !!s?.moved_from;
    const editing = reschedKey === slot.scheduled_at;
    return (
      <div className="card flex flex-col gap-2" style={{ padding: '12px 14px', opacity: canceled ? 0.5 : 1 }}>
        <div className="flex items-center gap-3">
          <DateChip iso={slot.scheduled_at} locale={locale} />
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {fmtNum(new Date(slot.scheduled_at).toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' }))}
              {s?.is_adhoc && <span className="badge" style={{ fontSize: 10 }}>{t('sessions.adhoc')}</span>}
              {moved && <span className="badge badge-muted" style={{ fontSize: 10 }}>{t('sessions.rescheduled')}</span>}
              {canceled && <span className="badge badge-muted" style={{ fontSize: 10 }}>{t('sessions.canceled')}</span>}
              {!canceled && s?.attendance_status && (
                <span className="badge" style={{ fontSize: 10 }}>{t(`att.${s.attendance_status}`)}</span>
              )}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtNum(fmtTime(slot.scheduled_at, locale))}</span>
          </div>
          {reschedulable && !canceled && (
            <button onClick={() => (editing ? setReschedKey(null) : openReschedule(slot))} className="btn btn-ghost shrink-0" style={{ minHeight: 30, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {t('sessions.reschedule')}
              <Chevron open={editing} />
            </button>
          )}
          {cancelable && (
            <button onClick={() => handleCancel(slot)} className="btn btn-ghost shrink-0" style={{ minHeight: 30, fontSize: 11 }}>
              {canceled ? t('sessions.reinstate') : t('sessions.cancel')}
            </button>
          )}
        </div>
        {editing && (
          <div className="flex gap-2 items-end flex-wrap" onAnimationEnd={() => setReschedOpen(true)}
               style={{ borderTop: '1px solid var(--border-subtle)', overflow: reschedOpen ? 'visible' : 'hidden', animation: 'slide-down 0.22s var(--ease-out) both' }}>
            <input type="date" value={reschedDate} onChange={(e) => setReschedDate(e.target.value)} className="input" style={{ minHeight: 36 }} />
            <TimeSelect value={reschedTime} onChange={setReschedTime} style={{ minHeight: 36, width: 130 }} />
            <button onClick={() => handleReschedule(slot)} className="btn btn-primary" style={{ minHeight: 36, fontSize: 12, padding: '0 14px' }}>
              {t('common.save')}
            </button>
            <button onClick={() => setReschedKey(null)} className="btn btn-ghost" style={{ minHeight: 36, fontSize: 12 }}>
              {t('common.cancel')}
            </button>
          </div>
        )}
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
      {/* Schedule + ad-hoc collapsed behind a button (set once, tweaked rarely). */}
      <button onClick={() => setShowSchedule((v) => !v)} className={`${weekdays.length ? 'btn btn-outline' : 'btn btn-primary'} self-start`}
              style={{ minHeight: 40, fontSize: 13, padding: '0 16px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Icon name="calendar" size={16} />
        {weekdays.length ? t('sessions.editSchedule') : t('sessions.setSchedule')}
        <Chevron open={showSchedule} color={weekdays.length ? 'var(--text-muted)' : 'var(--accent-contrast, #fff)'} />
      </button>

      {showSchedule && (
      <div className="card flex flex-col gap-3" style={{ padding: '16px 18px' }}>
        <SectionTitle>{t('tracker.tabSchedule')}</SectionTitle>
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
      )}

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
          <SlotCard slot={sections.next} attendance={sections.nextEditable} cancelable reschedulable />
        </div>
      )}

      {/* Upcoming + History share a sub-tab so only one list is on the page at a
          time — keeps the Sessions tab from growing very tall (T2/T3). */}
      {(sections.upcoming.length > 0 || sections.history.length > 0) && (
        <div className="flex flex-col gap-2">
          <TabBar
            tabs={[
              { key: 'upcoming', label: `${t('sessions.upcoming')} (${fmtNum(sections.upcoming.length)})` },
              { key: 'history', label: `${t('sessions.history')} (${fmtNum(sections.history.length)})` },
            ]}
            active={sessTab}
            onSelect={(k) => setSessTab(k as 'upcoming' | 'history')}
          />
          {sessTab === 'upcoming' &&
            (sections.upcoming.length > 0 ? (
              sections.upcoming.map((slot) => (
                <SlotCard key={slot.scheduled_at} slot={slot} attendance={false} cancelable reschedulable />
              ))
            ) : (
              <EmptyState>{t('sessions.none')}</EmptyState>
            ))}
          {sessTab === 'history' &&
            (sections.history.length > 0 ? (
              <PagedHistory
                slots={sections.history}
                render={(slot) => (
                  // Canceled rows stay reinstatable; graded rows read-only.
                  <SlotCard key={slot.scheduled_at} slot={slot} attendance={false} cancelable={slot.session?.canceled ?? false} />
                )}
              />
            ) : (
              <EmptyState>{t('sessions.none')}</EmptyState>
            ))}
        </div>
      )}
    </div>
  );
}

// --- History pager: show only as many rows as fit without scrolling ----------
// Measures the gap between the list's top and the scroll container's bottom and
// divides by an approximate card height to pick a page size, so History never
// pushes the page into a scroll. ponytail: CARD_H is a fixed estimate; if slot
// cards change height materially, bump it.
function PagedHistory({
  slots, render,
}: {
  slots: SessionSlot[];
  render: (slot: SessionSlot) => React.ReactNode;
}) {
  const { fmtNum } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [perPage, setPerPage] = useState(4);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const scroller = el.closest('main');
      const top = el.getBoundingClientRect().top;
      const bottom = scroller ? scroller.getBoundingClientRect().bottom : window.innerHeight;
      const CARD_H = 88; // approx slot card + gap
      const avail = bottom - top - 44; // reserve room for the pager row
      setPerPage(Math.max(1, Math.floor(avail / CARD_H)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [slots.length]);

  const pages = Math.max(1, Math.ceil(slots.length / perPage));
  const cur = Math.min(page, pages - 1);
  const shown = slots.slice(cur * perPage, cur * perPage + perPage);

  const arrow: React.CSSProperties = { minHeight: 32, minWidth: 32, fontSize: 16, padding: 0 };

  return (
    <div ref={ref} className="flex flex-col gap-2">
      {shown.map(render)}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button className="btn btn-ghost" style={arrow} disabled={cur === 0}
                  onClick={() => setPage(cur - 1)} aria-label="Previous">
            <span className="rtl:-scale-x-100">‹</span>
          </button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtNum(cur + 1)} / {fmtNum(pages)}</span>
          <button className="btn btn-ghost" style={arrow} disabled={cur >= pages - 1}
                  onClick={() => setPage(cur + 1)} aria-label="Next">
            <span className="rtl:-scale-x-100">›</span>
          </button>
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

export type Entry =
  | { kind: 'surah'; surah: number; ayah_start: number | null; ayah_end: number | null }
  | { kind: 'juz'; juz: number };

function HomeworkPanel({
  membershipId, initial, logs, teacherStatuses, studentStatuses,
}: {
  membershipId: string;
  initial: Homework[];
  logs: ProgressLog[];
  teacherStatuses: StatusConfig[];
  studentStatuses: StatusConfig[];
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

  // Delete a whole prescription group; linked logs survive (FK set null).
  async function handleDeleteHomework(ids: string[]) {
    await deleteHomework(ids);
    setItems((p) => p.filter((h) => !ids.includes(h.id)));
  }

  // Teacher-submitted homework result → prepend it to the log feed.
  const onResult = (log: ProgressLog) => setLogRows((p) => [log, ...p]);

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
        <button onClick={() => setPrescribing(true)} className="btn btn-primary self-center" style={{ minHeight: 44 }}>
          {t('homework.prescribe')}
        </button>
      )}
      {prescribing && (
      <div className="card flex flex-col gap-3" style={{ padding: '16px 18px', animation: 'fade-in-scale 0.2s var(--ease-out) both', transformOrigin: 'top' }}>
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
            onDelete={handleDeleteHomework} onResult={onResult} membershipId={membershipId}
            studentStatuses={studentStatuses}
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
  group, locale, linkedCount, logsByHomework, teacherStatuses, onGraded, onEditDeadline, onDelete, onResult, membershipId, studentStatuses,
}: {
  group: { key: string; items: Homework[] };
  locale: 'en' | 'ar';
  linkedCount: Map<string, number>;
  logsByHomework: Map<string, ProgressLog[]>;
  teacherStatuses: StatusConfig[];
  onGraded: (id: string, grade: { teacher_status: string | null; teacher_comment: string | null }) => void;
  onEditDeadline: (ids: string[], value: string) => void;
  onDelete: (ids: string[]) => void;
  onResult: (log: ProgressLog) => void;
  membershipId: string;
  studentStatuses: StatusConfig[];
}) {
  const { t, fmtNum } = useI18n();
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
                  {homeworkEntryLabel(h, locale, t('homework.juz')) ?? `${t('log.pageRange')} ${fmtNum(h.page_start)}–${fmtNum(h.page_end)}`}
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
                <TeacherResultForm hw={h} membershipId={membershipId} studentStatuses={studentStatuses} teacherStatuses={teacherStatuses} onResult={onResult} />
              </div>
            </div>
          );
        })}
        <button
          onClick={() => { if (confirm(t('homework.deleteConfirm'))) onDelete(ids); }}
          className="btn btn-danger-ghost self-start" style={{ minHeight: 36, fontSize: 13 }}
        >
          {t('homework.delete')}
        </button>
      </>)}
    </div>
  );
}

// --- Teacher submits a log for a homework on the student's behalf --------------
// Mirrors the student's homework-attach form (StudentCircle LogForm): creates a
// normal unreviewed submission (student_status) linked to the homework, using
// the homework's own scope. The teacher can then grade it like any other log.
function TeacherResultForm({
  hw, membershipId, studentStatuses, teacherStatuses, onResult,
}: {
  hw: Homework;
  membershipId: string;
  studentStatuses: StatusConfig[];
  teacherStatuses: StatusConfig[];
  onResult: (log: ProgressLog) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [studentStatus, setStudentStatus] = useState(studentStatuses[0]?.label ?? '');
  const [note, setNote] = useState('');
  const [logDate, setLogDate] = useState(today());
  // Review, submitted in the same shot (D6-teacher): grade + comment + reviewed_at.
  const [teacherStatus, setTeacherStatus] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const log = await logAndReview({
        membership_id: membershipId,
        homework_id: hw.id,
        log_date: logDate,
        log_type: hw.type,
        page_start: hw.page_start,
        page_end: hw.page_end,
        surah: hw.surah,
        ayah_start: hw.ayah_start,
        ayah_end: hw.ayah_end,
        student_status: studentStatus || null,
        student_notes: note || null,
        teacher_status: teacherStatus,
        teacher_comment: comment || null,
      });
      onResult(log);
      setOpen(false);
      setNote('');
      setComment('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-ghost self-start" style={{ minHeight: 32, fontSize: 12 }}>
        {t('homework.submitForStudent')}
      </button>
    );
  }

  const chipRow = (opts: StatusConfig[], value: string | null, set: (v: string) => void) => (
    <div className="flex flex-wrap gap-2">
      {opts.map((s) => (
        <button key={s.label} onClick={() => set(s.label)} className="badge" style={{
          cursor: 'pointer',
          background: value === s.label ? 'var(--accent)' : undefined,
          color: value === s.label ? '#fff' : undefined,
        }}>
          {s.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-2 mt-1">
      <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {t('log.date')}
        <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)}
               className="input input-sm" style={{ minHeight: 34 }} />
      </label>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('log.selfStatus')}</span>
      {chipRow(studentStatuses, studentStatus, setStudentStatus)}
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('log.note')} className="input input-sm" style={{ minHeight: 34 }} />
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('grade.teacherStatus')}</span>
      {chipRow(teacherStatuses, teacherStatus, setTeacherStatus)}
      <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('grade.comment')} className="input input-sm" style={{ minHeight: 34 }} />
      {error && <span className="text-xs" style={{ color: 'var(--danger)' }}>{error}</span>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={busy} className="btn btn-primary self-start" style={{ minHeight: 36, fontSize: 13 }}>
          {t('log.submit')}
        </button>
        <button onClick={() => setOpen(false)} className="btn btn-ghost" style={{ minHeight: 36, fontSize: 13 }}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}

// --- Surah picker: build the list of surah entries for a prescription (H1) ----

export function SurahPicker({
  entries, onChange, locale,
}: {
  entries: Entry[];
  onChange: (e: Entry[]) => void;
  locale: 'en' | 'ar';
}) {
  const { t, fmtNum } = useI18n();
  const [mode, setMode] = useState<'surah' | 'juz'>('surah');
  const [isRange, setIsRange] = useState(false);
  const [juz, setJuz] = useState(1);
  const [juzEnd, setJuzEnd] = useState(2);
  const [surah, setSurah] = useState(1);
  const [surahStart, setSurahStart] = useState(1);
  const [surahEnd, setSurahEnd] = useState(1);
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

  function addSurahRange() {
    const lo = Math.min(surahStart, surahEnd);
    const hi = Math.max(surahStart, surahEnd);
    const rangeEntries: Entry[] = [];
    for (let s = lo; s <= hi; s++) {
      rangeEntries.push({ kind: 'surah', surah: s, ayah_start: null, ayah_end: null });
    }
    onChange([...entries, ...rangeEntries]);
  }

  function addJuzRange() {
    const lo = Math.min(juz, juzEnd);
    const hi = Math.max(juz, juzEnd);
    const rangeEntries: Entry[] = [];
    for (let j = lo; j <= hi; j++) {
      rangeEntries.push({ kind: 'juz', juz: j });
    }
    onChange([...entries, ...rangeEntries]);
  }

  const fieldLabel = { color: 'var(--text-secondary)' } as const;
  const addEntry = mode === 'juz' ? (isRange ? addJuzRange : () => onChange([...entries, { kind: 'juz', juz }])) : (isRange ? addSurahRange : add);
  const addLabel = t('common.add');
  // Wide dashed "add" button — a quiet way to append another entry.
  const dashedAdd: React.CSSProperties = {
    minHeight: 44, border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-md)',
    background: 'transparent', color: 'var(--text-accent)', fontSize: 14, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer',
    transition: 'background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out)',
  };
  // Inline hover/press feedback (dashed button isn't a .btn, so no CSS states).
  const dashedFx = {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = 'var(--accent-muted)';
      e.currentTarget.style.borderColor = 'var(--accent)';
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.borderColor = 'var(--border-default)';
      e.currentTarget.style.transform = 'none';
    },
    onMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'scale(0.99)'; },
    onMouseUp: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'none'; },
  };

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        options={[
          { key: 'surah', label: t('homework.modeSurah'), icon: <Icon name="book" size={16} /> },
          { key: 'juz', label: t('homework.modeJuz'), icon: <Icon name="list" size={16} /> },
        ]}
        value={mode}
        onChange={(k) => { setMode(k as 'surah' | 'juz'); setIsRange(false); }}
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3 items-end">
          {mode === 'juz' ? (isRange ? (<>
            <label className="flex flex-col gap-1.5" style={{ width: 90 }}>
              <span className="text-xs font-medium" style={fieldLabel}>{locale === 'ar' ? 'من جزء' : 'From juz'}</span>
              <input type="number" inputMode="numeric" min={1} max={TOTAL_JUZ} value={juz}
                     onChange={(e) => setJuz(Math.max(1, Math.min(TOTAL_JUZ, Number(e.target.value) || 1)))}
                     className="input" style={{ minHeight: 44, width: '100%' }} />
            </label>
            <label className="flex flex-col gap-1.5" style={{ width: 90 }}>
              <span className="text-xs font-medium" style={fieldLabel}>{locale === 'ar' ? 'إلى جزء' : 'To juz'}</span>
              <input type="number" inputMode="numeric" min={1} max={TOTAL_JUZ} value={juzEnd}
                     onChange={(e) => setJuzEnd(Math.max(1, Math.min(TOTAL_JUZ, Number(e.target.value) || 1)))}
                     className="input" style={{ minHeight: 44, width: '100%' }} />
            </label>
          </>) : (
            <label className="flex flex-col gap-1.5" style={{ width: 120 }}>
              <span className="text-xs font-medium" style={fieldLabel}>{t('homework.juz')}</span>
              <input type="number" inputMode="numeric" min={1} max={TOTAL_JUZ} value={juz}
                     onChange={(e) => setJuz(Math.max(1, Math.min(TOTAL_JUZ, Number(e.target.value) || 1)))}
                     className="input" style={{ minHeight: 44, width: '100%' }} />
            </label>
          )) : (isRange ? (<>
            <label className="flex flex-col gap-1.5 flex-1" style={{ minWidth: 160 }}>
              <span className="text-xs font-medium" style={fieldLabel}>{locale === 'ar' ? 'من سورة' : 'From surah'}</span>
              <SurahCombobox fluid value={surahStart} onChange={setSurahStart} locale={locale} placeholder={t('homework.searchSurah')} />
            </label>
            <label className="flex flex-col gap-1.5 flex-1" style={{ minWidth: 160 }}>
              <span className="text-xs font-medium" style={fieldLabel}>{locale === 'ar' ? 'إلى سورة' : 'To surah'}</span>
              <SurahCombobox fluid value={surahEnd} onChange={setSurahEnd} locale={locale} placeholder={t('homework.searchSurah')} />
            </label>
          </>) : (<>
            <label className="flex flex-col gap-1.5 flex-1" style={{ minWidth: 160 }}>
              <span className="text-xs font-medium" style={fieldLabel}>{t('homework.modeSurah')}</span>
              <SurahCombobox fluid value={surah} onChange={pickSurah} locale={locale} placeholder={t('homework.searchSurah')} />
            </label>
            <label className="flex flex-col gap-1.5" style={{ width: 76 }}>
              <span className="text-xs font-medium" style={fieldLabel}>{t('log.ayahFrom')}</span>
              <input type="number" inputMode="numeric" min={1} max={max} value={startText}
                     onChange={(e) => setStartText(e.target.value)}
                     onBlur={() => setStartText(String(coerce(startText, 1)))}
                     className="input" style={{ minHeight: 44, width: '100%' }} />
            </label>
            <label className="flex flex-col gap-1.5" style={{ width: 76 }}>
              <span className="text-xs font-medium" style={fieldLabel}>{t('log.ayahTo')}</span>
              <input type="number" inputMode="numeric" min={1} max={max} value={endText}
                     onChange={(e) => setEndText(e.target.value)}
                     onBlur={() => setEndText(String(coerce(endText, max)))}
                     className="input" style={{ minHeight: 44, width: '100%' }} />
            </label>
          </>))}
          <button type="button" onClick={() => setIsRange((v) => !v)} aria-pressed={isRange}
                  className={isRange ? 'btn btn-primary shrink-0' : 'btn btn-outline shrink-0'}
                  style={{ minHeight: 44, fontSize: 13, padding: '0 16px' }}>
            {locale === 'ar' ? 'نطاق' : 'Range'}
          </button>
        </div>
        <button type="button" onClick={addEntry} style={dashedAdd} {...dashedFx}>
          <span aria-hidden style={{ fontSize: 17, lineHeight: 1, fontWeight: 500 }}>+</span>
          {addLabel}
        </button>
      </div>

      {entries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {entries.map((e, i) => (
            <span key={i} className="flex items-center gap-2"
                  style={{ padding: '6px 8px 6px 12px', borderRadius: 'var(--radius-full)', background: 'var(--accent-muted)', color: 'var(--text-accent)', fontSize: 13, fontWeight: 500 }}>
              {e.kind === 'juz'
                ? `${t('homework.juz')} ${fmtNum(e.juz)}`
                : `${getSurahName(e.surah, locale)}${e.ayah_start ? ` ${fmtNum(e.ayah_start)}–${fmtNum(e.ayah_end!)}` : ` ${t('homework.whole')}`}`}
              <button onClick={() => onChange(entries.filter((_, j) => j !== i))} aria-label={t('memorization.remove')}
                      className="flex items-center justify-center"
                      style={{ width: 18, height: 18, borderRadius: 'var(--radius-full)', background: 'var(--bg-surface)', color: 'var(--text-muted)', fontSize: 12, lineHeight: 1, cursor: 'pointer' }}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Exams: schedule + grade per student -------------------------------------

const EXAM_STATUS_KEY = {
  scheduled: 'exam.statusScheduled',
  passed: 'exam.statusPassed',
  failed: 'exam.statusFailed',
} as const satisfies Record<ExamStatus, string>;
const EXAM_STATUS_STYLE: Record<ExamStatus, React.CSSProperties> = {
  scheduled: { background: 'var(--accent-muted)', color: 'var(--text-accent)' },
  passed: { background: 'var(--success-muted)', color: 'var(--success)' },
  failed: { background: 'var(--danger-muted)', color: 'var(--danger)' },
};

function ExamsPanel({
  membershipId, initial, locale,
}: {
  membershipId: string;
  initial: Exam[];
  locale: 'en' | 'ar';
}) {
  const { t } = useI18n();
  const [items, setItems] = useState(initial);
  const [scheduling, setScheduling] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSchedule() {
    if (busy || !date || entries.length === 0) return;
    setBusy(true);
    try {
      const row = await scheduleExam(membershipId, date, entries);
      setItems((p) => [row, ...p]);
      setEntries([]);
      setDate('');
      setScheduling(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleGrade(id: string, status: ExamStatus, notes: string | null) {
    const row = await gradeExam(id, status, notes);
    setItems((p) => p.map((e) => (e.id === id ? row : e)));
  }

  async function handleDelete(id: string) {
    await deleteExam(id);
    setItems((p) => p.filter((e) => e.id !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      {!scheduling && (
        <button onClick={() => setScheduling(true)} className="btn btn-primary self-center" style={{ minHeight: 44 }}>
          {t('exam.schedule')}
        </button>
      )}
      {scheduling && (
        <div className="card flex flex-col gap-3" style={{ padding: '16px 18px', animation: 'fade-in-scale 0.2s var(--ease-out) both', transformOrigin: 'top' }}>
          <label className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('exam.date')}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" style={{ minHeight: 40 }} />
          </label>
          <ExamCoveragePicker onChange={setEntries} locale={locale} />
          <div className="flex gap-2">
            <button onClick={handleSchedule} disabled={busy || !date || entries.length === 0} className="btn btn-primary" style={{ minHeight: 44 }}>
              {t('exam.schedule')}
            </button>
            <button onClick={() => setScheduling(false)} className="btn btn-ghost" style={{ minHeight: 44 }}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      <SectionTitle>{t('exam.title')}</SectionTitle>
      {items.length === 0 && <EmptyState>{t('exam.noExams')}</EmptyState>}
      {items.map((exam) => (
        <ExamCard key={exam.id} exam={exam} locale={locale} onGrade={handleGrade} onDelete={handleDelete} />
      ))}
    </div>
  );
}

/**
 * Single-shape exam coverage picker (one of: a juz, a juz range, a surah with an
 * ayah range, or a consecutive surah range — never a mix). Emits the coverage as
 * an entries[] (a juz/surah range expands to consecutive entries) on every edit.
 */
function ExamCoveragePicker({
  onChange, locale,
}: {
  onChange: (e: Entry[]) => void;
  locale: 'en' | 'ar';
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'surah' | 'juz'>('surah');
  const [isRange, setIsRange] = useState(false);
  const [juz, setJuz] = useState(1);
  const [juzEnd, setJuzEnd] = useState(1);
  const [surah, setSurah] = useState(1);
  const [surahEnd, setSurahEnd] = useState(1);
  const max = AYAH_COUNTS[surah] ?? 1;
  const [startText, setStartText] = useState('1');
  const [endText, setEndText] = useState(String(max));
  const clampJuz = (n: number) => Math.max(1, Math.min(TOTAL_JUZ, n || 1));
  const coerce = (text: string, fallback: number) => {
    const n = Number(text);
    return text.trim() === '' || Number.isNaN(n) ? fallback : Math.max(1, Math.min(max, n));
  };

  // Recompute coverage → entries whenever any input changes.
  useEffect(() => {
    let entries: Entry[] = [];
    if (mode === 'juz') {
      const lo = isRange ? Math.min(juz, juzEnd) : juz, hi = isRange ? Math.max(juz, juzEnd) : juz;
      for (let j = lo; j <= hi; j++) entries.push({ kind: 'juz', juz: j });
    } else if (isRange) {
      const lo = Math.min(surah, surahEnd), hi = Math.max(surah, surahEnd);
      for (let s = lo; s <= hi; s++) entries.push({ kind: 'surah', surah: s, ayah_start: null, ayah_end: null });
    } else {
      const a = coerce(startText, 1), b = coerce(endText, max);
      const lo = Math.min(a, b), hi = Math.max(a, b);
      const whole = lo === 1 && hi === max;
      entries = [{ kind: 'surah', surah, ayah_start: whole ? null : lo, ayah_end: whole ? null : hi }];
    }
    onChange(entries);
    // onChange is a stable setState; other deps drive recompute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isRange, juz, juzEnd, surah, surahEnd, startText, endText]);

  const pickSurah = (s: number) => {
    setSurah(s);
    setStartText('1');
    setEndText(String(AYAH_COUNTS[s] ?? 1));
  };
  const fieldLabel = { color: 'var(--text-secondary)' } as const;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <SegmentedControl
            options={[
              { key: 'surah', label: t('homework.modeSurah'), icon: <Icon name="book" size={16} /> },
              { key: 'juz', label: t('homework.modeJuz'), icon: <Icon name="list" size={16} /> },
            ]}
            value={mode}
            onChange={(k) => { setMode(k as 'surah' | 'juz'); setIsRange(false); }}
          />
        </div>
        <button type="button" onClick={() => setIsRange((v) => !v)} aria-pressed={isRange}
                className={isRange ? 'btn btn-primary shrink-0' : 'btn btn-outline shrink-0'}
                style={{ minHeight: 40, fontSize: 13, padding: '0 16px' }}>
          {locale === 'ar' ? 'نطاق' : 'Range'}
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        {mode === 'juz' ? (isRange ? (<>
          <label className="flex flex-col gap-1.5" style={{ width: 90 }}>
            <span className="text-xs font-medium" style={fieldLabel}>{locale === 'ar' ? 'من جزء' : 'From juz'}</span>
            <input type="number" inputMode="numeric" min={1} max={TOTAL_JUZ} value={juz}
                   onChange={(e) => setJuz(clampJuz(Number(e.target.value)))} className="input" style={{ minHeight: 44, width: '100%' }} />
          </label>
          <label className="flex flex-col gap-1.5" style={{ width: 90 }}>
            <span className="text-xs font-medium" style={fieldLabel}>{locale === 'ar' ? 'إلى جزء' : 'To juz'}</span>
            <input type="number" inputMode="numeric" min={1} max={TOTAL_JUZ} value={juzEnd}
                   onChange={(e) => setJuzEnd(clampJuz(Number(e.target.value)))} className="input" style={{ minHeight: 44, width: '100%' }} />
          </label>
        </>) : (
          <label className="flex flex-col gap-1.5" style={{ width: 120 }}>
            <span className="text-xs font-medium" style={fieldLabel}>{t('homework.juz')}</span>
            <input type="number" inputMode="numeric" min={1} max={TOTAL_JUZ} value={juz}
                   onChange={(e) => setJuz(clampJuz(Number(e.target.value)))} className="input" style={{ minHeight: 44, width: '100%' }} />
          </label>
        )) : (isRange ? (<>
          <label className="flex flex-col gap-1.5 flex-1" style={{ minWidth: 160 }}>
            <span className="text-xs font-medium" style={fieldLabel}>{locale === 'ar' ? 'من سورة' : 'From surah'}</span>
            <SurahCombobox fluid value={surah} onChange={setSurah} locale={locale} placeholder={t('homework.searchSurah')} />
          </label>
          <label className="flex flex-col gap-1.5 flex-1" style={{ minWidth: 160 }}>
            <span className="text-xs font-medium" style={fieldLabel}>{locale === 'ar' ? 'إلى سورة' : 'To surah'}</span>
            <SurahCombobox fluid value={surahEnd} onChange={setSurahEnd} locale={locale} placeholder={t('homework.searchSurah')} />
          </label>
        </>) : (<>
          <label className="flex flex-col gap-1.5 flex-1" style={{ minWidth: 160 }}>
            <span className="text-xs font-medium" style={fieldLabel}>{t('homework.modeSurah')}</span>
            <SurahCombobox fluid value={surah} onChange={pickSurah} locale={locale} placeholder={t('homework.searchSurah')} />
          </label>
          <label className="flex flex-col gap-1.5" style={{ width: 76 }}>
            <span className="text-xs font-medium" style={fieldLabel}>{t('log.ayahFrom')}</span>
            <input type="number" inputMode="numeric" min={1} max={max} value={startText}
                   onChange={(e) => setStartText(e.target.value)}
                   onBlur={() => setStartText(String(coerce(startText, 1)))}
                   className="input" style={{ minHeight: 44, width: '100%' }} />
          </label>
          <label className="flex flex-col gap-1.5" style={{ width: 76 }}>
            <span className="text-xs font-medium" style={fieldLabel}>{t('log.ayahTo')}</span>
            <input type="number" inputMode="numeric" min={1} max={max} value={endText}
                   onChange={(e) => setEndText(e.target.value)}
                   onBlur={() => setEndText(String(coerce(endText, max)))}
                   className="input" style={{ minHeight: 44, width: '100%' }} />
          </label>
        </>))}
      </div>
    </div>
  );
}

/**
 * Human label for an exam's coverage. Renders the stored entries (mix of juz +
 * surah) in order, collapsing consecutive juz and consecutive whole surahs into
 * ranges ("Juz 1–3", "Al-Fatiha – Al-Baqarah") to avoid bloat. Legacy rows with
 * no entries fall back to the surah span derived from the page bounds.
 */
function examTarget(exam: Exam, locale: 'en' | 'ar', juzWord: string, fmtNum: (v: string | number) => string): string {
  if (!exam.entries || exam.entries.length === 0) {
    if (exam.surah) return getSurahName(exam.surah, locale);
    const first = getSurahForPage(exam.page_start);
    const last = getSurahForPage(exam.page_end);
    return first === last ? getSurahName(first, locale)
      : `${getSurahName(first, locale)} – ${getSurahName(last, locale)}`;
  }

  const es = exam.entries;
  const parts: string[] = [];
  let i = 0;
  while (i < es.length) {
    const e = es[i];
    if (e.kind === 'juz') {
      let j = i;
      while (j + 1 < es.length && es[j + 1].kind === 'juz'
             && (es[j + 1] as { juz: number }).juz === (es[j] as { juz: number }).juz + 1) j++;
      const lo = (es[i] as { juz: number }).juz, hi = (es[j] as { juz: number }).juz;
      parts.push(lo === hi ? `${juzWord} ${fmtNum(lo)}` : `${juzWord} ${fmtNum(lo)}–${fmtNum(hi)}`);
      i = j + 1;
    } else if (e.ayah_start == null) {
      // Run of consecutive whole surahs → collapse to a name range.
      let j = i;
      while (j + 1 < es.length && es[j + 1].kind === 'surah'
             && (es[j + 1] as { ayah_start: number | null }).ayah_start == null
             && (es[j + 1] as { surah: number }).surah === (es[j] as { surah: number }).surah + 1) j++;
      const lo = (es[i] as { surah: number }).surah, hi = (es[j] as { surah: number }).surah;
      parts.push(lo === hi ? getSurahName(lo, locale) : `${getSurahName(lo, locale)} – ${getSurahName(hi, locale)}`);
      i = j + 1;
    } else {
      parts.push(`${getSurahName(e.surah, locale)} ${fmtNum(e.ayah_start)}–${fmtNum(e.ayah_end!)}`);
      i++;
    }
  }
  return parts.join(locale === 'ar' ? '، ' : ', ');
}

/**
 * One exam as a flat card. Shared by teacher and student surfaces: pass
 * onGrade/onDelete for the teacher's editable view (inline notes + grade
 * controls); omit them for the student's read-only view (notes shown if present).
 */
export function ExamCard({
  exam, locale, onGrade, onDelete,
}: {
  exam: Exam;
  locale: 'en' | 'ar';
  onGrade?: (id: string, status: ExamStatus, notes: string | null) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const { t, fmtNum } = useI18n();
  const [notes, setNotes] = useState(exam.teacher_notes ?? '');
  const target = examTarget(exam, locale, t('homework.juz'), fmtNum);

  return (
    <div className="card flex flex-col gap-2" style={{ padding: '12px 16px' }}>
      <div className="flex items-center gap-3">
        <DateChip iso={exam.scheduled_date} locale={locale} />
        <span className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{target}</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {fmtNum(new Date(exam.scheduled_date).toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' }))}
          </span>
        </span>
        <span className="badge shrink-0" style={{ fontSize: 10, ...EXAM_STATUS_STYLE[exam.status] }}>{t(EXAM_STATUS_KEY[exam.status])}</span>
      </div>

      {onGrade ? (
        // Teacher: editable notes + grade controls.
        <div className="flex flex-col gap-2" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('exam.notes')} className="input input-sm" style={{ minHeight: 34 }} />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onGrade(exam.id, 'passed', notes || null)} className={exam.status === 'passed' ? 'btn btn-primary' : 'btn btn-outline'} style={{ minHeight: 36, fontSize: 13 }}>
              {t('exam.statusPassed')}
            </button>
            <button onClick={() => onGrade(exam.id, 'failed', notes || null)} className={exam.status === 'failed' ? 'btn btn-primary' : 'btn btn-outline'} style={{ minHeight: 36, fontSize: 13 }}>
              {t('exam.statusFailed')}
            </button>
            {exam.status !== 'scheduled' && (
              <button onClick={() => onGrade(exam.id, 'scheduled', notes || null)} className="btn btn-ghost" style={{ minHeight: 36, fontSize: 13 }}>
                {t('exam.statusScheduled')}
              </button>
            )}
            {onDelete && (
              <button onClick={() => onDelete(exam.id)} className="btn btn-ghost" style={{ minHeight: 36, fontSize: 13, color: 'var(--danger)', marginInlineStart: 'auto' }}>
                {t('common.delete')}
              </button>
            )}
          </div>
        </div>
      ) : (
        // Student: read-only teacher notes, when present.
        exam.teacher_notes && (
          <div className="text-xs" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8, color: 'var(--text-secondary)' }}>
            {exam.teacher_notes}
          </div>
        )
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
  const { t, fmtNum } = useI18n();
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
          {t(`logType.${l.log_type}`)} · p{fmtNum(l.page_start)}–{fmtNum(l.page_end)}
          {l.surah && l.ayah_start ? ` · ${fmtNum(l.surah)}:${fmtNum(l.ayah_start)}${l.ayah_end && l.ayah_end !== l.ayah_start ? `–${fmtNum(l.ayah_end)}` : ''}` : ''}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {!l.reviewed_at && <span className="badge" style={{ fontSize: 10, ...HOMEWORK_STATUS_STYLE.open }}>{t('grade.needsReview')}</span>}
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtNum(l.log_date)}</span>
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


'use client';

import { useMemo, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import type {
  Circle, Homework, LogType, Membership, ProgressLog, Recurrence, Session, StatusConfig,
} from '@/types';
import { createLog, deleteLog, type NewProgressLog } from '@/lib/services/progressLog';
import type { NoteWithAuthor } from '@/lib/services/membershipNotes';
import NotesThread from './NotesThread';
import {
  homeworkStatus, aggregateStatus, groupHomework, homeworkEntryLabel, homeworkTarget, type HomeworkStatus,
} from '@/lib/homework';
import { computeStreak, isStreakAtRisk } from '@/lib/streak';
import { sectionSessions, floatingNow } from '@/lib/recurrence';
import { getSurahForPage, getAyahsOnPage } from '@/lib/quran';
import { SectionTitle, EmptyState, StatCard, DateChip, NumberStepper, TabBar, PagedList, HOMEWORK_STATUS_STYLE, Icon } from './ui';

const LOG_TYPES: LogType[] = ['memorization', 'general_revision', 'targeted_revision'];
const today = () => new Date().toISOString().slice(0, 10);

const STATUS_KEY = {
  open: 'homework.statusOpen',
  completed: 'homework.statusCompleted',
  missed: 'homework.statusMissed',
} as const satisfies Record<HomeworkStatus, string>;

function fmtTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
}

/**
 * The student's own self-service view of a 1:1 membership (M6, D3/E2-E6/F1-F3/G2-G3).
 * Read-only on scheduling/attendance/prescriptions — RLS also enforces this; the
 * UI simply never renders teacher-only controls or other students.
 */
export default function StudentCircle({
  circle,
  membership,
  initialSessions,
  initialLogs,
  initialHomework,
  initialNotes,
}: {
  circle: Circle;
  membership: Membership;
  initialSessions: Session[];
  initialLogs: ProgressLog[];
  initialHomework: Homework[];
  initialNotes: NoteWithAuthor[];
}) {
  const { t, locale } = useI18n();
  const [logs, setLogs] = useState(initialLogs);
  const [tab, setTab] = useState('homework');

  const streak = useMemo(() => computeStreak(logs), [logs]);
  const atRisk = useMemo(() => isStreakAtRisk(logs), [logs]);
  const statuses = circle.student_statuses;

  // KPI row inputs: open homework count + next upcoming session.
  const openHomework = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of logs) if (l.homework_id) counts.set(l.homework_id, (counts.get(l.homework_id) ?? 0) + 1);
    const d = today();
    return initialHomework.filter((h) => homeworkStatus(h, counts.get(h.id) ?? 0, d) === 'open').length;
  }, [logs, initialHomework]);
  // Soonest future slot from the schedule rule + real rows, so weekly virtual
  // sessions surface here too (not just materialized rows).
  const nextSession = useMemo(() => {
    const fnow = floatingNow();
    const { next, upcoming } = sectionSessions(membership.schedule, initialSessions, fnow);
    return [next, ...upcoming]
      .filter((slot): slot is NonNullable<typeof slot> => !!slot)
      .filter((slot) => new Date(slot.scheduled_at).getTime() >= fnow.getTime())
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
  }, [membership.schedule, initialSessions]);

  function addLog(log: ProgressLog) {
    setLogs((prev) => [log, ...prev]);
  }

  async function handleDelete(id: string) {
    await deleteLog(id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      {/* KPI row: streak / open homework / next session */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<Icon name="flame" />} value={streak} label={t('log.streak')} />
        <StatCard icon={<Icon name="book" />} value={openHomework} label={t('homework.statusOpen')} />
        <StatCard
          icon={<Icon name="calendar" />}
          value={nextSession
            ? new Date(nextSession.scheduled_at).toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' })
            : '—'}
          label={t('sessions.next')}
        />
      </div>
      {atRisk && (
        <div
          className="card flex items-center gap-2" role="status"
          style={{ padding: '10px 14px', background: 'var(--danger-muted)', borderColor: 'var(--danger-muted)', color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}
        >
          <Icon name="alert" size={15} /> {t('log.streakAtRisk')}
        </div>
      )}

      {/* Feed (tabs) + always-on schedule sidebar; KPIs above stay pinned. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <TabBar
            tabs={[
              { key: 'homework', label: t('homework.title') },
              { key: 'log', label: t('log.tab') },
              { key: 'notes', label: t('notes.title') },
            ]}
            active={tab}
            onSelect={setTab}
          />

          {/* Assigned homework (E2/E3/E4/E6) */}
          {tab === 'homework' && (
            <AssignedHomework
              homework={initialHomework} logs={logs} statuses={statuses}
              membershipId={membership.id} onCreated={addLog}
            />
          )}

          {tab === 'log' && (<>
            {/* Open self-submission (F1/F2/F3) */}
            <div className="card flex flex-col gap-3" style={{ padding: '16px 18px' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('log.new')}</h2>
              <LogForm membershipId={membership.id} statuses={statuses} onCreated={addLog} />
            </div>

            {/* My logs */}
            <div className="flex flex-col gap-2">
              <SectionTitle trailing={<span className="badge badge-muted">{logs.length}</span>}>
                {t('log.mine')}
              </SectionTitle>
              {logs.length === 0 && <EmptyState>{t('log.empty')}</EmptyState>}
              <PagedList items={logs} loadMoreLabel={t('grade.loadMore')}
                render={(l) => <LogRow key={l.id} log={l} onDelete={handleDelete} />} />
            </div>
          </>)}

          {/* Own notes thread (G2/G3) */}
          {tab === 'notes' && <NotesThread membershipId={membership.id} initial={initialNotes} />}
        </div>

        {/* Schedule sidebar — always visible, read-only (D3) */}
        <aside className="lg:sticky lg:top-6 self-start min-w-0">
          <UpcomingSessions sessions={initialSessions} schedule={membership.schedule} />
        </aside>
      </div>
    </div>
  );
}

// --- Upcoming sessions (read-only, D3) ---------------------------------------

function UpcomingSessions({ sessions, schedule }: { sessions: Session[]; schedule: Recurrence | null }) {
  const { t, locale } = useI18n();
  const now = Date.now();

  // The weekly slots are virtual — render the RULE (one card per weekday, same
  // chip style as a session) rather than materialized rows; only ad-hocs list.
  const ruleDays = schedule?.weekdays.length
    ? [...schedule.weekdays].sort((a, b) => a - b)
    : null;
  // Wall-clock time interpreted as-if-UTC (mirrors the recurrence convention).
  const [hh, mm] = (schedule?.time ?? '00:00').split(':').map(Number);
  const timeShort = new Date(Date.UTC(2023, 0, 1, hh, mm)).toLocaleTimeString(locale, { hour: 'numeric', hour12: true, timeZone: 'UTC' });
  const timeFull = new Date(Date.UTC(2023, 0, 1, hh, mm)).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });
  // 2023-01-01 is a Sunday → index d lands on that weekday for name formatting.
  const dayDate = (d: number) => new Date(Date.UTC(2023, 0, 1 + d));

  // Only surface the NEXT ad-hoc (soonest upcoming) — the recurring rule covers
  // the rest; a one-off is the exception worth calling out.
  const nextAdhoc = sessions
    .filter((s) => s.is_adhoc && !s.canceled && new Date(s.scheduled_at).getTime() >= now)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];

  return (
    <div className="flex flex-col gap-3">
      {/* Recurring schedule — one card per weekday, reusing the session look */}
      <div className="flex flex-col gap-2">
        <SectionTitle>{t('sessions.schedule')}</SectionTitle>
        {ruleDays ? ruleDays.map((d) => (
          <div key={d} className="card flex items-center gap-3" style={{ padding: '10px 14px' }}>
            <span aria-hidden className="flex flex-col items-center justify-center shrink-0"
                  style={{ width: 46, height: 46, borderRadius: 'var(--radius-md)', background: 'var(--accent-muted)', color: 'var(--text-accent)' }}>
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', lineHeight: 1.4 }}>
                {dayDate(d).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.1 }}>{timeShort.replace(/\s/g, '')}</span>
            </span>
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {dayDate(d).toLocaleDateString(locale, { weekday: 'long', timeZone: 'UTC' })}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{timeFull}</span>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0" style={{ color: 'var(--text-muted)' }}>
              <path d="M17 2l4 4-4 4" />
              <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
              <path d="M7 22l-4-4 4-4" />
              <path d="M21 13v1a4 4 0 0 1-4 4H3" />
            </svg>
          </div>
        )) : (
          <EmptyState>{t('sessions.noSchedule')}</EmptyState>
        )}
      </div>

      {/* Next ad-hoc one-off session, if any */}
      {nextAdhoc && (
        <div className="flex flex-col gap-2">
          <SectionTitle>{t('sessions.adhocTitle')}</SectionTitle>
          <div className="card flex items-center gap-3" style={{ padding: '10px 14px' }}>
            <DateChip iso={nextAdhoc.scheduled_at} locale={locale} />
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {new Date(nextAdhoc.scheduled_at).toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {fmtTime(nextAdhoc.scheduled_at, locale)}
              </span>
            </div>
            <span className="badge shrink-0" style={{ fontSize: 10 }}>{t('sessions.adhoc')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Assigned homework (E2/E3/E4/E6) -----------------------------------------

function AssignedHomework({
  homework, logs, statuses, membershipId, onCreated,
}: {
  homework: Homework[];
  logs: ProgressLog[];
  statuses: StatusConfig[];
  membershipId: string;
  onCreated: (log: ProgressLog) => void;
}) {
  const { t } = useI18n();
  const linked = useMemo(() => {
    const m = new Map<string, ProgressLog[]>();
    for (const l of logs) {
      if (!l.homework_id) continue;
      const arr = m.get(l.homework_id) ?? [];
      arr.push(l);
      m.set(l.homework_id, arr);
    }
    return m;
  }, [logs]);

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle>{t('homework.assignedToYou')}</SectionTitle>
      {homework.length === 0 && <EmptyState>{t('log.empty')}</EmptyState>}
      <PagedList items={groupHomework(homework)} loadMoreLabel={t('grade.loadMore')}
        render={(group) => (
          <HomeworkCard
            key={group.key} items={group.items} linked={linked}
            statuses={statuses} membershipId={membershipId} onCreated={onCreated}
          />
        )} />
    </div>
  );
}

function HomeworkCard({
  items, linked, statuses, membershipId, onCreated,
}: {
  items: Homework[];
  linked: Map<string, ProgressLog[]>;
  statuses: StatusConfig[];
  membershipId: string;
  onCreated: (log: ProgressLog) => void;
}) {
  const { t, locale } = useI18n();
  const [attaching, setAttaching] = useState<string | null>(null); // per-entry (row) attach form
  const groupStatus = aggregateStatus(
    items.map((h) => homeworkStatus(h, (linked.get(h.id) ?? []).length, today())),
  );
  const first = items[0];

  return (
    <div className="card flex flex-col gap-2" style={{ padding: '12px 16px' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {`${t(first.type === 'memorization' ? 'homework.verbMemorize' : 'homework.verbReview')} ${homeworkTarget(items, locale, t('homework.juz'))}`}
        </span>
        <span className="badge" style={{ fontSize: 10, ...HOMEWORK_STATUS_STYLE[groupStatus] }}>{t(STATUS_KEY[groupStatus])}</span>
      </div>
      {first.instructions && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{first.instructions}</span>}
      {first.deadline && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('homework.deadline')}: {first.deadline}</span>
      )}

      {/* One entry (surah row) per line; linking + status stay per row (H4) */}
      {items.map((h) => {
        const linkedLogs = linked.get(h.id) ?? [];
        const open = homeworkStatus(h, linkedLogs.length, today()) === 'open';
        return (
          <div key={h.id} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }} className="flex flex-col gap-1">
            {items.length > 1 && (
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                {homeworkEntryLabel(h, locale, t('homework.juz')) ?? `${t('log.pageRange')} ${h.page_start}–${h.page_end}`}
                {h.surah && h.ayah_start == null ? ` ${t('homework.whole')}` : ''}
              </span>
            )}
            {linkedLogs.map((l) => (
              <div key={l.id} className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)', paddingInlineStart: 8 }}>
                <Icon name="check" size={13} /> p{l.page_start}–{l.page_end} · {l.log_date}
                {l.student_status ? ` · ${l.student_status}` : ''}
              </div>
            ))}
            {open ? (
              attaching === h.id ? (
                <LogForm
                  membershipId={membershipId} statuses={statuses}
                  homeworkId={h.id} lockedType={h.type}
                  initialPageStart={h.page_start} initialPageEnd={h.page_end}
                  onCreated={(log) => { onCreated(log); setAttaching(null); }}
                />
              ) : (
                <button onClick={() => setAttaching(h.id)} className="btn btn-outline self-start"
                        style={{ minHeight: 36, fontSize: 13 }}>
                  {t('homework.linkSubmission')}
                </button>
              )
            ) : (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('homework.statusLocked')}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Shared log form (open + homework-linked) --------------------------------

function LogForm({
  membershipId, statuses, onCreated, homeworkId = null, lockedType,
  initialPageStart = 1, initialPageEnd = 1,
}: {
  membershipId: string;
  statuses: StatusConfig[];
  onCreated: (log: ProgressLog) => void;
  homeworkId?: string | null;
  lockedType?: LogType;
  initialPageStart?: number;
  initialPageEnd?: number;
}) {
  const { t } = useI18n();
  // Prescribed homework has a scope the teacher already set — the student only
  // reports a status. Pages/ayahs are pickable only on a self-raised log.
  const hideRange = homeworkId != null;
  const [logType, setLogType] = useState<LogType>(lockedType ?? 'memorization');
  const [pageStart, setPageStart] = useState(initialPageStart);
  const [pageEnd, setPageEnd] = useState(initialPageEnd);
  const [status, setStatus] = useState(statuses[0]?.label ?? '');
  const [note, setNote] = useState('');
  const [logDate, setLogDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Optional ayah refinement (M1-7b). Surah derived from the start page; ayahs
  // bounded to those actually present on the logged range.
  const [refine, setRefine] = useState(false);
  const [ayahStart, setAyahStart] = useState(1);
  const [ayahEnd, setAyahEnd] = useState(1);
  const refineSurah = useMemo(() => getSurahForPage(pageStart), [pageStart]);
  const ayahOptions = useMemo(() => {
    const lo = Math.min(pageStart, pageEnd);
    const hi = Math.max(pageStart, pageEnd);
    const set = new Set<number>();
    for (let p = lo; p <= hi; p++) {
      for (const a of getAyahsOnPage(p)) if (a.surah === refineSurah) set.add(a.ayah);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [pageStart, pageEnd, refineSurah]);
  const effAyahStart = ayahOptions.includes(ayahStart) ? ayahStart : (ayahOptions[0] ?? 1);
  const effAyahEnd = ayahOptions.includes(ayahEnd) ? ayahEnd : (ayahOptions[ayahOptions.length - 1] ?? 1);

  async function handleSubmit() {
    if (busy || pageEnd < pageStart) return;
    setBusy(true);
    setError('');
    try {
      const payload: NewProgressLog = {
        membership_id: membershipId,
        homework_id: homeworkId,
        log_date: logDate,
        log_type: logType,
        page_start: pageStart,
        page_end: pageEnd,
        surah: refine ? refineSurah : null,
        ayah_start: refine ? Math.min(effAyahStart, effAyahEnd) : null,
        ayah_end: refine ? Math.max(effAyahStart, effAyahEnd) : null,
        student_status: status,
        student_notes: note || null,
      };
      const log = await createLog(payload);
      onCreated(log);
      setNote('');
    } catch (e) {
      // Surface the deadline hard-lock (E4) and any other rejection cleanly.
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Type — 3 fixed enum only (F3). Hidden when linked (the card already
          names the type); the locked value still flows through via `logType`. */}
      {!lockedType && (
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('log.type')}
          <select value={logType} onChange={(e) => setLogType(e.target.value as LogType)}
                  className="input input-sm" style={{ minHeight: 40 }}>
            {LOG_TYPES.map((lt) => <option key={lt} value={lt}>{t(`logType.${lt}`)}</option>)}
          </select>
        </label>
      )}

      <div className="flex items-end gap-2">
        {!hideRange && (<>
          <NumberStepper label={t('log.from')} value={pageStart} min={1} max={604} onChange={setPageStart} />
          <NumberStepper label={t('log.to')} value={pageEnd} min={1} max={604} onChange={setPageEnd} />
        </>)}
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('log.date')}
          <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)}
                 className="input input-sm" style={{ minHeight: 40 }} />
        </label>
      </div>

      {/* Optional ayah refinement — irrelevant for a whole-juz submission. */}
      {!hideRange && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={refine} onChange={(e) => setRefine(e.target.checked)} />
            {t('log.refineAyah')}
          </label>
          {refine && ayahOptions.length > 0 && (
            <div className="flex items-end gap-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)', paddingBottom: 10 }}>
                {t('log.surah')} {refineSurah}
              </span>
              <AyahSelect label={t('log.ayahFrom')} value={effAyahStart} options={ayahOptions} onChange={setAyahStart} />
              <AyahSelect label={t('log.ayahTo')} value={effAyahEnd} options={ayahOptions} onChange={setAyahEnd} />
            </div>
          )}
        </div>
      )}

      <ChipRow label={t('log.selfStatus')} options={statuses.map((s) => s.label)} value={status} onChange={setStatus} />

      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('log.note')} className="input" />

      {error && <span className="text-xs" style={{ color: 'var(--danger)' }}>{error}</span>}

      <button onClick={handleSubmit} disabled={busy || pageEnd < pageStart}
              className="btn btn-primary" style={{ minHeight: 44 }}>
        {t('log.submit')}
      </button>
    </div>
  );
}

// --- My-logs row -------------------------------------------------------------

function LogRow({ log: l, onDelete }: { log: ProgressLog; onDelete: (id: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="card" style={{ padding: '12px 16px' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {t(`logType.${l.log_type}`)} · p{l.page_start}–{l.page_end}
          {l.surah && l.ayah_start ? ` · ${l.surah}:${l.ayah_start}${l.ayah_end && l.ayah_end !== l.ayah_start ? `–${l.ayah_end}` : ''}` : ''}
          {l.homework_id && <span className="badge badge-muted" style={{ fontSize: 10, marginInlineStart: 6 }}>{t('homework.assignedToYou')}</span>}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{l.log_date}</span>
      </div>
      {l.student_status && <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{l.student_status}</div>}
      {l.reviewed_at ? (
        <div className="text-xs mt-1" style={{ color: 'var(--text-accent)' }}>
          {t('grade.reviewed')}{l.teacher_status ? `: ${l.teacher_status}` : ''}
          {l.teacher_comment ? ` — ${l.teacher_comment}` : ''}
        </div>
      ) : (
        <div className="flex gap-2 mt-2">
          <button onClick={() => onDelete(l.id)} className="btn btn-danger-ghost" style={{ minHeight: 36, fontSize: 13 }}>
            {t('common.delete')}
          </button>
        </div>
      )}
    </div>
  );
}

// --- Small inputs (reused from the old StudentHalaqah) -----------------------

function ChipRow({
  label, options, value, onChange,
}: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o} onClick={() => onChange(o)} className="badge" style={{
            cursor: 'pointer',
            background: value === o ? 'var(--accent)' : undefined,
            color: value === o ? '#fff' : undefined,
          }}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function AyahSelect({
  label, value, options, onChange,
}: {
  label: string; value: number; options: number[]; onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
      {label}
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}
              className="input input-sm" style={{ minHeight: 40 }}>
        {options.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
    </label>
  );
}


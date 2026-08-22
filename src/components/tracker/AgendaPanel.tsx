'use client';

/**
 * PRD 0014 — the Agenda tab (E1, E4–E10).
 *
 * Layout is: the Next-session card (passed in as `sessionCard`, so the Agenda tab
 * and the Sessions tab share one component rather than two copies), then the
 * teacher's private item list. The "waiting on you" block is M4 and lands below.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '@/components/I18nProvider';
import type { AgendaTask, Exam, Homework, ProgressLog, Session } from '@/types';
import { isStale, waitingOnYou } from '@/lib/agenda';
import { addItem, setDone, updateBody } from '@/lib/services/agenda';
import { ActionButton, SectionTitle, EmptyState, Chevron, Icon, vt, vtName } from './ui';

const DAY = 24 * 60 * 60_000;

/** Short day label for the attendance row ("Mon 21 Jul"). */
function fmtDay(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function AgendaPanel({
  membershipId, initial, sessionCard, context, onNavigate, hasSchedule,
}: {
  membershipId: string;
  /** Already sectioned by `listAgenda` — open oldest-first, then recent done. */
  initial: AgendaTask[];
  sessionCard?: ReactNode;
  /** H2: false + no session rows means there is no Next card to render at all. */
  hasSchedule?: boolean;
  /** Props the page already loaded; the waiting-on-you block derives from these (F7). */
  context?: { homework: Homework[]; logs: ProgressLog[]; sessions: Session[]; exams: Exam[] };
  /** Switches the parent's tab — the block links into the existing surfaces (F2). */
  onNavigate?: (tab: string) => void;
}) {
  const { t, fmtNum } = useI18n();
  const [items, setItems] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [showDone, setShowDone] = useState(false);
  // Client-side clock for the staleness treatment only (E7). Null until mounted
  // so the first render matches the server's.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const open = items.filter((i) => i.done_at === null);
  const done = items.filter((i) => i.done_at !== null);

  /** Tick, untick and dismiss are all this one call (C5/E10). Stays fire-and-
   *  forget: the optimistic move *is* the feedback, and the toggle is a 20px box
   *  with no room for a spinner. */
  function toggle(item: AgendaTask, next: boolean) {
    // Optimistic: strike it through now, reconcile with the stored row after (E5).
    vt(() => setItems((p) => p.map((i) => (i.id === item.id ? { ...i, done_at: next ? new Date().toISOString() : null } : i))));
    void setDone(item.id, next).then(
      (row) => setItems((p) => p.map((i) => (i.id === row.id ? row : i))),
      () => vt(() => setItems((p) => p.map((i) => (i.id === item.id ? item : i)))),
    );
  }

  async function submit() {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    setAdding(false);
    try {
      const row = await addItem(membershipId, body);
      vt(() => setItems((p) => [...p, row]));
    } catch {
      // Give the teacher their text back rather than swallowing it (E10).
      setDraft(body);
      setAdding(true);
    }
  }

  function save(item: AgendaTask, body: string) {
    if (body.trim() === item.body || !body.trim()) return;
    setItems((p) => p.map((i) => (i.id === item.id ? { ...i, body: body.trim() } : i)));
    // Same shape as toggle(): optimistic, roll back to the stored row on failure.
    void updateBody(item.id, body).catch(
      () => setItems((p) => p.map((i) => (i.id === item.id ? item : i))),
    );
  }

  // H2: no rule and no rows → there is no Next card, so a link to set one takes
  // its place. H3: with nothing anywhere that link IS the single empty state —
  // the agenda prompt and the waiting block both stand down rather than stacking.
  const noSessions = !hasSchedule && (context?.sessions.length ?? 0) === 0;
  const waiting = context && now ? waitingOnYou(context, now) : null;
  const allEmpty = noSessions && items.length === 0 && now !== null && !waiting;

  const scheduleLink = (
    <button
      onClick={() => onNavigate?.('sessions')} disabled={!onNavigate}
      className="card flex items-center gap-3 text-start"
      style={{ padding: '14px 16px', fontSize: 14, width: '100%', cursor: onNavigate ? 'pointer' : 'default' }}
    >
      <Icon name="calendar" size={15} />
      <span className="flex-1 min-w-0">{t('agenda.noSchedule')}</span>
      <Chevron />
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      {noSessions ? scheduleLink : sessionCard}

      <div className="flex flex-col gap-2">
        <SectionTitle>{t('agenda.title')}</SectionTitle>

        {open.length === 0 && !allEmpty && <EmptyState>{t('agenda.empty')}</EmptyState>}
        {open.map((item) => (
          <Row key={item.id} item={item} now={now} onToggle={toggle} onSave={save} />
        ))}

        {adding ? (
          <input
            autoFocus className="input" style={{ minHeight: 40 }}
            value={draft} placeholder={t('agenda.placeholder')}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
              if (e.key === 'Escape') { setDraft(''); setAdding(false); }
            }}
            onBlur={() => void submit()}
          />
        ) : (
          <button onClick={() => setAdding(true)} className="btn btn-ghost self-start"
                  style={{ minHeight: 36, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="plus" size={15} />
            {t('agenda.add')}
          </button>
        )}

        {done.length > 0 && (
          <div className="flex flex-col gap-2">
            <button onClick={() => setShowDone((v) => !v)} className="btn btn-ghost self-start"
                    style={{ minHeight: 32, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {t('agenda.done')} ({fmtNum(done.length)})
              <Chevron open={showDone} />
            </button>
            {showDone && done.map((item) => (
              <Row key={item.id} item={item} now={now} onToggle={toggle} onSave={save} />
            ))}
          </div>
        )}
      </div>

      {/* M4: derived from props already on the page — no fetch of its own (F7). */}
      {waiting && now && <WaitingBlock w={waiting} now={now} onNavigate={onNavigate} />}
    </div>
  );
}

/** "Waiting on you" (F1–F4). Renders nothing when there is nothing to do (F6). */
function WaitingBlock({
  w, now, onNavigate,
}: {
  w: NonNullable<ReturnType<typeof waitingOnYou>>;
  now: Date;
  onNavigate?: (tab: string) => void;
}) {
  const { t, fmtNum, locale } = useI18n();
  const examDays = w.exam
    ? Math.round((Date.parse(w.exam.scheduled_date) - Date.parse(now.toISOString().slice(0, 10))) / DAY)
    : 0;

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle>{t('waiting.title')}</SectionTitle>

      {w.dueHomework.length > 0 && (
        <WaitingRow icon="alert" warn onClick={onNavigate && (() => onNavigate('homework'))}>
          {t('waiting.homework', { n: fmtNum(w.dueHomework.length) })}
        </WaitingRow>
      )}

      {w.ungraded.length > 0 && (
        <WaitingRow icon="list" onClick={onNavigate && (() => onNavigate('homework'))}>
          {t('waiting.ungraded', { n: fmtNum(w.ungraded.length) })}
        </WaitingRow>
      )}

      {w.attendance && (
        <WaitingRow icon="check" warn onClick={onNavigate && (() => onNavigate('sessions'))}>
          {/* The date is part of the sentence: this is the most recent session that
              still has a real row, which is not always the one the teacher thinks
              of as "last" — a canceled slot in between is skipped. */}
          {t('waiting.attendanceUnmarked', { d: fmtDay(w.attendance.session.scheduled_at, locale) })}
        </WaitingRow>
      )}

      {w.exam && (
        <WaitingRow icon="cap" warn={examDays <= 0} onClick={onNavigate && (() => onNavigate('exams'))}>
          {examDays < 0 ? t('waiting.examOverdue')
            : examDays === 0 ? t('waiting.examToday')
            : t('waiting.exam', { n: fmtNum(examDays) })}
        </WaitingRow>
      )}
    </div>
  );
}

function WaitingRow({
  icon, warn, onClick, children,
}: {
  icon: 'alert' | 'list' | 'check' | 'cap';
  warn?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick} disabled={!onClick}
      className="card flex items-center gap-3 text-start"
      style={{
        padding: '10px 14px', fontSize: 14, width: '100%',
        cursor: onClick ? 'pointer' : 'default',
        color: warn ? 'var(--warning)' : 'var(--text-primary)',
      }}
    >
      <Icon name={icon} size={15} />
      <span className="flex-1 min-w-0">{children}</span>
    </button>
  );
}

/** One item: tick box, editable body, age, dismiss. */
function Row({
  item, now, onToggle, onSave,
}: {
  item: AgendaTask;
  now: Date | null;
  onToggle: (item: AgendaTask, next: boolean) => void;
  onSave: (item: AgendaTask, body: string) => void;
}) {
  const { t, fmtNum } = useI18n();
  const [editing, setEditing] = useState(false);
  const isDone = item.done_at !== null;
  const stale = !isDone && now !== null && isStale(item.created_at, now);
  const days = now ? Math.floor((now.getTime() - new Date(item.created_at).getTime()) / DAY) : 0;

  return (
    <div className="card flex items-center gap-3"
         style={{ padding: '10px 14px', opacity: isDone ? 0.6 : 1, viewTransitionName: vtName('agenda', item.id) }}>
      <ActionButton onClick={() => onToggle(item, !isDone)} aria-pressed={isDone} aria-label={t('agenda.toggle')}
              className="flex items-center justify-center shrink-0"
              style={{
                width: 20, height: 20, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                border: `1.5px solid ${isDone ? 'var(--accent)' : 'var(--border-default)'}`,
                background: isDone ? 'var(--accent)' : 'transparent',
                color: 'var(--accent-contrast)',
              }}>
        {isDone && <Icon name="check" size={13} />}
      </ActionButton>

      {editing ? (
        <input
          autoFocus className="input" style={{ minHeight: 34, flex: 1 }} defaultValue={item.body}
          onBlur={(e) => { onSave(item, e.target.value); setEditing(false); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <button onClick={() => setEditing(true)} className="text-start flex-1 min-w-0"
                style={{
                  background: 'transparent', border: 'none', padding: 0, cursor: 'text', fontSize: 14,
                  color: 'var(--text-primary)', textDecoration: isDone ? 'line-through' : undefined,
                }}>
          {item.body}
        </button>
      )}

      {!isDone && days > 0 && (
        <span className="text-xs shrink-0" style={{ color: stale ? 'var(--warning)' : 'var(--text-muted)', fontWeight: stale ? 600 : 400 }}>
          {t('agenda.ageDays', { n: fmtNum(days) })}
        </span>
      )}

      <ActionButton onClick={() => onToggle(item, true)} aria-label={t('agenda.dismiss')} className="btn btn-ghost shrink-0"
              style={{ minHeight: 26, minWidth: 26, padding: 0, fontSize: 14, color: 'var(--text-muted)' }}>
        ×
      </ActionButton>
    </div>
  );
}

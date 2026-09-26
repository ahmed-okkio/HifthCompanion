'use client';

import { useState, useEffect } from 'react';
import { useClientValue } from '@/hooks/useClientValue';
import { useNow } from '@/hooks/useNow';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';
import type { Circle, Membership, MemberWithProfile, Session } from '@/types';
import { displayName } from '@/lib/displayName';
import { rotateInviteCode, deleteCircle } from '@/lib/services/circle';
import { inviteByEmail, setMembershipStatus } from '@/lib/services/membership';
import { materializeSession, setSessionCanceled, rescheduleSession } from '@/lib/services/sessions';
import { assignSubstitutes, removeSubstitution, getManageSlots } from '@/lib/services/substitution';
import { ActionButton, SectionTitle, EmptyState, Avatar, Chevron, DateChip, StatusDot, TabBar, TimeSelect, vt, vtName } from './ui';
import { SubAssignForm, CoveredBy } from './subs';
import { isLive } from '@/lib/agenda';

// Stdlib formatter — time-of-day only; the DateChip carries the date.
function fmtTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

interface AgendaItem {
  key: string;
  membershipId: string;
  /** null until the virtual slot is materialized (on first cancel/reschedule). */
  sessionId: string | null;
  scheduled_at: string;
  isAdhoc: boolean;
  canceled: boolean;
  movedFrom: string | null;
  student: string;
  /** 0013 F5: sub name if this instant is already covered (server load). */
  substituteName?: string | null;
}

/**
 * Teacher's circle dashboard (D2/D5). Roster of 1:1 students (pending vs active).
 * Sessions live in the Manage-sessions tab, fetched a week at a time.
 */
export default function TeacherCircle({
  circle,
  teacher,
  initialStudents,
  nextSlots,
}: {
  circle: Circle;
  teacher?: MemberWithProfile;
  initialStudents: MemberWithProfile[];
  /** 0014 G1: each active student's next instant, computed server-side in one query (G3). */
  nextSlots?: Record<string, { scheduled_at: string; canceled: boolean }>;
}) {
  const { t, locale, fmtNum } = useI18n();
  const router = useRouter();
  const [code, setCode] = useState(circle.invite_code);
  const [copied, setCopied] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  // Origin resolved after mount to avoid an SSR/hydration mismatch on location.
  const origin = useClientValue(() => process.env.NEXT_PUBLIC_SITE_URL || location.origin, '');
  // 0014 G1: live is purely presentational and client-side — null until mounted
  // so the first render matches the server's.
  const now = useNow(30_000);
  const inviteLink = `${origin}/tracker/join/${code}`;
  const [students, setStudents] = useState(initialStudents);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('roster');
  const [reschedKey, setReschedKey] = useState<string | null>(null);
  const [reschedDate, setReschedDate] = useState('');
  const [reschedTime, setReschedTime] = useState('');
  // Lift overflow:hidden once the slide-down finishes so the clock popup isn't clipped.
  const [reschedOpen, setReschedOpen] = useState(false);

  // 0013 Substitutes. Multi-select of slot keys for the bulk assign (F1) plus
  // local sub-name overrides after an assign/reclaim so the covered-by badge
  // updates without a reload (undefined = server value, null = just reclaimed).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manageKey, setManageKey] = useState<string | null>(null);
  const [subOverride, setSubOverride] = useState<Record<string, string | null>>({});
  // Manage-sessions tab: pick the substitute FIRST (inline under the button),
  // then the checkboxes appear. selectMode is derived — no separate flag.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingSub, setPendingSub] = useState<{ userId: string; name: string } | null>(null);
  const selectMode = pendingSub !== null;
  // Manage-sessions paging: one week at a time. Recurring slots are virtual, so
  // a "page" is just a slice of the expansion — fetch one week past the current
  // one so the → arrow knows whether anything follows.
  const DAY_MS = 86400000;
  // Fixed at mount so week boundaries (and the label) don't drift between renders.
  const [weekAnchor] = useState(() => Date.now());
  const [manageWeek, setManageWeek] = useState(0);
  const [manageRows, setManageRows] = useState<AgendaItem[]>([]);
  const [hasNextWeek, setHasNextWeek] = useState(false);
  // Loading until the fetch for this week lands; leaving the tab forgets it (refetch on return).
  const weekKey = `${circle.id}:${manageWeek}`;
  const [loadedWeekKey, setLoadedWeekKey] = useState<string | null>(null);
  if (tab !== 'manage' && loadedWeekKey !== null) setLoadedWeekKey(null);
  const loadingWeek = loadedWeekKey !== weekKey;

  useEffect(() => {
    if (tab !== 'manage') return;
    let alive = true;
    getManageSlots(circle.id, (manageWeek + 2) * 7)
      .then((rows) => {
        if (!alive) return;
        // Slice relative to the mount anchor; the server list starts at "now".
        const start = weekAnchor + manageWeek * 7 * DAY_MS;
        const end = start + 7 * DAY_MS;
        const at = (r: AgendaItem) => new Date(r.scheduled_at).getTime();
        setManageRows(rows.filter((r) => at(r) >= start && at(r) < end));
        setHasNextWeek(rows.some((r) => at(r) >= end));
      })
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoadedWeekKey(weekKey));
    return () => { alive = false; };
  }, [tab, manageWeek, circle.id, weekAnchor, DAY_MS, weekKey]);

  const weekLabel = new Date(weekAnchor + manageWeek * 7 * DAY_MS)
    .toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  function exitSelectMode() {
    setPickerOpen(false);
    setPendingSub(null);
    setSelected(new Set());
  }
  const subName = (item: AgendaItem): string | null =>
    item.key in subOverride ? subOverride[item.key] : item.substituteName ?? null;

  function toggleSelected(key: string) {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  }

  // Every write below shows its result first and sends after: the outcome is
  // decided here, so the round trip only delays feedback the click already
  // earned. On failure the pre-click state goes back and the error surfaces.
  async function optimistic(apply: () => void, revert: () => void, write: () => Promise<unknown>) {
    vt(apply);
    try {
      await write();
    } catch (e) {
      vt(revert);
      setError((e as Error).message);
    }
  }

  // Bulk assign (F1): one substitution row per selected instant, same sub.
  async function handleBulkAssign() {
    if (!pendingSub) return;
    const { userId, name } = pendingSub;
    // Selection only ever happens in the Manage-sessions list.
    const items = manageRows.filter((a) => selected.has(a.key));
    const snapshot = subOverride;
    setSelected(new Set());
    await optimistic(
      () => setSubOverride((p) => ({ ...p, ...Object.fromEntries(items.map((i) => [i.key, name])) })),
      () => setSubOverride(snapshot),
      () => assignSubstitutes(items.map((i) => ({ membershipId: i.membershipId, scheduledAt: i.scheduled_at, substituteUserId: userId }))),
    );
  }

  // Manage-sub panel (F3) — set/replace the sub on exactly one instant.
  async function handleAssignOne(item: AgendaItem, userId: string, name: string) {
    const snapshot = subOverride;
    setManageKey(null);
    await optimistic(
      () => setSubOverride((p) => ({ ...p, [item.key]: name })),
      () => setSubOverride(snapshot),
      () => assignSubstitutes([{ membershipId: item.membershipId, scheduledAt: item.scheduled_at, substituteUserId: userId }]),
    );
  }

  // Reclaim (F4): delete exactly this instant's row. Clearing the sub and
  // leaving it empty is how the teacher takes the session back.
  async function handleReclaim(item: AgendaItem) {
    const snapshot = subOverride;
    await optimistic(
      () => setSubOverride((p) => ({ ...p, [item.key]: null })),
      () => setSubOverride(snapshot),
      () => removeSubstitution(item.membershipId, item.scheduled_at),
    );
  }

  // Real row for an agenda item, materializing the virtual slot on first touch.
  async function ensureSessionId(item: AgendaItem): Promise<string> {
    if (item.sessionId) return item.sessionId;
    const s = await materializeSession(item.membershipId, item.scheduled_at);
    setManageRows((p) => p.map((a) => (a.key === item.key ? { ...a, sessionId: s.id } : a)));
    return s.id;
  }

  async function handleCancelAgenda(item: AgendaItem) {
    const snapshot = manageRows;
    const canceled = !item.canceled;
    await optimistic(
      () => setManageRows((p) => p.map((a) => (a.key === item.key ? { ...a, canceled } : a))),
      () => setManageRows(snapshot),
      async () => setSessionCanceled(await ensureSessionId(item), canceled),
    );
  }

  function openReschedule(item: AgendaItem) {
    const d = new Date(item.scheduled_at);
    const pad = (n: number) => String(n).padStart(2, '0');
    setReschedDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    setReschedTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setReschedOpen(false);
    setReschedKey(item.key);
  }

  async function handleRescheduleAgenda(item: AgendaItem) {
    if (!reschedDate || !reschedTime) return;
    const snapshot = manageRows;
    const newIso = new Date(`${reschedDate}T${reschedTime}`).toISOString();
    const movedFrom = item.movedFrom ?? item.scheduled_at;
    setReschedKey(null);
    await optimistic(
      () => setManageRows((p) =>
        p.map((a) => (a.key === item.key ? { ...a, scheduled_at: newIso, movedFrom } : a))
          .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))),
      () => setManageRows(snapshot),
      async () => rescheduleSession(await ensureSessionId(item), newIso, movedFrom),
    );
  }
  // Invite panel lives in the desktop left column; on mobile it moves into Settings.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  async function handleRotate() {
    setCode(await rotateInviteCode(circle.id));
    setCopied(false);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleInvite() {
    if (!email.trim()) return;
    setError(null);
    try {
      const m = await inviteByEmail(circle.id, email);
      vt(() => setStudents((prev) => [...prev, m]));
      setEmail('');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('tracker.deleteCircleConfirm'))) return;
    setError(null);
    try {
      await deleteCircle(circle.id);
      router.push('/tracker');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Deactivate / reinstate — the new status is right there in the argument.
  async function handleStatus(id: string, status: Membership['status']) {
    const snapshot = students;
    await optimistic(
      () => setStudents((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m))),
      () => setStudents(snapshot),
      () => setMembershipStatus(id, status),
    );
  }

  // Invite panel — rendered in the left column on desktop, inside Settings on mobile.
  const invitePanel = (
    <div className="card flex flex-col gap-4 p-4">
      {/* One green CTA for the whole invite component — expands link + email. */}
      <button onClick={() => setInviteOpen((o) => !o)}
              className="btn btn-primary btn-lg flex items-center justify-center gap-2"
              aria-expanded={inviteOpen}>
        {t('tracker.invite')}
        <Chevron open={inviteOpen} color="currentColor" />
      </button>
      {/* CSS-only expand: grid-rows 0fr→1fr animates height with no JS measuring. */}
      <div className={`grid transition-all duration-250 ease-in-out ${inviteOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="flex flex-col gap-4 overflow-hidden min-h-0">
          <div className="flex flex-col gap-2 mt-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t('tracker.inviteLink')}
            </span>
            <code className="text-xs font-mono break-all text-green-600 bg-accent-muted py-3 px-3 rounded-md border border-dashed border-accent-border">
              {inviteLink}
            </code>
            <div className="flex gap-2">
              <ActionButton onClick={handleCopy} className="btn btn-outline flex-1">
                {t(copied ? 'common.copied' : 'common.copy')}
              </ActionButton>
              <ActionButton onClick={handleRotate} className="btn btn-ghost flex-1">
                {t('tracker.rotateCode')}
              </ActionButton>
            </div>
          </div>
          <div className="h-px bg-subtle" />
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t('tracker.inviteByEmail')}
            </span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
                   onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                   placeholder={t('tracker.inviteByEmail')} className="input" />
            <ActionButton onClick={handleInvite} disabled={!email.trim()} className="btn btn-outline">
              {t('common.create')}
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="card px-4 py-3 text-danger bg-danger-muted border-danger-muted text-small" role="alert">
          {error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)_280px] items-start">
        {/* Left: circle identity + KPIs (mirrors the student profile column) */}
        <aside className="flex flex-col gap-3 self-start">
          <div className="card flex flex-col items-center text-center gap-2 p-4">
            <Avatar seed={circle.name} size={64} />
            <h1 className="font-bold tracking-tight truncate max-w-full text-primary text-heading-m">
              {circle.name}
            </h1>
            {teacher && (
              <span className="text-xs truncate max-w-full text-muted">
                {t('tracker.roleTeacher')} · {displayName(teacher)}
              </span>
            )}
          </div>

          {/* Invite lives here on desktop; on mobile it moves into the Settings tab. */}
          {!isMobile && invitePanel}
        </aside>

        {/* Main column */}
        <div className="flex flex-col gap-6 min-w-0">
          <TabBar
            tabs={[
              { key: 'roster', label: t('tracker.roster') },
              { key: 'manage', label: t('subs.manageTitle') },
              { key: 'settings', label: t('common.settings') },
            ]}
            active={tab}
            onSelect={(k) => { if (k !== 'manage') exitSelectMode(); setTab(k); }}
          />

          {/* Roster + agenda share the main tab (sessions stay inline, not their own tab) */}
          {tab === 'roster' && (<>
          <div className="flex flex-col gap-2">
            <SectionTitle trailing={<span className="badge badge-muted">{fmtNum(students.length)}</span>}>
              {t('tracker.roster')}
            </SectionTitle>
            {students.length === 0 && <EmptyState>{t('tracker.noStudents')}</EmptyState>}
            <div className="grid gap-3 sm:grid-cols-2">
              {students.map((m) => {
                const active = m.status === 'active';
                // G1/G2: the indicator shows only inside the ±60min window, and only
                // for active students — the non-active status line below is the other
                // branch of the same slot, so the two treatments never both render.
                const slot = nextSlots?.[m.id];
                const live = active && slot && now && isLive(slot.scheduled_at, now, slot.canceled)
                  ? slot : null;
                const header = (
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar seed={displayName(m)} size={40} />
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <span className="text-sm font-semibold truncate text-primary">
                        {displayName(m)}
                      </span>
                      {/* Active is the default/expected state — no dot needed. Only flag
                          pending/blocked, which need teacher attention. */}
                      {live && (
                        <span className="flex items-center gap-1.5 text-xs text-green-600">
                          <StatusDot color="var(--accent)" />
                          {t('agenda.live')}
                          <span className="text-muted">
                            {fmtTime(live.scheduled_at, locale)}
                          </span>
                        </span>
                      )}
                      {m.status !== 'active' && (
                        <span className="flex items-center gap-1.5 text-xs text-muted">
                          <StatusDot color={m.status === 'pending' ? 'var(--warning)' : 'var(--text-muted)'} />
                          {t(`tracker.${m.status}`)}
                        </span>
                      )}
                    </div>
                  </div>
                );
                return (
                  <div key={m.id} className={`card flex flex-col gap-3 p-4${active ? '' : ' opacity-75'}`}
                       // eslint-disable-next-line shadcn/no-inline-styles -- per-member view-transition name
                       style={{ viewTransitionName: vtName('member', m.id) }}>
                    {active ? (
                      <Link href={`/tracker/${circle.id}/student/${m.id}`} className="flex items-center gap-2 min-w-0">
                        {header}
                        <Chevron />
                      </Link>
                    ) : (
                      // Pending: not clickable into data — teacher sees nothing until active (C1/S1).
                      header
                    )}
                    {/* Deactivate lives on the student's profile page (grey, confirm-gated)
                        to avoid accidental clicks. Roster only offers reactivate for blocked. */}
                    {m.status === 'blocked' && (
                      <>
                        <div className="h-px bg-subtle" />
                        <div className="flex gap-1">
                          <ActionButton onClick={() => handleStatus(m.id, 'active')} className="btn btn-outline btn-sm">
                            {t('tracker.reactivate')}
                          </ActionButton>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sessions themselves live in the Manage-sessions tab (reschedule,
              cancel, substitute) — the roster tab is roster only. */}
          </>)}

          {/* Manage sessions (F1) — bulk substitute assignment, gated behind the
              "Substitute teacher" button. Default: plain paginated list. */}
          {tab === 'manage' && (
            <div className="flex flex-col gap-2">
              {/* The button lives on the title row and morphs in place: its slot
                  animates wide and the email picker cross-fades in where it was. */}
              <div className="flex flex-wrap items-center gap-2">
                <SectionTitle>{t('subs.manageTitle')}</SectionTitle>
                <div className={`flex justify-end min-w-0 ms-auto transition-all duration-480 ease-out ${pickerOpen ? 'flex-auto max-w-105' : 'flex-none max-w-50'}`}>
                  {!pickerOpen ? (
                    <button onClick={() => setPickerOpen(true)} className="btn btn-primary btn-sm shrink-0 animate-fade-in-scale">
                      {t('subs.selectMode')}
                    </button>
                  ) : !pendingSub ? (
                    <div className="w-full animate-fade-in-scale">
                      <SubAssignForm autoFocus grow onAssign={(userId, name) => setPendingSub({ userId, name })} onCancel={exitSelectMode} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap justify-end w-full animate-fade-in-scale">
                      <span className="text-xs truncate text-secondary">
                        {t('subs.coveredBy', { name: pendingSub.name })} · {t('subs.selected', { count: selected.size })}
                      </span>
                      <ActionButton onClick={handleBulkAssign} disabled={selected.size === 0}
                              className="btn btn-primary btn-sm shrink-0">
                        {t('subs.confirmAssign')}
                      </ActionButton>
                      <button onClick={exitSelectMode} className="btn btn-ghost btn-sm shrink-0">
                        {t('common.cancel')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {manageRows.length === 0 ? (
                <EmptyState>{loadingWeek ? t('common.loading') : t('sessions.none')}</EmptyState>
              ) : (<>
                {manageRows.map((item) => {
                  const editing = reschedKey === item.key;
                  return (
                  <div key={item.key} className={`card flex flex-col gap-2 px-4 py-3${item.canceled ? ' opacity-50' : ''}`}>
                    {/* Wraps on narrow screens: the action group drops to its own
                        line instead of overflowing the card. */}
                    <div className="flex flex-wrap items-center gap-2">
                      {selectMode && !item.canceled && (
                        <input type="checkbox" checked={selected.has(item.key)} onChange={() => toggleSelected(item.key)}
                               aria-label={t('subs.assign')} className="size-4 accent-accent" />
                      )}
                      <DateChip iso={item.scheduled_at} locale={locale} />
                      <div className="flex flex-col gap-0.5 flex-1 min-w-35">
                        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-primary">
                          {item.student}
                          {item.movedFrom && <span className="badge badge-muted text-micro">{t('sessions.rescheduled')}</span>}
                          {item.canceled && <span className="badge badge-muted text-micro">{t('sessions.canceled')}</span>}
                        </span>
                        <span className="text-xs text-muted">{fmtTime(item.scheduled_at, locale)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 ms-auto">
                      {item.isAdhoc && <span className="badge shrink-0 text-micro">{t('sessions.adhoc')}</span>}
                      {/* One sub per instant: the chip IS the control — ✕ clears
                          it (the reclaim), and an empty row offers assign. */}
                      {!item.canceled && (subName(item) ? (
                        <CoveredBy name={subName(item)!} onRemove={() => handleReclaim(item)} />
                      ) : (
                        <button onClick={() => setManageKey(manageKey === item.key ? null : item.key)} className="btn btn-ghost btn-xs shrink-0">
                          {t('subs.assign')}
                          <Chevron open={manageKey === item.key} />
                        </button>
                      ))}
                      {!item.canceled && (
                        <button onClick={() => (editing ? setReschedKey(null) : openReschedule(item))} className="btn btn-ghost btn-xs shrink-0">
                          {t('sessions.reschedule')}
                          <Chevron open={editing} />
                        </button>
                      )}
                      <ActionButton onClick={() => handleCancelAgenda(item)} className="btn btn-ghost btn-xs shrink-0">
                        {item.canceled ? t('sessions.reinstate') : t('sessions.cancel')}
                      </ActionButton>
                      </div>
                    </div>
                    {manageKey === item.key && !item.canceled && !subName(item) && (
                      <div className="border-t border-subtle pt-2">
                        <SubAssignForm autoFocus onAssign={(uid, name) => handleAssignOne(item, uid, name)} onCancel={() => setManageKey(null)} />
                      </div>
                    )}
                    {editing && (
                      <div className={`flex gap-2 items-end flex-wrap border-t border-subtle animate-slide-down ${reschedOpen ? 'overflow-visible' : 'overflow-hidden'}`} onAnimationEnd={() => setReschedOpen(true)}>
                        <input type="date" value={reschedDate} onChange={(e) => setReschedDate(e.target.value)} className="input min-h-9" />
                        {/* eslint-disable-next-line shadcn/no-inline-styles -- TimeSelect exposes style, not className */}
                        <TimeSelect value={reschedTime} onChange={setReschedTime} style={{ minHeight: 36, width: 130 }} />
                        <ActionButton onClick={() => handleRescheduleAgenda(item)} className="btn btn-primary btn-sm">
                          {t('common.save')}
                        </ActionButton>
                        <button onClick={() => setReschedKey(null)} className="btn btn-ghost btn-sm">
                          {t('common.cancel')}
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })}
              </>)}

              {/* Week pager. Chevrons already mirror themselves in RTL, so prev
                  is always the leading arrow whichever way the page reads. */}
              <div className="flex items-center justify-center gap-3 mt-1">
                <button onClick={() => setManageWeek((w) => Math.max(0, w - 1))}
                        disabled={manageWeek === 0 || loadingWeek}
                        aria-label={t('subs.prevWeek')} className="btn btn-ghost btn-icon btn-sm">
                  <span className="flex rotate-180"><Chevron /></span>
                </button>
                <span className="text-xs text-muted min-w-24 text-center">
                  {loadingWeek ? t('common.loading') : t('subs.weekOf', { date: weekLabel })}
                </span>
                <button onClick={() => setManageWeek((w) => w + 1)}
                        disabled={!hasNextWeek || loadingWeek}
                        aria-label={t('subs.nextWeek')} className="btn btn-ghost btn-icon btn-sm">
                  <Chevron />
                </button>
              </div>
            </div>
          )}

          {tab === 'settings' && (<>
            {/* Mobile: invite panel joins Settings (it lives in the left column on desktop). */}
            {isMobile && invitePanel}
            <div className="card flex flex-col gap-3 p-4">
              <SectionTitle>{t('common.settings')}</SectionTitle>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-semibold text-primary">
                    {t('tracker.deleteCircle')}
                  </span>
                  <span className="text-xs text-muted">
                    {t('tracker.deleteCircleConfirm')}
                  </span>
                </div>
                <ActionButton onClick={handleDelete} className="btn btn-danger-ghost btn-sm shrink-0">
                  {t('tracker.deleteCircle')}
                </ActionButton>
              </div>
            </div>
          </>)}
        </div>

        {/* Empty right spacer mirrors the student-detail layout so the middle
            column has the same width across both teacher screens. */}
        <div className="hidden lg:block" aria-hidden />
      </div>

    </div>
  );
}

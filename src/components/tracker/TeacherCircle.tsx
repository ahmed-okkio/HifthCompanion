'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';
import type { Circle, Membership, MemberWithProfile, Session } from '@/types';
import { displayName } from '@/lib/displayName';
import { rotateInviteCode, deleteCircle } from '@/lib/services/circle';
import { inviteByEmail, setMembershipStatus } from '@/lib/services/membership';
import { materializeSession, setSessionCanceled, rescheduleSession } from '@/lib/services/sessions';
import { assignSubstitutes, removeSubstitution, getManageSlots } from '@/lib/services/substitution';
import { SectionTitle, EmptyState, Avatar, Chevron, DateChip, StatusDot, TabBar, TimeSelect } from './ui';
import { SubAssignForm, CoveredBy } from './subs';

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
}: {
  circle: Circle;
  teacher?: MemberWithProfile;
  initialStudents: MemberWithProfile[];
}) {
  const { t, locale, fmtNum } = useI18n();
  const router = useRouter();
  const [code, setCode] = useState(circle.invite_code);
  const [copied, setCopied] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  // Origin resolved after mount to avoid an SSR/hydration mismatch on location.
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(process.env.NEXT_PUBLIC_SITE_URL || location.origin), []);
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
  const [loadingWeek, setLoadingWeek] = useState(false);

  useEffect(() => {
    if (tab !== 'manage') return;
    let alive = true;
    setLoadingWeek(true);
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
      .finally(() => alive && setLoadingWeek(false));
    return () => { alive = false; };
  }, [tab, manageWeek, circle.id, weekAnchor, DAY_MS]);

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

  // Bulk assign (F1): one substitution row per selected instant, same sub.
  async function handleBulkAssign() {
    if (!pendingSub) return;
    const { userId, name } = pendingSub;
    // Selection only ever happens in the Manage-sessions list.
    const items = manageRows.filter((a) => selected.has(a.key));
    try {
      await assignSubstitutes(items.map((i) => ({ membershipId: i.membershipId, scheduledAt: i.scheduled_at, substituteUserId: userId })));
      setSubOverride((p) => ({ ...p, ...Object.fromEntries(items.map((i) => [i.key, name])) }));
      setSelected(new Set());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Manage-sub panel (F3) — set/replace the sub on exactly one instant.
  async function handleAssignOne(item: AgendaItem, userId: string, name: string) {
    await assignSubstitutes([{ membershipId: item.membershipId, scheduledAt: item.scheduled_at, substituteUserId: userId }]);
    setSubOverride((p) => ({ ...p, [item.key]: name }));
    setManageKey(null);
  }

  // Reclaim (F4): delete exactly this instant's row. Clearing the sub and
  // leaving it empty is how the teacher takes the session back.
  async function handleReclaim(item: AgendaItem) {
    try {
      await removeSubstitution(item.membershipId, item.scheduled_at);
      setSubOverride((p) => ({ ...p, [item.key]: null }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Real row for an agenda item, materializing the virtual slot on first touch.
  async function ensureSessionId(item: AgendaItem): Promise<string> {
    if (item.sessionId) return item.sessionId;
    const s = await materializeSession(item.membershipId, item.scheduled_at);
    setManageRows((p) => p.map((a) => (a.key === item.key ? { ...a, sessionId: s.id } : a)));
    return s.id;
  }

  async function handleCancelAgenda(item: AgendaItem) {
    try {
      const id = await ensureSessionId(item);
      await setSessionCanceled(id, !item.canceled);
      setManageRows((p) => p.map((a) => (a.key === item.key ? { ...a, canceled: !item.canceled } : a)));
    } catch (e) {
      setError((e as Error).message);
    }
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
    try {
      const id = await ensureSessionId(item);
      const newIso = new Date(`${reschedDate}T${reschedTime}`).toISOString();
      const movedFrom = item.movedFrom ?? item.scheduled_at;
      await rescheduleSession(id, newIso, movedFrom);
      setManageRows((p) =>
        p.map((a) => (a.key === item.key ? { ...a, scheduled_at: newIso, movedFrom } : a))
          .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)));
      setReschedKey(null);
    } catch (e) {
      setError((e as Error).message);
    }
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
      setStudents((prev) => [...prev, m]);
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

  async function handleStatus(id: string, status: Membership['status']) {
    await setMembershipStatus(id, status);
    setStudents((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
  }

  // Invite panel — rendered in the left column on desktop, inside Settings on mobile.
  const invitePanel = (
    <div className="card flex flex-col gap-4" style={{ padding: '18px' }}>
      {/* One green CTA for the whole invite component — expands link + email. */}
      <button onClick={() => setInviteOpen((o) => !o)}
              className="btn btn-primary flex items-center justify-center gap-2"
              style={{ minHeight: 44 }} aria-expanded={inviteOpen}>
        {t('tracker.invite')}
        <Chevron open={inviteOpen} color="currentColor" />
      </button>
      {/* CSS-only expand: grid-rows 0fr→1fr animates height with no JS measuring. */}
      <div style={{ display: 'grid', gridTemplateRows: inviteOpen ? '1fr' : '0fr', transition: 'grid-template-rows 0.25s ease' }}>
        <div className="flex flex-col gap-4" style={{ overflow: 'hidden', minHeight: 0 }}>
          <div className="flex flex-col gap-2" style={{ marginTop: 4 }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {t('tracker.inviteLink')}
            </span>
            <code className="text-xs font-mono break-all"
                  style={{ color: 'var(--text-accent)', background: 'var(--accent-muted)', padding: '12px 10px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-accent)' }}>
              {inviteLink}
            </code>
            <div className="flex gap-2">
              <button onClick={handleCopy} className="btn btn-outline flex-1" style={{ minHeight: 38, fontSize: 13 }}>
                {t(copied ? 'common.copied' : 'common.copy')}
              </button>
              <button onClick={handleRotate} className="btn btn-ghost flex-1" style={{ minHeight: 38, fontSize: 13 }}>
                {t('tracker.rotateCode')}
              </button>
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--border-subtle)' }} />
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {t('tracker.inviteByEmail')}
            </span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
                   onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                   placeholder={t('tracker.inviteByEmail')} className="input" />
            <button onClick={handleInvite} disabled={!email.trim()} className="btn btn-outline" style={{ minHeight: 40 }}>
              {t('common.create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="card" role="alert"
             style={{ padding: '10px 14px', color: 'var(--danger)', background: 'var(--danger-muted)', borderColor: 'var(--danger-muted)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)_280px] items-start">
        {/* Left: circle identity + KPIs (mirrors the student profile column) */}
        <aside className="flex flex-col gap-3 self-start">
          <div className="card flex flex-col items-center text-center gap-2" style={{ padding: '22px' }}>
            <Avatar seed={circle.name} size={64} />
            <h1 className="font-bold tracking-tight truncate max-w-full"
                style={{ color: 'var(--text-primary)', fontSize: 'var(--type-heading-m-size)' }}>
              {circle.name}
            </h1>
            {teacher && (
              <span className="text-xs truncate max-w-full" style={{ color: 'var(--text-muted)' }}>
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
                const header = (
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar seed={displayName(m)} size={40} />
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {displayName(m)}
                      </span>
                      {/* Active is the default/expected state — no dot needed. Only flag
                          pending/blocked, which need teacher attention. */}
                      {m.status !== 'active' && (
                        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          <StatusDot color={m.status === 'pending' ? 'var(--warning)' : 'var(--text-muted)'} />
                          {t(`tracker.${m.status}`)}
                        </span>
                      )}
                    </div>
                  </div>
                );
                return (
                  <div key={m.id} className="card flex flex-col gap-3"
                       style={{ padding: '14px 16px', opacity: active ? 1 : 0.75 }}>
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
                        <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                        <div className="flex gap-1">
                          <button onClick={() => handleStatus(m.id, 'active')} className="btn btn-outline" style={{ minHeight: 32, fontSize: 12, padding: '4px 10px' }}>
                            {t('tracker.reactivate')}
                          </button>
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
              <div className="flex items-center gap-2">
                <SectionTitle>{t('subs.manageTitle')}</SectionTitle>
                <div className="flex justify-end min-w-0"
                     style={{ marginInlineStart: 'auto', flex: pickerOpen ? '1 1 auto' : '0 0 auto', maxWidth: pickerOpen ? 420 : 200, transition: 'max-width 480ms cubic-bezier(.22,1,.36,1), flex-basis 480ms cubic-bezier(.22,1,.36,1)' }}>
                  {!pickerOpen ? (
                    <button onClick={() => setPickerOpen(true)} className="btn btn-primary shrink-0"
                            style={{ minHeight: 34, fontSize: 12, padding: '0 14px', animation: 'fade-in-scale 200ms ease' }}>
                      {t('subs.selectMode')}
                    </button>
                  ) : !pendingSub ? (
                    <div className="w-full" style={{ animation: 'fade-in-scale 420ms ease' }}>
                      <SubAssignForm autoFocus grow onAssign={(userId, name) => setPendingSub({ userId, name })} onCancel={exitSelectMode} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap justify-end w-full" style={{ animation: 'fade-in-scale 240ms ease' }}>
                      <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                        {t('subs.coveredBy', { name: pendingSub.name })} · {t('subs.selected', { count: selected.size })}
                      </span>
                      <button onClick={handleBulkAssign} disabled={selected.size === 0}
                              className="btn btn-primary shrink-0" style={{ minHeight: 32, fontSize: 12, padding: '0 14px' }}>
                        {t('subs.confirmAssign')}
                      </button>
                      <button onClick={exitSelectMode} className="btn btn-ghost shrink-0" style={{ minHeight: 32, fontSize: 12 }}>
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
                  <div key={item.key} className="card flex flex-col gap-2" style={{ padding: '10px 14px', opacity: item.canceled ? 0.5 : 1 }}>
                    <div className="flex items-center gap-3">
                      {selectMode && !item.canceled && (
                        <input type="checkbox" checked={selected.has(item.key)} onChange={() => toggleSelected(item.key)}
                               aria-label={t('subs.assign')} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                      )}
                      <DateChip iso={item.scheduled_at} locale={locale} />
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {item.student}
                          {item.movedFrom && <span className="badge badge-muted" style={{ fontSize: 10 }}>{t('sessions.rescheduled')}</span>}
                          {item.canceled && <span className="badge badge-muted" style={{ fontSize: 10 }}>{t('sessions.canceled')}</span>}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtTime(item.scheduled_at, locale)}</span>
                      </div>
                      {item.isAdhoc && <span className="badge shrink-0" style={{ fontSize: 10 }}>{t('sessions.adhoc')}</span>}
                      {/* One sub per instant: the chip IS the control — ✕ clears
                          it (the reclaim), and an empty row offers assign. */}
                      {!item.canceled && (subName(item) ? (
                        <CoveredBy name={subName(item)!} onRemove={() => handleReclaim(item)} />
                      ) : (
                        <button onClick={() => setManageKey(manageKey === item.key ? null : item.key)} className="btn btn-ghost shrink-0" style={{ minHeight: 30, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          {t('subs.assign')}
                          <Chevron open={manageKey === item.key} />
                        </button>
                      ))}
                      {!item.canceled && (
                        <button onClick={() => (editing ? setReschedKey(null) : openReschedule(item))} className="btn btn-ghost shrink-0" style={{ minHeight: 30, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          {t('sessions.reschedule')}
                          <Chevron open={editing} />
                        </button>
                      )}
                      <button onClick={() => handleCancelAgenda(item)} className="btn btn-ghost shrink-0" style={{ minHeight: 30, fontSize: 11 }}>
                        {item.canceled ? t('sessions.reinstate') : t('sessions.cancel')}
                      </button>
                    </div>
                    {manageKey === item.key && !item.canceled && !subName(item) && (
                      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                        <SubAssignForm autoFocus onAssign={(uid, name) => handleAssignOne(item, uid, name)} onCancel={() => setManageKey(null)} />
                      </div>
                    )}
                    {editing && (
                      <div className="flex gap-2 items-end flex-wrap" onAnimationEnd={() => setReschedOpen(true)}
                           style={{ borderTop: '1px solid var(--border-subtle)', overflow: reschedOpen ? 'visible' : 'hidden', animation: 'slide-down 0.22s var(--ease-out) both' }}>
                        <input type="date" value={reschedDate} onChange={(e) => setReschedDate(e.target.value)} className="input" style={{ minHeight: 36 }} />
                        <TimeSelect value={reschedTime} onChange={setReschedTime} style={{ minHeight: 36, width: 130 }} />
                        <button onClick={() => handleRescheduleAgenda(item)} className="btn btn-primary" style={{ minHeight: 36, fontSize: 12, padding: '0 14px' }}>
                          {t('common.save')}
                        </button>
                        <button onClick={() => setReschedKey(null)} className="btn btn-ghost" style={{ minHeight: 36, fontSize: 12 }}>
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
              <div className="flex items-center justify-center gap-3" style={{ marginTop: 4 }}>
                <button onClick={() => setManageWeek((w) => Math.max(0, w - 1))}
                        disabled={manageWeek === 0 || loadingWeek}
                        aria-label={t('subs.prevWeek')} className="btn btn-ghost"
                        style={{ minHeight: 34, padding: '0 12px' }}>
                  <span className="flex rotate-180"><Chevron /></span>
                </button>
                <span className="text-xs" style={{ color: 'var(--text-muted)', minWidth: 90, textAlign: 'center' }}>
                  {loadingWeek ? t('common.loading') : t('subs.weekOf', { date: weekLabel })}
                </span>
                <button onClick={() => setManageWeek((w) => w + 1)}
                        disabled={!hasNextWeek || loadingWeek}
                        aria-label={t('subs.nextWeek')} className="btn btn-ghost"
                        style={{ minHeight: 34, padding: '0 12px' }}>
                  <Chevron />
                </button>
              </div>
            </div>
          )}

          {tab === 'settings' && (<>
            {/* Mobile: invite panel joins Settings (it lives in the left column on desktop). */}
            {isMobile && invitePanel}
            <div className="card flex flex-col gap-3" style={{ padding: '18px 20px' }}>
              <SectionTitle>{t('common.settings')}</SectionTitle>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {t('tracker.deleteCircle')}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {t('tracker.deleteCircleConfirm')}
                  </span>
                </div>
                <button onClick={handleDelete} className="btn btn-danger-ghost shrink-0" style={{ minHeight: 34, fontSize: 13 }}>
                  {t('tracker.deleteCircle')}
                </button>
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

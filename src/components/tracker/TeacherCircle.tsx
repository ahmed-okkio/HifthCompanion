'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';
import type { Circle, Membership, MemberWithProfile, Session } from '@/types';
import { displayName } from '@/lib/displayName';
import { rotateInviteCode, deleteCircle } from '@/lib/services/circle';
import { inviteByEmail, setMembershipStatus } from '@/lib/services/membership';
import { SectionTitle, EmptyState, Avatar, Chevron, StatCard, DateChip, StatusDot, Icon } from './ui';

// Stdlib formatter — time-of-day only; the DateChip carries the date.
function fmtTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Teacher's circle dashboard (D2/D5). Roster of 1:1 students (pending vs active)
 * plus the aggregate agenda of every active student's upcoming sessions.
 */
export default function TeacherCircle({
  circle,
  teacher,
  initialStudents,
  agenda,
}: {
  circle: Circle;
  teacher?: MemberWithProfile;
  initialStudents: MemberWithProfile[];
  // Upcoming sessions across all active students, each already labeled server-side.
  agenda: { key: string; scheduled_at: string; isAdhoc: boolean; student: string }[];
}) {
  const { t, locale, fmtNum } = useI18n();
  const router = useRouter();
  const [code, setCode] = useState(circle.invite_code);
  const [copied, setCopied] = useState(false);
  const [students, setStudents] = useState(initialStudents);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const activeCount = students.filter((m) => m.status === 'active').length;
  const pendingCount = students.filter((m) => m.status === 'pending').length;

  async function handleRotate() {
    setCode(await rotateInviteCode(circle.id));
    setCopied(false);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
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

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="card" role="alert"
             style={{ padding: '10px 14px', color: 'var(--danger)', background: 'var(--danger-muted)', borderColor: 'var(--danger-muted)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Hero */}
      <div className="card flex items-center gap-4" style={{ padding: '20px 22px' }}>
        <Avatar seed={circle.name} size={52} />
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <h1 className="font-bold tracking-tight truncate"
              style={{ color: 'var(--text-primary)', fontSize: 'var(--type-heading-m-size)' }}>
            {circle.name}
          </h1>
          {teacher && (
            <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {t('tracker.roleTeacher')} · {displayName(teacher)}
            </span>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<Icon name="users" />} value={fmtNum(activeCount)} label={t('tracker.active')} />
        <StatCard icon={<Icon name="hourglass" />} value={fmtNum(pendingCount)} label={t('tracker.pending')} />
        <StatCard icon={<Icon name="calendar" />} value={fmtNum(agenda.length)} label={t('sessions.title')} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        {/* Main column */}
        <div className="flex flex-col gap-6 min-w-0">
          {/* Roster (D-consent: pending vs active, C1/C5) */}
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

          {/* Aggregate agenda (D2/D5) */}
          <div className="flex flex-col gap-2">
            <SectionTitle>{t('sessions.title')}</SectionTitle>
            {agenda.length === 0 ? (
              <EmptyState>{t('sessions.none')}</EmptyState>
            ) : (
              agenda.map(({ key, scheduled_at, isAdhoc, student }) => (
                <div key={key} className="card flex items-center gap-3" style={{ padding: '10px 14px' }}>
                  <DateChip iso={scheduled_at} locale={locale} />
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {student}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {fmtTime(scheduled_at, locale)}
                    </span>
                  </div>
                  {isAdhoc && <span className="badge shrink-0" style={{ fontSize: 10 }}>{t('sessions.adhoc')}</span>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar: invite */}
        <aside className="card flex flex-col gap-4" style={{ padding: '18px' }}>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {t('tracker.inviteCode')}
            </span>
            <code className="text-base font-mono font-bold text-center"
                  style={{ color: 'var(--text-accent)', letterSpacing: '0.18em', background: 'var(--accent-muted)', padding: '12px 10px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-accent)' }}>
              {code}
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
            <button onClick={handleInvite} disabled={!email.trim()} className="btn btn-primary" style={{ minHeight: 40 }}>
              {t('common.create')}
            </button>
          </div>
          <div style={{ height: 1, background: 'var(--border-subtle)' }} />
          <button onClick={handleDelete} className="btn btn-danger-ghost" style={{ minHeight: 38, fontSize: 13 }}>
            {t('tracker.deleteCircle')}
          </button>
        </aside>
      </div>
    </div>
  );
}

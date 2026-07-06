'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';
import type { MembershipWithCircle } from '@/lib/services/membership';
import { createCircle, getCircleByCode } from '@/lib/services/circle';
import { joinCircle } from '@/lib/services/membership';
import PushToggle from '@/components/PushToggle';
import { PageHeader, SectionTitle, EmptyState, Avatar, Chevron, Icon } from './ui';

export default function TrackerHome({
  initialMemberships,
}: {
  initialMemberships: MembershipWithCircle[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [memberships, setMemberships] = useState(initialMemberships);
  const [newName, setNewName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const teaching = memberships.filter((m) => m.role === 'teacher' && m.status === 'active');
  const enrolled = memberships.filter((m) => m.role === 'student' && m.status === 'active');
  // Pending invites (email or a joined-but-unaccepted code): land on the accept screen.
  const pending = memberships.filter((m) => m.role === 'student' && m.status === 'pending');

  async function handleCreate() {
    if (!newName.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const h = await createCircle(newName);
      // Reflect the new teacher membership locally.
      setMemberships((prev) => [
        {
          id: `local-${h.id}`,
          circle_id: h.id,
          user_id: '',
          role: 'teacher',
          schedule: null,
          status: 'active',
          joined_at: new Date().toISOString(),
          circle: h,
        },
        ...prev,
      ]);
      setNewName('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Accept either a raw code or a full invite link (…/tracker/join/<code>).
      const raw = code.includes('/join/') ? code.split('/join/').pop()! : code;
      const parsed = raw.split(/[/?#]/)[0].trim();
      const h = await getCircleByCode(parsed);
      if (!h) throw new Error('No circle with that code');
      await joinCircle(h.id); // lands as 'pending' — consent gate (C4)
      setCode('');
      router.push(`/tracker/${h.id}`); // → accept screen, not a silent active join
      return;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const empty = teaching.length === 0 && enrolled.length === 0 && pending.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('tracker.title')} subtitle={t('tracker.subtitle')} />

      {error && (
        <div
          className="card"
          role="alert"
          style={{
            padding: '10px 14px',
            color: 'var(--danger)',
            background: 'var(--danger-muted)',
            borderColor: 'var(--danger-muted)',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Create + join actions — two side-by-side cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ActionCard icon={<Icon name="circle-people" size={16} />} label={t('tracker.createCircle')}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder={t('tracker.createCircleHint')}
            className="input"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button onClick={handleCreate} disabled={!newName.trim() || busy}
                  className="btn btn-primary" style={{ flexShrink: 0, minHeight: 44 }}>
            {t('common.create')}
          </button>
        </ActionCard>

        <ActionCard icon={<Icon name="key" size={16} />} label={t('tracker.joinCircle')}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder={t('tracker.inviteCode')}
            className="input"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button onClick={handleJoin} disabled={!code.trim() || busy}
                  className="btn btn-outline" style={{ flexShrink: 0, minHeight: 44 }}>
            {t('common.join')}
          </button>
        </ActionCard>
      </div>

      {empty && (
        <EmptyState>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{t('tracker.emptyTitle')}</span>
          <span>{t('tracker.emptyHint')}</span>
        </EmptyState>
      )}

      <Section title={t('accept.title')} memberships={pending} hrefBase="/tracker" />
      <Section title={t('tracker.teaching')} memberships={teaching} hrefBase="/tracker" />
      <Section title={t('tracker.enrolled')} memberships={enrolled} hrefBase="/tracker" />

      {/* M4-3: opt into web push. Renders nothing on unsupported browsers or
          when NEXT_PUBLIC_VAPID_PUBLIC_KEY is unset. */}
      <PushToggle />
    </div>
  );
}

/** Icon + label header over an input + button row; one card per action. */
function ActionCard({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="card flex flex-col gap-3" style={{ padding: '16px 18px' }}>
      <span className="flex items-center gap-2">
        <span aria-hidden className="flex items-center justify-center shrink-0"
              style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--accent-muted)', fontSize: 15 }}>
          {icon}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
      </span>
      <div className="flex gap-2 items-center">{children}</div>
    </label>
  );
}

function Section({
  title,
  memberships,
  hrefBase,
}: {
  title: string;
  memberships: MembershipWithCircle[];
  hrefBase: string;
}) {
  const { t, fmtNum } = useI18n();
  if (memberships.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <SectionTitle trailing={<span className="badge-muted badge">{fmtNum(memberships.length)}</span>}>
        {title}
      </SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
      {memberships.map((m) => (
        <Link
          key={m.id}
          href={`${hrefBase}/${m.circle_id}`}
          className="card group flex items-center gap-3"
          style={{ padding: '16px 18px' }}
        >
          <Avatar seed={m.circle.name} size={44} />
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
              {m.circle.name}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t(m.role === 'teacher' ? 'tracker.roleTeacher' : 'tracker.roleStudent')}
            </span>
          </div>
          <Chevron />
        </Link>
      ))}
      </div>
    </div>
  );
}

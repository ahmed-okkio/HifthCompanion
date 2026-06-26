'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/I18nProvider';
import type { MembershipWithHalaqah } from '@/lib/services/membership';
import { createHalaqah } from '@/lib/services/halaqah';
import { joinHalaqah } from '@/lib/services/membership';
import { getHalaqahByCode } from '@/lib/services/halaqah';
import PushToggle from '@/components/PushToggle';
import { PageHeader, SectionTitle, EmptyState, Avatar, Chevron } from './ui';

export default function TrackerHome({
  initialMemberships,
}: {
  initialMemberships: MembershipWithHalaqah[];
}) {
  const { t } = useI18n();
  const [memberships, setMemberships] = useState(initialMemberships);
  const [newName, setNewName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const teaching = memberships.filter((m) => m.role === 'teacher' && m.status === 'active');
  const enrolled = memberships.filter((m) => m.role === 'student' && m.status === 'active');

  async function handleCreate() {
    if (!newName.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const h = await createHalaqah(newName);
      // Reflect the new teacher membership locally.
      setMemberships((prev) => [
        {
          id: `local-${h.id}`,
          halaqah_id: h.id,
          user_id: '',
          role: 'teacher',
          shared_set_id: null,
          status: 'active',
          joined_at: new Date().toISOString(),
          halaqah: h,
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
      const h = await getHalaqahByCode(code);
      if (!h) throw new Error('No halaqah with that code');
      const m = await joinHalaqah(h.id);
      setMemberships((prev) => [{ ...m, halaqah: h }, ...prev]);
      setCode('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const empty = teaching.length === 0 && enrolled.length === 0;

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

      {/* Create + join actions */}
      <div className="card flex flex-col gap-4" style={{ padding: '18px 18px' }}>
        <Field label={t('tracker.createHalaqah')}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder={t('tracker.createHalaqahHint')}
            className="input"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button onClick={handleCreate} disabled={!newName.trim() || busy}
                  className="btn btn-primary" style={{ flexShrink: 0, minHeight: 44 }}>
            {t('common.create')}
          </button>
        </Field>

        <div style={{ height: 1, background: 'var(--border-subtle)' }} />

        <Field label={t('tracker.joinHalaqah')}>
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
        </Field>
      </div>

      {empty && (
        <EmptyState>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{t('tracker.emptyTitle')}</span>
          <span>{t('tracker.emptyHint')}</span>
        </EmptyState>
      )}

      <Section title={t('tracker.teaching')} memberships={teaching} hrefBase="/tracker" />
      <Section title={t('tracker.enrolled')} memberships={enrolled} hrefBase="/tracker" />

      {/* M4-3: opt into web push. Renders nothing on unsupported browsers or
          when NEXT_PUBLIC_VAPID_PUBLIC_KEY is unset. */}
      <PushToggle />
    </div>
  );
}

/** Labelled input + button row used by the create/join actions card. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}
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
  memberships: MembershipWithHalaqah[];
  hrefBase: string;
}) {
  const { t } = useI18n();
  if (memberships.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <SectionTitle trailing={<span className="badge-muted badge">{memberships.length}</span>}>
        {title}
      </SectionTitle>
      {memberships.map((m) => (
        <Link
          key={m.id}
          href={`${hrefBase}/${m.halaqah_id}`}
          className="card group flex items-center gap-3"
          style={{ padding: '14px 16px' }}
        >
          <Avatar seed={m.halaqah.name} />
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
              {m.halaqah.name}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t(m.role === 'teacher' ? 'tracker.roleTeacher' : 'tracker.roleStudent')}
            </span>
          </div>
          <span className="badge">{t(m.role === 'teacher' ? 'tracker.roleTeacher' : 'tracker.roleStudent')}</span>
          <Chevron />
        </Link>
      ))}
    </div>
  );
}

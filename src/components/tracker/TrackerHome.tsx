'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/I18nProvider';
import type { MembershipWithHalaqah } from '@/lib/services/membership';
import { createHalaqah } from '@/lib/services/halaqah';
import { joinHalaqah } from '@/lib/services/membership';
import { getHalaqahByCode } from '@/lib/services/halaqah';
import PushToggle from '@/components/PushToggle';

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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
        {t('tracker.title')}
      </h1>

      {error && (
        <div className="card" style={{ padding: '10px 14px', color: 'var(--danger, #dc2626)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Create + join actions */}
      <div className="flex flex-col gap-3">
        <div className="card flex gap-2 items-center" style={{ padding: '12px 16px' }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder={t('tracker.createHalaqah')}
            className="input"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button onClick={handleCreate} disabled={!newName.trim() || busy}
                  className="btn btn-primary" style={{ flexShrink: 0, minHeight: 44 }}>
            {t('tracker.createHalaqah')}
          </button>
        </div>
        <div className="card flex gap-2 items-center" style={{ padding: '12px 16px' }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder={t('tracker.inviteCode')}
            className="input"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button onClick={handleJoin} disabled={!code.trim() || busy}
                  className="btn btn-ghost" style={{ flexShrink: 0, minHeight: 44 }}>
            {t('tracker.joinHalaqah')}
          </button>
        </div>
      </div>

      <Section title={t('tracker.teaching')} memberships={teaching} hrefBase="/tracker" />
      <Section title={t('tracker.enrolled')} memberships={enrolled} hrefBase="/tracker" />

      {/* M4-3: opt into web push. Renders nothing on unsupported browsers or
          when NEXT_PUBLIC_VAPID_PUBLIC_KEY is unset. */}
      <PushToggle />
    </div>
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
  if (memberships.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {title}
      </h2>
      {memberships.map((m) => (
        <Link key={m.id} href={`${hrefBase}/${m.halaqah_id}`} className="card group" style={{ padding: '14px 18px' }}>
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>
              {m.halaqah.name}
            </span>
            <span className="badge">{m.role}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

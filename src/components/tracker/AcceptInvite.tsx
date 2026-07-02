'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';
import { acceptMembership } from '@/lib/services/membership';
import { PageHeader } from './ui';

/**
 * Consent gate (D12/D13, C3/C4): shown in front of a student's *pending*
 * membership. Naming the teacher + stating the default-mushaf visibility is the
 * explicit consent; accepting flips the row to 'active'. This is UX only — the
 * real gate is RLS (self-only accept trigger + pending-excluded teacher reads).
 */
export default function AcceptInvite({
  membershipId,
  circleName,
  teacherName,
}: {
  membershipId: string;
  circleName: string;
  teacherName: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await acceptMembership(membershipId);
      // pending→active: re-render the page, now landing on the student view.
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('accept.title')} subtitle={circleName} />

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

      <div className="card flex flex-col gap-5" style={{ padding: '20px 18px' }}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('accept.body', { teacher: teacherName })}
        </p>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleAccept}
            disabled={busy}
            className="btn btn-primary"
            style={{ minHeight: 44 }}
          >
            {t('accept.accept')}
          </button>
          <button
            onClick={() => router.push('/tracker')}
            disabled={busy}
            className="btn btn-outline"
            style={{ minHeight: 44 }}
          >
            {t('accept.decline')}
          </button>
        </div>
      </div>
    </div>
  );
}

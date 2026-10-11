'use client';
import type { UseQueryResult } from '@tanstack/react-query';
import { useI18n } from '@/components/I18nProvider';

/**
 * What a data section shows before it has data (PRD 0016 E4): its skeleton, or an
 * offline note when the fetch is paused for lack of network (never an endless skeleton).
 * Errors go to the route's error boundary, as a failed server read did.
 */
export default function QueryFallback({ q, skeleton }: { q: UseQueryResult; skeleton: React.ReactNode }) {
  const { t } = useI18n();
  if (q.error) throw q.error;
  if (q.fetchStatus === 'paused') {
    return <main className="w-full flex-1 p-8 text-center text-muted text-small">{t('common.offline')}</main>;
  }
  return skeleton;
}

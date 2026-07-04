'use client';

// Client wrapper for /profile (PRD 0008 M4, U2). Mounts the memorization editor
// prefilled with saved ranges; Save persists via the server action and shows a
// light inline confirmation.

import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';
import MemorizationEditor from '@/components/MemorizationEditor';
import { saveMemorization } from '@/lib/services/profile';
import type { MemorizedRange } from '@/types';

export default function ProfileClient({
  initialRanges,
  initialWeakest,
}: {
  initialRanges: MemorizedRange[];
  initialWeakest: number[];
}) {
  const router = useRouter();
  const { t } = useI18n();

  const onSave = async (ranges: MemorizedRange[], weakest: number[]) => {
    await saveMemorization(ranges, weakest);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
        {t('profile.title')}
      </h1>
      <MemorizationEditor
        initialRanges={initialRanges}
        initialWeakest={initialWeakest}
        saveLabel={t('common.save')}
        savedLabel={t('profile.saved')}
        onSave={onSave}
      />
    </div>
  );
}

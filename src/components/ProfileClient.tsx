'use client';

// Client wrapper for /profile (PRD 0008 M4, U2). Mounts the memorization editor
// prefilled with saved ranges; Save persists via the server action and shows a
// light inline confirmation.

import { useI18n } from '@/components/I18nProvider';
import MemorizationEditor from '@/components/MemorizationEditor';
import { saveMemorization } from '@/lib/services/profile';
import { guarded } from '@/lib/query/guarded';
import { qk } from '@/lib/query/keys';
import type { MemorizedRange } from '@/types';

// Ranges feed wird scopes, and settings shows them (qk.me).
const save = guarded(qk.wird, guarded(qk.me, saveMemorization));

export default function ProfileClient({
  initialRanges,
  initialWeakest,
}: {
  initialRanges: MemorizedRange[];
  initialWeakest: number[];
}) {
  const { t } = useI18n();

  const onSave = async (ranges: MemorizedRange[], weakest: number[]) => {
    await save(ranges, weakest);
  };

  return (
    <div className="flex flex-col gap-5">
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

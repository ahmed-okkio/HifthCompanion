'use client';
import type { AnnotationSet } from '@/types';
import { useI18n } from '@/components/I18nProvider';

interface Props {
  user: { id: string } | null;
  sets: Pick<AnnotationSet, 'id' | 'name'>[];
  selectedSetId: string;
  saving: boolean;
  onSetChange: (setId: string) => void;
}

export default function SetPicker({ user, sets, selectedSetId, saving, onSetChange }: Props) {
  const { t } = useI18n();
  return (
    <div className="mb-3 flex items-center gap-2 justify-between rounded-2xl border border-subtle bg-white/72 px-3 py-2 shadow-e1 backdrop-blur min-h-13 lg:min-h-0">
      {user ? (
        sets.length > 0 ? (
          <select
            id="set-picker-top"
            value={selectedSetId}
            onChange={e => onSetChange(e.target.value)}
            className="input input-sm min-h-11 lg:min-h-0 min-w-0 max-w-full flex-1"
          >
            {sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ) : (
          <a href="/sets" className="text-sm text-green-600">{t('sets.createSet')}</a>
        )
      ) : (
        <a href="/login" className="text-sm text-green-600">{t('sets.loginToAnnotate')}</a>
      )}
      {saving && <span className="text-sm text-green-600">{t('sets.saving')}</span>}
    </div>
  );
}

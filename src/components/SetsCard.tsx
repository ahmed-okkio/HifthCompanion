'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AnnotationSet } from '@/types';
import { createAnnotationSet } from '@/lib/services/annotationSets';
import PanelCard, { PanelIcon, ICON_PATHS } from '@/components/PanelCard';
import { useI18n } from '@/components/I18nProvider';

interface Props {
  user: { id: string } | null;
  sets: Pick<AnnotationSet, 'id' | 'name'>[];
  selectedSetId: string;
  saving: boolean;
  onSetChange: (setId: string) => void;
}

// V3 — Sets card. Lives at the TOP of the right context panel (portaled there from
// AnnotationCanvas so it shares the canvas state). Carries the annotation-set selector
// (#set-picker-top, preserved for E2E + soft-swap) plus an inline "New set" flow.
export default function SetsCard({ user, sets, selectedSetId, saving, onSetChange }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const created = await createAnnotationSet(name.trim());
      onSetChange(created.id);
      setName('');
      setAdding(false);
      // Refresh server data so the new set appears in the selector options.
      startTransition(() => router.refresh());
    } catch (e) {
      console.error('[SetsCard] create set failed', e);
      setError(t('sets.createFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelCard
      testid="sets-card"
      icon={<PanelIcon d={ICON_PATHS.layers} />}
      title={t('sets.title')}
      trailing={saving && (
        <span style={{ fontSize: 'var(--type-meta-size)', color: 'var(--text-accent)' }}>{t('sets.saving')}</span>
      )}
    >
      <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {user ? (
          <>
            {sets.length > 0 ? (
              <select
                id="set-picker-top"
                value={selectedSetId}
                onChange={e => onSetChange(e.target.value)}
                className="input input-sm"
                style={{ width: '100%', cursor: 'pointer' }}
              >
                {sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            ) : (
              <p style={{ fontSize: 'var(--type-caption-size)', color: 'var(--text-muted)' }}>
                {t('sets.noneYet')}
              </p>
            )}

            {adding ? (
              <div className="flex flex-col gap-2">
                <input
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') { setAdding(false); setName(''); }
                  }}
                  placeholder={t('sets.setNamePlaceholder')}
                  className="input input-sm"
                />
                {error && <p style={{ fontSize: 11, color: 'var(--danger)' }}>{error}</p>}
                <div className="flex gap-2">
                  <button onClick={handleCreate} disabled={!name.trim() || busy}
                          className="btn btn-primary flex-1" style={{ minHeight: 34, fontSize: 12 }}>
                    {t('common.create')}
                  </button>
                  <button onClick={() => { setAdding(false); setName(''); setError(''); }}
                          className="btn btn-ghost" style={{ minHeight: 34, fontSize: 12 }}>
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setAdding(true)}
                      className="btn btn-outline w-full" style={{ minHeight: 36, fontSize: 12, justifyContent: 'center' }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('sets.newSet')}
              </button>
            )}
          </>
        ) : (
          <a href="/login" style={{ fontSize: 'var(--type-small-size)', color: 'var(--text-accent)' }}>
            {t('sets.loginToAnnotate')}
          </a>
        )}
      </div>
    </PanelCard>
  );
}

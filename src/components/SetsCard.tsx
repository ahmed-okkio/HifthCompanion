'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AnnotationSet } from '@/types';
import { createAnnotationSet } from '@/lib/services/annotationSets';

interface Props {
  user: { id: string } | null;
  sets: Pick<AnnotationSet, 'id' | 'name'>[];
  selectedSetId: string;
  saving: boolean;
  onSetChange: (setId: string) => void;
}

// V3 — Sets card. Lives at the TOP of the right context panel (portaled there from
// AnnotationCanvas so it shares the canvas state). Replaces the old wide "set picker" bar that
// floated above the page. Carries the annotation-set selector (#set-picker-top, preserved for
// E2E + soft-swap) plus an inline "New set" action.
export default function SetsCard({ user, sets, selectedSetId, saving, onSetChange }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const handleCreate = async () => {
    const name = window.prompt('Name your new annotation set:');
    if (!name || !name.trim()) return;
    try {
      const created = await createAnnotationSet(name.trim());
      onSetChange(created.id);
      // Refresh server data so the new set appears in the selector options.
      startTransition(() => router.refresh());
    } catch (e) {
      console.error('[SetsCard] create set failed', e);
      alert('Could not create set. Please try again.');
    }
  };

  return (
    <section
      data-testid="sets-card"
      style={{
        background: 'var(--surface-main)',
        borderRadius: 'var(--radius-lg-px)',
        border: '1px solid var(--neutral-200)',
        boxShadow: 'var(--shadow-e1)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: 'var(--space-16) var(--space-16) var(--space-12)',
          borderBottom: '1px solid var(--neutral-200)',
        }}
      >
        <span style={{ fontSize: 'var(--type-body-size)', fontWeight: 600, color: 'var(--text-primary)' }}>
          Sets
        </span>
        {saving && (
          <span style={{ fontSize: 'var(--type-meta-size)', color: 'var(--text-accent)' }}>Saving…</span>
        )}
      </div>

      <div style={{ padding: 'var(--space-12) var(--space-16) var(--space-16)', display: 'flex', flexDirection: 'column', gap: 'var(--space-12)' }}>
        {user ? (
          <>
            {sets.length > 0 ? (
              <select
                id="set-picker-top"
                value={selectedSetId}
                onChange={e => onSetChange(e.target.value)}
                className="input input-sm"
                style={{ width: '100%' }}
              >
                {sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            ) : (
              <p style={{ fontSize: 'var(--type-caption-size)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No annotation sets yet.
              </p>
            )}
            <button
              type="button"
              onClick={handleCreate}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-8)',
                width: '100%',
                height: '44px',
                borderRadius: 'var(--radius-md-px)',
                border: '1.5px solid var(--green-600)',
                background: 'transparent',
                color: 'var(--green-600)',
                fontSize: 'var(--type-body-size)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background var(--duration-fast) var(--ease-out)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--green-soft)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New set
            </button>
          </>
        ) : (
          <a href="/login" style={{ fontSize: 'var(--type-small-size)', color: 'var(--text-accent)' }}>
            Log in to annotate
          </a>
        )}
      </div>
    </section>
  );
}

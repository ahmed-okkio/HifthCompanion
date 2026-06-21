'use client';
import type { AnnotationSet } from '@/types';

interface Props {
  user: { id: string } | null;
  sets: Pick<AnnotationSet, 'id' | 'name'>[];
  selectedSetId: string;
  saving: boolean;
  onSetChange: (setId: string) => void;
}

export default function SetPicker({ user, sets, selectedSetId, saving, onSetChange }: Props) {
  return (
    <div className="mb-3 flex items-center justify-between rounded-2xl border border-[var(--border-subtle)] bg-white/72 px-3 py-2 shadow-sm backdrop-blur">
      {user ? (
        sets.length > 0 ? (
          <select
            id="set-picker-top"
            value={selectedSetId}
            onChange={e => onSetChange(e.target.value)}
            className="input input-sm"
            style={{ minWidth: '180px' }}
          >
            {sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ) : (
          <a href="/sets" className="text-sm" style={{ color: 'var(--text-accent)' }}>Create set</a>
        )
      ) : (
        <a href="/login" className="text-sm" style={{ color: 'var(--text-accent)' }}>Log in to annotate</a>
      )}
      {saving && <span className="text-sm" style={{ color: 'var(--text-accent)' }}>Saving…</span>}
    </div>
  );
}

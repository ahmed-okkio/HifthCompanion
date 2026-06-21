'use client';

interface Props {
  value: string;
  isPending: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
}

export default function NoteForm({ value, isPending, onChange, onSubmit }: Props) {
  return (
    <div className="px-4 py-3" style={{ background: 'var(--bg-elevated)' }}>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Add a note about this page…"
        rows={2}
        className="input"
        style={{ fontSize: '12px', resize: 'none' }}
        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSubmit(); }}
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Ctrl+Enter to save</span>
        <button
          onClick={onSubmit}
          disabled={!value.trim() || isPending}
          className="btn btn-primary flex items-center gap-1"
          style={{ padding: '4px 14px', fontSize: '11px' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Note
        </button>
      </div>
    </div>
  );
}

'use client';
import type { Note } from '@/types';

interface Props {
  note: Note;
  isEditing: boolean;
  editBody: string;
  isPending: boolean;
  readOnly: boolean;
  onEditBodyChange: (v: string) => void;
  onSave: (id: string) => void;
  onCancel: () => void;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
}

export default function NoteItem({
  note, isEditing, editBody, isPending, readOnly,
  onEditBodyChange, onSave, onCancel, onEdit, onDelete,
}: Props) {
  return (
    <div
      className="group px-4 py-3"
      style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background var(--duration-fast) var(--ease-out)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {isEditing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={editBody}
            onChange={e => onEditBodyChange(e.target.value)}
            rows={3}
            className="input"
            style={{ fontSize: '12px', resize: 'none' }}
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={() => onSave(note.id)} disabled={isPending} className="btn btn-primary flex items-center gap-1" style={{ padding: '4px 12px', fontSize: '11px' }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Save
            </button>
            <button onClick={onCancel} className="btn btn-ghost flex items-center gap-1" style={{ padding: '4px 12px', fontSize: '11px' }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs leading-relaxed flex-1" style={{ color: 'var(--text-secondary)' }}>{note.body}</p>
          {!readOnly && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0" style={{ transition: 'opacity var(--duration-fast) var(--ease-out)' }}>
              <button onClick={() => onEdit(note)} className="btn btn-ghost flex items-center gap-1" style={{ padding: '2px 8px', fontSize: '10px' }}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                Edit
              </button>
              <button onClick={() => onDelete(note.id)} disabled={isPending} className="btn btn-danger-ghost flex items-center gap-1" style={{ padding: '2px 8px', fontSize: '10px' }}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Delete
              </button>
            </div>
          )}
        </div>
      )}
      <p className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>{new Date(note.created_at).toLocaleString()}</p>
    </div>
  );
}

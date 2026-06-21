'use client';
import type { Note } from '@/types';
import { useNotes } from '@/hooks/useNotes';
import NoteItem from '@/components/NoteItem';
import NoteForm from '@/components/NoteForm';

interface Props {
  setId: string;
  pageNum: number;
  initialNotes: Note[];
  readOnly?: boolean;
}

export default function NotesPanel({ setId, pageNum, initialNotes, readOnly = false }: Props) {
  const {
    notes, newBody, editingId, editBody, collapsed, isPending,
    setNewBody, setEditBody, setCollapsed,
    handleCreate, handleUpdate, handleDelete, startEdit, cancelEdit,
  } = useNotes(setId, pageNum, initialNotes);

  return (
    <aside className="card overflow-hidden animate-fade-in">
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>📝 Notes</span>
          {notes.length > 0 && <span className="badge">{notes.length}</span>}
          {readOnly && <span className="badge badge-muted">Read-only</span>}
        </div>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="btn btn-ghost flex items-center gap-1"
          style={{ padding: '2px 8px', fontSize: '11px' }}
        >
          {collapsed ? (
            <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>Show</>
          ) : (
            <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>Hide</>
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="flex flex-col">
          <div
            className="max-h-64 overflow-y-auto"
            style={{ borderBottom: notes.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}
          >
            {notes.length === 0 && (
              <p className="px-4 py-8 text-center text-xs italic" style={{ color: 'var(--text-muted)' }}>
                No notes yet for this page.
              </p>
            )}
            {notes.map(note => (
              <NoteItem
                key={note.id}
                note={note}
                isEditing={editingId === note.id}
                editBody={editBody}
                isPending={isPending}
                readOnly={readOnly}
                onEditBodyChange={setEditBody}
                onSave={handleUpdate}
                onCancel={cancelEdit}
                onEdit={startEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
          {!readOnly && (
            <NoteForm
              value={newBody}
              isPending={isPending}
              onChange={setNewBody}
              onSubmit={handleCreate}
            />
          )}
        </div>
      )}
    </aside>
  );
}

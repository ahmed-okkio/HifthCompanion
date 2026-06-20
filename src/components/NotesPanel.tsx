'use client';
import { useState, useTransition } from 'react';
import type { Note } from '@/types';
import { createNote, updateNote, deleteNote } from '@/lib/services/notes';

interface Props {
  setId: string;
  pageNum: number;
  initialNotes: Note[];
}

export default function NotesPanel({ setId, pageNum, initialNotes }: Props) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [newBody, setNewBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    if (!newBody.trim()) return;
    startTransition(async () => {
      try {
        const { data, error } = await createNote(setId, pageNum, newBody.trim());
        if (error) {
          console.error('[NotesPanel] Create error:', error);
          return;
        }
        if (data) {
          setNotes(prev => [...prev, data]);
          setNewBody('');
        }
      } catch (err) {
        console.error('[NotesPanel] Create error:', err);
      }
    });
  };

  const handleUpdate = (id: string) => {
    if (!editBody.trim()) return;
    startTransition(async () => {
      try {
        const { error } = await updateNote(id, editBody.trim());
        if (error) {
          console.error('[NotesPanel] Update error:', error);
          return;
        }
        setNotes(prev => prev.map(n => n.id === id ? { ...n, body: editBody.trim() } : n));
        setEditingId(null);
        setEditBody('');
      } catch (err) {
        console.error('[NotesPanel] Update error:', err);
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        const { error } = await deleteNote(id);
        if (error) {
          console.error('[NotesPanel] Delete error:', error);
          return;
        }
        setNotes(prev => prev.filter(n => n.id !== id));
      } catch (err) {
        console.error('[NotesPanel] Delete error:', err);
      }
    });
  };

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setEditBody(note.body);
  };

  return (
    <aside className="card overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3"
           style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            📝 Notes
          </span>
          {notes.length > 0 && (
            <span className="badge">{notes.length}</span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="btn btn-ghost flex items-center gap-1"
          style={{ padding: '2px 8px', fontSize: '11px' }}
        >
          {collapsed ? (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Show
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              Hide
            </>
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="flex flex-col">
          {/* Note list */}
          <div className="max-h-64 overflow-y-auto"
               style={{ borderBottom: notes.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
            {notes.length === 0 && (
              <p className="px-4 py-8 text-center text-xs italic"
                 style={{ color: 'var(--text-muted)' }}>
                No notes yet for this page.
              </p>
            )}
            {notes.map(note => (
              <div key={note.id}
                   className="group px-4 py-3"
                   style={{
                     borderBottom: '1px solid var(--border-subtle)',
                     transition: 'background var(--duration-fast) var(--ease-out)',
                   }}
                   onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                   onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {editingId === note.id ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={editBody}
                      onChange={e => setEditBody(e.target.value)}
                      rows={3}
                      className="input"
                      style={{ fontSize: '12px', resize: 'none' }}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(note.id)}
                        disabled={isPending}
                        className="btn btn-primary flex items-center gap-1"
                        style={{ padding: '4px 12px', fontSize: '11px' }}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Save
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditBody(''); }}
                        className="btn btn-ghost flex items-center gap-1"
                        style={{ padding: '4px 12px', fontSize: '11px' }}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs leading-relaxed flex-1"
                       style={{ color: 'var(--text-secondary)' }}>
                      {note.body}
                    </p>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0"
                         style={{ transition: 'opacity var(--duration-fast) var(--ease-out)' }}>
                      <button
                        onClick={() => startEdit(note)}
                        className="btn btn-ghost flex items-center gap-1"
                        style={{ padding: '2px 8px', fontSize: '10px' }}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        disabled={isPending}
                        className="btn btn-danger-ghost flex items-center gap-1"
                        style={{ padding: '2px 8px', fontSize: '10px' }}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                )}
                <p className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  {new Date(note.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          {/* Add note */}
          <div className="px-4 py-3" style={{ background: 'var(--bg-elevated)' }}>
            <textarea
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
              placeholder="Add a note about this page…"
              rows={2}
              className="input"
              style={{ fontSize: '12px', resize: 'none' }}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCreate(); }}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Ctrl+Enter to save
              </span>
              <button
                onClick={handleCreate}
                disabled={!newBody.trim() || isPending}
                className="btn btn-primary flex items-center gap-1"
                style={{ padding: '4px 14px', fontSize: '11px' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Note
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

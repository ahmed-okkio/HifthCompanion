'use client';
import { useRef } from 'react';
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

  // Ref to the NoteForm textarea so "New Note" button can focus it
  const formTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleNewNoteClick = () => {
    if (collapsed) setCollapsed(false);
    // Focus the textarea after the next render tick so the form is visible
    setTimeout(() => formTextareaRef.current?.focus(), 50);
  };

  return (
    /* V3 Story 13 — Notes card: white surface, radius-lg, neutral-200 border, shadow-e1 */
    <section
      data-testid="notes-card"
      style={{
        background: 'var(--surface-main)',
        borderRadius: 'var(--radius-lg-px)',
        border: '1px solid var(--neutral-200)',
        boxShadow: 'var(--shadow-e1)',
        overflow: 'hidden',
      }}
    >
      {/* Card header */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: 'var(--space-16) var(--space-16) var(--space-12)',
          borderBottom: '1px solid var(--neutral-200)',
        }}
      >
        <div className="flex items-center gap-2">
          <span
            style={{
              fontSize: 'var(--type-body-size)',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            Notes
          </span>
          {/* Count badge — always rendered so the header reads "Notes (N)" visually
              and tests that assert getByText(N) still pass. */}
          <span className="badge">{notes.length}</span>
          {readOnly && (
            <span className="badge badge-muted">Read-only</span>
          )}
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

      {/* Full-width "New Note" CTA — always visible (outside collapse), hidden in readOnly */}
      {!readOnly && (
        <div style={{ padding: 'var(--space-12) var(--space-16)' }}>
          <button
            onClick={handleNewNoteClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-8)',
              width: '100%',
              height: '48px',
              borderRadius: 'var(--radius-md-px)',
              border: '1.5px solid var(--green-600)',
              background: 'transparent',
              color: 'var(--green-600)',
              fontSize: 'var(--type-body-size)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--green-soft)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Note
          </button>
        </div>
      )}

      {!collapsed && (
        <div className="flex flex-col">
          {/* Note list */}
          <div style={{ borderTop: '1px solid var(--neutral-200)' }}>
            {notes.length === 0 && (
              <p
                style={{
                  padding: 'var(--space-32) var(--space-16)',
                  textAlign: 'center',
                  fontSize: 'var(--type-caption-size)',
                  color: 'var(--text-muted)',
                  fontStyle: 'italic',
                }}
              >
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

          {/* Inline note form — preserved exactly (all behavior/tests intact) */}
          {!readOnly && (
            <NoteForm
              value={newBody}
              isPending={isPending}
              onChange={setNewBody}
              onSubmit={handleCreate}
              textareaRef={formTextareaRef}
            />
          )}
        </div>
      )}
    </section>
  );
}

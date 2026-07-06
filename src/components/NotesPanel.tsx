'use client';
import type { Note } from '@/types';
import { useNotes } from '@/hooks/useNotes';
import NoteItem from '@/components/NoteItem';
import NoteForm from '@/components/NoteForm';
import PanelCard, { PanelIcon, ICON_PATHS } from '@/components/PanelCard';
import { useI18n } from '@/components/I18nProvider';

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
  const { t } = useI18n();

  return (
    <PanelCard
      testid="notes-card"
      icon={<PanelIcon d={ICON_PATHS.note} />}
      title={t('notes.title')}
      trailing={
        <>
          <span className="badge">{notes.length}</span>
          {readOnly && <span className="badge badge-muted">{t('notes.readOnly')}</span>}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="btn btn-ghost flex items-center gap-1"
            style={{ padding: '2px 8px', fontSize: '11px' }}
          >
            {collapsed ? (
              <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>{t('notes.show')}</>
            ) : (
              <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>{t('notes.hide')}</>
            )}
          </button>
        </>
      }
    >
      {!collapsed && (
        <div className="flex flex-col">
          {/* Composer first — the primary action sits right under the header. */}
          {!readOnly && (
            <NoteForm
              value={newBody}
              isPending={isPending}
              onChange={setNewBody}
              onSubmit={handleCreate}
            />
          )}

          {/* Note list */}
          <div>
            {notes.length === 0 && (
              <p
                style={{
                  padding: 'var(--space-24) var(--space-16)',
                  textAlign: 'center',
                  fontSize: 'var(--type-caption-size)',
                  color: 'var(--text-muted)',
                }}
              >
                {t('notes.empty')}
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
        </div>
      )}
    </PanelCard>
  );
}

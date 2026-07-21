'use client';
import { useEffect, useRef, useState } from 'react';
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
  /** Used only to label a note's author as "you" (D6). */
  currentUserId?: string | null;
}

/**
 * Badge → panel (D4). Listens for the badge layer's focus event, scrolls that object's
 * first note into view and highlights every note bound to it. `pages` is what keeps a
 * spread's two canvases addressing the right panel — the event carries setId + pageNum.
 * Shared with SpreadNotesPanel; the highlight clears itself so nothing has to reset it.
 */
export function useNoteFocus(setId: string, pages: number[], onReveal?: () => void) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const key = pages.join(',');
  // Ref so a fresh callback each render doesn't re-subscribe the listener.
  const onRevealRef = useRef(onReveal);
  onRevealRef.current = onReveal;

  useEffect(() => {
    const onFocus = (e: Event) => {
      const d = (e as CustomEvent).detail as { setId: string; pageNum: number; fabricObjectId: string };
      if (d.setId !== setId || !key.split(',').includes(String(d.pageNum))) return;
      setHighlighted(d.fabricObjectId);
      onRevealRef.current?.(); // a collapsed panel must open, or D4 scrolls nothing
      requestAnimationFrame(() => {
        listRef.current
          ?.querySelector(`[data-note-object="${CSS.escape(d.fabricObjectId)}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    };
    window.addEventListener('hifth:note-focus', onFocus);
    return () => window.removeEventListener('hifth:note-focus', onFocus);
  }, [setId, key]);

  useEffect(() => {
    if (!highlighted) return;
    const timer = setTimeout(() => setHighlighted(null), 2500);
    return () => clearTimeout(timer);
  }, [highlighted]);

  return { listRef, highlighted };
}

/** Panel → badge (D5): selecting a bound note flashes its badge on the canvas. */
export function flashBadge(setId: string, pageNum: number, fabricObjectId?: string | null) {
  if (!fabricObjectId) return;
  window.dispatchEvent(new CustomEvent('hifth:note-flash', { detail: { setId, pageNum, fabricObjectId } }));
}

export default function NotesPanel({ setId, pageNum, initialNotes, readOnly = false, currentUserId }: Props) {
  const {
    notes, newBody, editingId, editBody, collapsed, isPending,
    setNewBody, setEditBody, setCollapsed,
    handleCreate, handleUpdate, handleDelete, handleLink, startEdit, cancelEdit,
  } = useNotes(setId, pageNum, initialNotes);
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // A pending link: 'draft' = the composer's text waits for an annotation; a string = an
  // existing note's id waits. null = not linking.
  const [linkTarget, setLinkTarget] = useState<'draft' | string | null>(null);
  const { listRef, highlighted } = useNoteFocus(setId, [pageNum], () => setCollapsed(false));

  const startLink = (target: 'draft' | string) => {
    setLinkTarget(target);
    setCollapsed(false);
    // A draft can land on empty page area (unbound); an existing-note relink cannot.
    window.dispatchEvent(new CustomEvent('hifth:note-link-start', { detail: { setId, allowEmpty: target === 'draft' } }));
  };

  // Canvas reports which annotation the user picked; apply it to the pending target.
  useEffect(() => {
    if (readOnly) return;
    const onPicked = (e: Event) => {
      const d = (e as CustomEvent).detail as { setId: string; pageNum: number; fabricObjectId: string | null };
      if (d.setId !== setId || d.pageNum !== pageNum || !linkTarget) return;
      if (linkTarget === 'draft') handleCreate(undefined, d.fabricObjectId);
      else handleLink(linkTarget, d.fabricObjectId);
      setLinkTarget(null);
    };
    const onCancel = () => setLinkTarget(null);
    window.addEventListener('hifth:note-link-picked', onPicked);
    window.addEventListener('hifth:note-link-cancel', onCancel);
    return () => {
      window.removeEventListener('hifth:note-link-picked', onPicked);
      window.removeEventListener('hifth:note-link-cancel', onCancel);
    };
  }, [setId, pageNum, readOnly, linkTarget, handleCreate, handleLink]);

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
              onSubmit={(body) => handleCreate(body)}
              onAddAndLink={() => { if (newBody.trim()) startLink('draft'); }}
              linkPending={linkTarget === 'draft'}
              textareaRef={textareaRef}
            />
          )}

          {/* Note list */}
          <div ref={listRef}>
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
                currentUserId={currentUserId}
                highlighted={!!note.fabric_object_id && note.fabric_object_id === highlighted}
                onSelect={() => flashBadge(setId, pageNum, note.fabric_object_id)}
                onLink={() => startLink(note.id)}
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

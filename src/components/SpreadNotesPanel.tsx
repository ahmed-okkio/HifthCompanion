'use client';
import { useEffect, useRef, useState } from 'react';
import type { Note } from '@/types';
import { useNotes } from '@/hooks/useNotes';
import NoteItem from '@/components/NoteItem';
import { flashBadge, useNoteFocus } from '@/components/NotesPanel';
import PanelCard, { PanelIcon, ICON_PATHS } from '@/components/PanelCard';
import { useI18n } from '@/components/I18nProvider';

interface Props {
  setId: string;
  /** Spread pages, numeric order [lower, higher] (right, left in RTL). */
  pages: [number, number];
  initialNotes: Record<number, Note[]>;
  readOnly?: boolean;
  /** Used only to label a note's author as "you" (D6). */
  currentUserId?: string | null;
}

/** Notes for a two-page spread: both pages' notes shown in ONE merged list. A single
 *  composer with a split add-button decides which page a new note attaches to. */
export default function SpreadNotesPanel({ setId, pages, initialNotes, readOnly = false, currentUserId }: Props) {
  const a = useNotes(setId, pages[0], initialNotes[pages[0]] ?? []);
  const b = useNotes(setId, pages[1], initialNotes[pages[1]] ?? []);
  const { t, fmtNum } = useI18n();
  const [body, setBody] = useState('');
  // Pending link: 'draft' = the composer text waits for an annotation (its page comes from the
  // pick); {id,page} = an existing note on `page` waits for an annotation on that same page.
  const [linkTarget, setLinkTarget] = useState<'draft' | { id: string; page: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Both pages feed one merged list, so this panel answers badge focus for either canvas.
  const { listRef, highlighted } = useNoteFocus(setId, pages);

  const hookFor = (page: number) => (page === pages[0] ? a : b);

  const startLink = (target: 'draft' | { id: string; page: number }) => {
    setLinkTarget(target);
    // A draft may land on empty page area (places it on that page, unbound); relink may not.
    window.dispatchEvent(new CustomEvent('hifth:note-link-start', { detail: { setId, allowEmpty: target === 'draft' } }));
  };

  // Canvas reports the picked annotation (with its page); apply to the pending target.
  useEffect(() => {
    if (readOnly) return;
    const onPicked = (e: Event) => {
      const d = (e as CustomEvent).detail as { setId: string; pageNum: number; fabricObjectId: string | null };
      if (d.setId !== setId || !pages.includes(d.pageNum) || !linkTarget) return;
      if (linkTarget === 'draft') {
        if (body.trim()) { hookFor(d.pageNum).handleCreate(body, d.fabricObjectId); setBody(''); }
      } else if (linkTarget.page === d.pageNum) {
        // A note can only link to an annotation on its own page.
        hookFor(linkTarget.page).handleLink(linkTarget.id, d.fabricObjectId);
      }
      setLinkTarget(null);
    };
    const onCancel = () => setLinkTarget(null);
    window.addEventListener('hifth:note-link-picked', onPicked);
    window.addEventListener('hifth:note-link-cancel', onCancel);
    return () => {
      window.removeEventListener('hifth:note-link-picked', onPicked);
      window.removeEventListener('hifth:note-link-cancel', onCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId, pages.join(','), readOnly, linkTarget, body]);

  // Merge both pages, oldest-first, tagging each note with its owning hook so
  // edit/delete route to the right page's state.
  const rows = [
    ...a.notes.map(n => ({ note: n, hook: a, page: pages[0] })),
    ...b.notes.map(n => ({ note: n, hook: b, page: pages[1] })),
  ].sort((x, y) => x.note.created_at.localeCompare(y.note.created_at));

  const isPending = a.isPending || b.isPending;

  return (
    <PanelCard
      testid="notes-card"
      icon={<PanelIcon d={ICON_PATHS.note} />}
      title={t('notes.title')}
      trailing={
        <>
          <span className="badge">{rows.length}</span>
          {readOnly && <span className="badge badge-muted">{t('notes.readOnly')}</span>}
        </>
      }
    >
      <div className="flex flex-col">
        {/* Composer: one textbox, split add-button (left half → page[0], right half → page[1]) */}
        {!readOnly && (
          <div style={{ padding: 'var(--space-12) var(--space-16)', background: 'var(--surface-main)', borderBottom: '1px solid var(--neutral-200)' }}>
            <textarea
              dir="auto"
              ref={textareaRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={t('notes.placeholder')}
              rows={2}
              className="input"
              style={{ fontSize: '13px', resize: 'none' }}
            />
            {linkTarget === 'draft' ? (
              <div className="mt-2" style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600, textAlign: 'center' }}>
                {t('notes.placePrompt')}
              </div>
            ) : (
              // One flow: tap an annotation to link, or a page to place the note there.
              <button
                onClick={() => { if (body.trim()) startLink('draft'); }}
                disabled={!body.trim() || isPending}
                className="btn btn-primary w-full flex items-center justify-center gap-1 mt-2"
                style={{ padding: '8px 14px', fontSize: '12px' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {t('notes.addNote')}
              </button>
            )}
          </div>
        )}

        {/* Merged note list */}
        {rows.length === 0 && (
          <p style={{ padding: 'var(--space-24) var(--space-16)', textAlign: 'center', fontSize: 'var(--type-caption-size)', color: 'var(--text-muted)' }}>
            {t('notes.empty')}
          </p>
        )}
        <div ref={listRef}>
        {rows.map(({ note, hook, page }) => (
          <NoteItem
            key={note.id}
            note={note}
            isEditing={hook.editingId === note.id}
            editBody={hook.editBody}
            isPending={hook.isPending}
            readOnly={readOnly}
            pageBadge={`${t('notes.pageLabel')} ${fmtNum(page)}`}
            currentUserId={currentUserId}
            highlighted={!!note.fabric_object_id && note.fabric_object_id === highlighted}
            onSelect={() => flashBadge(setId, page, note.fabric_object_id)}
            onLink={() => startLink({ id: note.id, page })}
            onEditBodyChange={hook.setEditBody}
            onSave={hook.handleUpdate}
            onCancel={hook.cancelEdit}
            onEdit={hook.startEdit}
            onDelete={hook.handleDelete}
          />
        ))}
        </div>
      </div>
    </PanelCard>
  );
}

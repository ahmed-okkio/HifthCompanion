'use client';
import { useState } from 'react';
import type { Note } from '@/types';
import { useNotes } from '@/hooks/useNotes';
import NoteItem from '@/components/NoteItem';
import PanelCard, { PanelIcon, ICON_PATHS } from '@/components/PanelCard';
import { useI18n } from '@/components/I18nProvider';

interface Props {
  setId: string;
  /** Spread pages, numeric order [lower, higher] (right, left in RTL). */
  pages: [number, number];
  initialNotes: Record<number, Note[]>;
  readOnly?: boolean;
}

/** Notes for a two-page spread: both pages' notes shown in ONE merged list. A single
 *  composer with a split add-button decides which page a new note attaches to. */
export default function SpreadNotesPanel({ setId, pages, initialNotes, readOnly = false }: Props) {
  const a = useNotes(setId, pages[0], initialNotes[pages[0]] ?? []);
  const b = useNotes(setId, pages[1], initialNotes[pages[1]] ?? []);
  const { t, fmtNum } = useI18n();
  const [body, setBody] = useState('');

  // Merge both pages, oldest-first, tagging each note with its owning hook so
  // edit/delete route to the right page's state.
  const rows = [
    ...a.notes.map(n => ({ note: n, hook: a, page: pages[0] })),
    ...b.notes.map(n => ({ note: n, hook: b, page: pages[1] })),
  ].sort((x, y) => x.note.created_at.localeCompare(y.note.created_at));

  const addTo = (page: number) => {
    if (!body.trim()) return;
    (page === pages[0] ? a : b).handleCreate(body);
    setBody('');
  };

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
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={t('notes.placeholder')}
              rows={2}
              className="input"
              style={{ fontSize: '13px', resize: 'none' }}
            />
            <div
              className="flex mt-2"
              dir="ltr"
              style={{ border: `1px solid ${body.trim() ? 'var(--green-600)' : 'var(--neutral-200)'}`, borderRadius: 'var(--radius-sm-px)', overflow: 'hidden' }}
            >
              {/* Lower page (pages[0]) pinned to the visual RIGHT to match the spread, both locales. */}
              {[pages[1], pages[0]].map((page, i) => (
                <button
                  key={page}
                  onClick={() => addTo(page)}
                  disabled={!body.trim() || isPending}
                  className="btn btn-primary flex-1 flex items-center justify-center gap-1"
                  style={{ padding: '6px 8px', fontSize: '11px', borderRadius: 0, borderInlineStart: i === 1 ? `1px solid ${body.trim() ? 'rgba(255,255,255,0.35)' : 'var(--neutral-200)'}` : undefined }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('notes.pageLabel')} {fmtNum(page)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Merged note list */}
        {rows.length === 0 && (
          <p style={{ padding: 'var(--space-24) var(--space-16)', textAlign: 'center', fontSize: 'var(--type-caption-size)', color: 'var(--text-muted)' }}>
            {t('notes.empty')}
          </p>
        )}
        {rows.map(({ note, hook, page }) => (
          <NoteItem
            key={note.id}
            note={note}
            isEditing={hook.editingId === note.id}
            editBody={hook.editBody}
            isPending={hook.isPending}
            readOnly={readOnly}
            pageBadge={`${t('notes.pageLabel')} ${fmtNum(page)}`}
            onEditBodyChange={hook.setEditBody}
            onSave={hook.handleUpdate}
            onCancel={hook.cancelEdit}
            onEdit={hook.startEdit}
            onDelete={hook.handleDelete}
          />
        ))}
      </div>
    </PanelCard>
  );
}

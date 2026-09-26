'use client';
import type { Note } from '@/types';
import { useI18n } from '@/components/I18nProvider';

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
  /** Spread mode: label showing which page this note belongs to (e.g. "Page 3"). */
  pageBadge?: string;
  /** Signed-in user, so an authored note can say "you" (D6). */
  currentUserId?: string | null;
  /** The badge for this note's object was activated (D4). */
  highlighted?: boolean;
  /** Fired on click — the panel turns this into a badge flash (D5). */
  onSelect?: () => void;
  /** Start a link session to pick an annotation for this note (relink keeps the old link
   *  until a new annotation is actually selected). */
  onLink?: (note: Note) => void;
}

export default function NoteItem({
  note, isEditing, editBody, isPending, readOnly,
  onEditBodyChange, onSave, onCancel, onEdit, onDelete, pageBadge,
  currentUserId, highlighted, onSelect, onLink,
}: Props) {
  const { t, fmtNum } = useI18n();
  const linked = !!note.fabric_object_id;
  return (
    /* V3 Story 13 — Note card: white, radius-lg, neutral-200 border, green left accent bar.
       Category color is presentation-only; green is the default accent (no DB field). */
    <div
      className={`group flex border-b border-neutral-200 bg-surface-main transition-colors duration-(--duration-fast) ease-out -outline-offset-2 hover:bg-neutral-50${highlighted ? ' outline-2 outline-green-600' : ''}`}
      data-note-object={note.fabric_object_id ?? undefined}
      onClick={onSelect}
    >
      {/* Left accent bar — green by default; category colors are a future enhancement */}
      <div
        aria-hidden="true"
        className="w-0.75 shrink-0 bg-green-600 opacity-70"
      />

      {/* Card body */}
      <div className="min-w-0 flex-1 p-3">
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <textarea
              dir="auto"
              value={editBody}
              onChange={e => onEditBodyChange(e.target.value)}
              rows={3}
              className="input resize-none text-caption"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => onSave(note.id)}
                disabled={isPending}
                className="btn btn-primary btn-xs flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                {t('common.save')}
              </button>
              <button
                onClick={onCancel}
                className="btn btn-ghost btn-xs flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <p
                dir="auto"
                className="min-w-0 flex-1 whitespace-pre-wrap wrap-break-word text-small leading-relaxed text-primary"
              >
                {note.body}
              </p>
              {!readOnly && (
                <div className="flex gap-1 items-start shrink-0">
                  {/* Link/unlink — always visible so a note's linked state is legible at a glance. */}
                  <button
                    onClick={e => { e.stopPropagation(); onLink?.(note); }}
                    title={linked ? t('notes.relink') : t('notes.link')}
                    aria-label={linked ? t('notes.relink') : t('notes.link')}
                    className={`btn btn-ghost btn-xs flex items-center ${linked ? 'text-green-600' : 'text-muted'}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.5-1.5m6.656-2.828a4 4 0 00-5.656 0l-.5.5m8.156 6.156l1.5-1.5a4 4 0 000-5.656 4 4 0 00-5.656 0l-3 3a4 4 0 000 5.656" /></svg>
                  </button>
                  <div
                    className="flex gap-1 opacity-0 transition-opacity duration-(--duration-fast) ease-out group-hover:opacity-100"
                  >
                  <button
                    onClick={() => onEdit(note)}
                    className="btn btn-ghost btn-xs flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    {t('common.edit')}
                  </button>
                  <button
                    onClick={() => onDelete(note.id)}
                    disabled={isPending}
                    className="btn btn-danger-ghost btn-xs flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    {t('common.delete')}
                  </button>
                  </div>
                </div>
              )}
            </div>
            {/* Timestamp (+ page badge in spread mode) */}
            <div className="mt-2 flex items-center gap-2">
              {pageBadge && <span className="badge badge-muted text-micro">{pageBadge}</span>}
              {/* Legacy notes predate author_id and simply show no author line (D6). */}
              {note.author_id && (
                <p className="text-meta text-muted">
                  {t(note.author_id === currentUserId ? 'notes.authorYou' : 'notes.authorOther')}
                </p>
              )}
              <p className="text-meta text-muted">
                {fmtNum(new Date(note.created_at).toLocaleDateString(undefined, {
                  month: 'short', day: 'numeric', year: 'numeric',
                }))}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

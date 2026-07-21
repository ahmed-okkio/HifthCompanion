'use client';
import { RefObject } from 'react';
import { useI18n } from '@/components/I18nProvider';

interface Props {
  value: string;
  isPending: boolean;
  onChange: (v: string) => void;
  onSubmit: (bodyArg?: string, fabricObjectId?: string | null) => void;
  /** "Add & Link": create this note, then pick an annotation on the canvas to link it to. */
  onAddAndLink?: () => void;
  /** True while waiting for the user to pick an annotation for this draft. */
  linkPending?: boolean;
  /** Optional ref forwarded from NotesPanel so the "New Note" CTA can focus the textarea. */
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}

export default function NoteForm({ value, isPending, onChange, onSubmit, onAddAndLink, linkPending, textareaRef }: Props) {
  const { t } = useI18n();
  const disabled = !value.trim() || isPending;
  return (
    <div style={{ padding: 'var(--space-12) var(--space-16)', background: 'var(--surface-main)', borderBottom: '1px solid var(--neutral-200)' }}>
      <textarea
        dir="auto"
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={t('notes.placeholder')}
        rows={2}
        className="input"
        style={{ fontSize: '13px', resize: 'none' }}
        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSubmit(undefined); }}
      />
      {linkPending ? (
        <div className="mt-2" style={{ fontSize: '12px', color: 'var(--accent, #16a34a)', fontWeight: 600, textAlign: 'center' }}>
          {t('notes.placePrompt')}
        </div>
      ) : (
        <div className="flex flex-col gap-2 mt-2">
          {/* Primary action: create + link to an annotation. */}
          <button
            onClick={onAddAndLink}
            disabled={disabled}
            className="btn btn-primary w-full flex items-center justify-center gap-1"
            style={{ padding: '8px 14px', fontSize: '12px' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.5-1.5m6.656-2.828a4 4 0 00-5.656 0l-.5.5m8.156 6.156l1.5-1.5a4 4 0 000-5.656 4 4 0 00-5.656 0l-3 3a4 4 0 000 5.656" /></svg>
            {t('notes.addAndLink')}
          </button>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 'var(--type-meta-size)', color: 'var(--text-muted)' }}>{t('notes.ctrlEnterSave')}</span>
            <button
              onClick={() => onSubmit(undefined)}
              disabled={disabled}
              className="btn btn-ghost flex items-center gap-1"
              style={{ padding: '4px 12px', fontSize: '11px' }}
            >
              {t('notes.addNote')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

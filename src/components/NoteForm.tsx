'use client';
import { RefObject } from 'react';
import { useI18n } from '@/components/I18nProvider';

interface Props {
  value: string;
  isPending: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
  /** Optional ref forwarded from NotesPanel so the "New Note" CTA can focus the textarea. */
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}

export default function NoteForm({ value, isPending, onChange, onSubmit, textareaRef }: Props) {
  const { t } = useI18n();
  return (
    <div style={{ padding: 'var(--space-12) var(--space-16)', background: 'var(--surface-main)', borderBottom: '1px solid var(--neutral-200)' }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={t('notes.placeholder')}
        rows={2}
        className="input"
        style={{ fontSize: '13px', resize: 'none' }}
        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSubmit(); }}
      />
      <div className="flex items-center justify-between mt-2">
        <span style={{ fontSize: 'var(--type-meta-size)', color: 'var(--text-muted)' }}>{t('notes.ctrlEnterSave')}</span>
        <button
          onClick={onSubmit}
          disabled={!value.trim() || isPending}
          className="btn btn-primary flex items-center gap-1"
          style={{ padding: '4px 14px', fontSize: '11px' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('notes.addNote')}
        </button>
      </div>
    </div>
  );
}

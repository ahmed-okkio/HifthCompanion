'use client';

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { postNote, type NoteWithAuthor } from '@/lib/services/membershipNotes';
import { SectionTitle, EmptyState, Avatar, PagedList } from './ui';

/** Shared membership notes thread (G1/G2/G3): composer on top, newest first. */
export default function NotesThread({
  membershipId,
  initial,
}: {
  membershipId: string;
  initial: NoteWithAuthor[];
}) {
  const { t, locale, fmtNum } = useI18n();
  const [notes, setNotes] = useState(initial);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function handlePost() {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      const note = await postNote(membershipId, body);
      setNotes((p) => [note, ...p]);
      setBody('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle trailing={notes.length > 0 && <span className="badge badge-muted">{fmtNum(notes.length)}</span>}>
        {t('notes.title')}
      </SectionTitle>
      <div className="flex gap-2 items-end">
        <input value={body} onChange={(e) => setBody(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handlePost()}
               placeholder={t('notes.placeholder')} className="input" style={{ flex: 1 }} />
        <button onClick={handlePost} disabled={!body.trim() || busy} className="btn btn-primary" style={{ minHeight: 44 }}>
          {t('notes.post')}
        </button>
      </div>
      {notes.length === 0 && <EmptyState>{t('notes.empty')}</EmptyState>}
      <PagedList items={notes} loadMoreLabel={t('grade.loadMore')} render={(n) => {
        const name = `${n.first_name ?? ''} ${n.last_name ?? ''}`.trim() || `#${n.author_id.slice(0, 6)}`;
        return (
          <div key={n.id} className="card flex gap-3" style={{ padding: '12px 14px' }}>
            <Avatar seed={name} size={32} />
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {name}
                </span>
                <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {new Date(n.created_at).toLocaleDateString(locale)}
                </span>
              </div>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{n.body}</span>
            </div>
          </div>
        );
      }} />
    </div>
  );
}

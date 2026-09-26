'use client';

// 0013 Substitute teacher — shared UI bits reused across the teacher circle
// agenda, the per-student session list and the student's own session cards.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { searchAccountsByEmail, type AccountMatch } from '@/lib/services/collaborators';
import { useI18n } from '@/components/I18nProvider';
import { ActionButton, AnchoredPopup, Avatar } from './ui';

/**
 * Search accounts by email prefix and pick one (F2/F3) — same shape as the
 * mushaf share picker, so the teacher confirms WHO they're handing the session
 * to, not just a typed string. Only a real account row can be picked, so an
 * unknown email writes nothing. The parent owns assignSubstitutes + state.
 */
export function SubAssignForm({
  onAssign, autoFocus, grow, onCancel,
}: {
  onAssign: (userId: string, label: string) => Promise<void> | void;
  autoFocus?: boolean;
  /** Let the email input fill its slot (used by the morphing header button). */
  grow?: boolean;
  /** Escape / dismiss control; omitted where the form is always visible. */
  onCancel?: () => void;
}) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [matches, setMatches] = useState<AccountMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Debounced prefix search; <3 chars is a no-op (bound also enforced in the RPC).
  useEffect(() => {
    const v = email.trim();
    if (v.length < 3) { setMatches(null); setSearching(false); return; }
    setSearching(true);
    const id = setTimeout(() => {
      searchAccountsByEmail(v)
        .then((a) => setMatches(a))
        .catch(() => setMatches([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(id);
  }, [email]);

  const label = (a: AccountMatch) =>
    [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || a.email;

  const wrapRef = useRef<HTMLDivElement>(null);

  async function pick(a: AccountMatch) {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      await onAssign(a.id, label(a));
      setEmail(''); setMatches(null);
    } catch (ex) {
      setErr((ex as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div ref={wrapRef} className="flex flex-col gap-1 w-full relative">
      <div className="flex gap-2 items-center">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoFocus={autoFocus}
               onKeyDown={(e) => {
                 if (e.key === 'Escape') onCancel?.();
                 if (e.key === 'Enter' && matches?.length) pick(matches[0]);
               }}
               placeholder={t('subs.email')} className={`input min-h-9 text-small${grow ? ' flex-1 min-w-0' : ''}`} />
        {onCancel && (
          <button onClick={onCancel} aria-label={t('common.cancel')} className="btn btn-ghost btn-icon btn-sm shrink-0">
            ✕
          </button>
        )}
      </div>

      {/* Results float over the list so the header row doesn't jump. */}
      <AnchoredPopup open={searching || !!matches} anchorRef={wrapRef} className="card">
        <div className="p-0">
          {searching && <p className="text-caption text-muted px-3 py-2">{t('share.searching')}</p>}
          {!searching && matches?.length === 0 && (
            <p className="text-caption text-muted px-3 py-2">{t('share.noMatchingAccounts')}</p>
          )}
          {!searching && matches?.map((a) => (
            <button key={a.id} onClick={() => pick(a)} disabled={busy}
                    className="flex items-center gap-2 text-start w-full px-3 py-2 bg-transparent border-0 border-b border-subtle cursor-pointer hover:bg-accent-muted">
              <Avatar seed={label(a)} size={28} />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="truncate text-caption font-semibold text-primary">{label(a)}</span>
                <span className="truncate text-micro text-muted">{a.email}</span>
              </div>
              <span className="badge shrink-0 text-micro">{t('subs.assign')}</span>
            </button>
          ))}
        </div>
      </AnchoredPopup>
      {err && <span className="text-caption text-danger">{err}</span>}
    </div>
  );
}

/**
 * "Covered by <name>" chip for an assigned session (F5/D13). With `onRemove` it
 * is the whole substitute control on a teacher row — one sub per instant, so
 * clearing it (the ✕) IS the reclaim and there is nothing else to manage.
 */
export function CoveredBy({ name, onRemove }: { name: string; onRemove?: () => void }) {
  const { t } = useI18n();
  if (!onRemove) {
    return <span className="badge badge-muted text-micro">{t('subs.coveredBy', { name })}</span>;
  }
  // Teacher-facing: reads as the person, not a tag — avatar, name, role line.
  return (
    <span className="shrink-0 inline-flex items-center gap-2 max-w-60 py-1 ps-1 pe-2 rounded-md bg-surface-app border border-subtle">
      <Avatar seed={name} size={28} />
      <span className="flex flex-col min-w-0 leading-tight">
        <span className="truncate text-caption font-semibold text-primary">{name}</span>
        <span className="truncate text-micro text-muted">{t('subs.substitute')}</span>
      </span>
      <ActionButton compact onClick={onRemove} aria-label={t('subs.removeSub', { name })}
              className="btn btn-ghost btn-icon btn-sm shrink-0 text-muted">
        ✕
      </ActionButton>
    </span>
  );
}

// --- Attribution (E4/E5) -----------------------------------------------------
// Who acted on a mark/grade. The actor is the away teacher (no "· sub") when the
// id matches the circle teacher, otherwise a covering substitute. Provided at the
// student-detail root so the deep session/log cards need no prop drilling.

const AttrCtx = createContext<{ teacherId: string; names: Record<string, string> }>({
  teacherId: '', names: {},
});

export function AttributionProvider({
  teacherId, names, children,
}: {
  teacherId: string;
  names: Record<string, string>;
  children: React.ReactNode;
}) {
  return <AttrCtx.Provider value={{ teacherId, names }}>{children}</AttrCtx.Provider>;
}

export function Attribution({ actorId }: { actorId?: string | null }) {
  const { t } = useI18n();
  const { teacherId, names } = useContext(AttrCtx);
  if (!actorId) return null; // student self-write / unmarked → no line (E1/E2)
  const isSub = actorId !== teacherId;
  // Teacher name is usually resolvable; a sub's profile may be RLS-hidden, and a
  // missing profile row yields '' — both fall back to the generic label rather
  // than rendering a blank line (E4/E5).
  const name = names[actorId] || (isSub ? t('subs.substitute') : t('subs.teacher'));
  return (
    <span className="text-caption text-muted">
      {t('subs.by', { name })}{isSub ? t('subs.bySuffix') : ''}
    </span>
  );
}

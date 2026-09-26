'use client';
import { useEffect, useState } from 'react';
import { addByEmail, searchAccountsByEmail, list, remove, type AccountMatch, type Collaborator } from '@/lib/services/collaborators';
import PanelCard, { PanelIcon, ICON_PATHS } from '@/components/PanelCard';
import { Avatar, Icon } from '@/components/tracker/ui';
import { useI18n } from '@/components/I18nProvider';

interface Props {
  userId: string;
  pageNum: number;
  sets: { id: string; name: string }[];
}

type Lookup =
  | { state: 'idle' }
  | { state: 'searching' }
  | { state: 'results'; accounts: AccountMatch[] };

/**
 * V3 Story 14 — Share card. Two clear sections: a read-only share link, and
 * collaborator (edit-access) management with a live account preview — typing a
 * full email resolves the matching account so you can confirm it's the right
 * person before granting access. Share URL contract untouched; button text
 * contains "Share" so `button:has-text("Share")` still matches.
 */
export default function ShareCard({ userId, pageNum, sets }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState(sets[0]?.id ?? '');

  // Edit-access management. ShareCard renders only in the owner's own reader over
  // the owner's own sets, so this section is inherently owner-only (contract D3).
  const [email, setEmail] = useState('');
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' });
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  // Client-only state → SSR renders would hydration-mismatch; gate to post-mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!selectedSetId) return;
    list(selectedSetId).then(setCollaborators).catch(() => setCollaborators([]));
  }, [selectedSetId]);

  // Live account search: prefix-match accounts as you type (debounced, min 3
  // chars — bound enforced by the RPC too). Matching accounts render as
  // pickable rows so the owner confirms WHO they're adding, not just a string.
  useEffect(() => {
    const value = email.trim();
    if (value.length < 3) {
      setLookup({ state: 'idle' });
      return;
    }
    setLookup({ state: 'searching' });
    const id = setTimeout(() => {
      searchAccountsByEmail(value)
        .then(accounts => setLookup({ state: 'results', accounts }))
        .catch(() => setLookup({ state: 'results', accounts: [] }));
    }, 300);
    return () => clearTimeout(id);
  }, [email]);

  const fullName = (c: { first_name?: string; last_name?: string }) =>
    [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || t('share.someone');

  const handleAdd = async (emailToAdd: string) => {
    if (!emailToAdd.trim() || pending) return;
    setPending(true);
    setMessage('');
    try {
      const r = await addByEmail(selectedSetId, emailToAdd);
      const name = fullName(r);
      setMessage(r.alreadyCollaborator ? t('share.alreadyHasAccess', { name }) : t('share.added', { name }));
      setEmail('');
      setLookup({ state: 'idle' });
      list(selectedSetId).then(setCollaborators).catch(() => {});
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('share.somethingWentWrong'));
    } finally {
      setPending(false);
    }
  };

  const handleRemove = async (uid: string) => {
    try {
      await remove(selectedSetId, uid);
      list(selectedSetId).then(setCollaborators).catch(() => {});
    } catch {
      // ponytail: best-effort; list refresh on next add reflects truth
    }
  };

  if (sets.length === 0) return null;

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/share/${userId}/${pageNum}?set=${selectedSetId}`
      : `/share/${userId}/${pageNum}?set=${selectedSetId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: do nothing
    }
  };

  const sectionLabel = 'block text-meta font-semibold text-muted uppercase tracking-wider mb-2';

  return (
    <PanelCard testid="share-card" icon={<PanelIcon d={ICON_PATHS.share} />} title={t('share.shareButton')}>
      <div className="p-4">
        {/* Set selector — only when multiple sets exist */}
        {sets.length > 1 && (
          <div className="mb-3">
            <label className={sectionLabel}>{t('share.annotationSet')}</label>
            <select
              value={selectedSetId}
              onChange={e => setSelectedSetId(e.target.value)}
              className="input input-sm w-full cursor-pointer"
            >
              {sets.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Read-only link */}
        <label className={sectionLabel}>{t('share.readOnlyLink')}</label>
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="btn btn-primary w-full justify-center"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            {t('share.createShareLink')}
          </button>
        ) : (
          <div>
            <div className="flex gap-2 mb-2">
              <input
                readOnly
                value={shareUrl}
                aria-label={t('share.shareUrlAriaLabel')}
                className="input input-sm flex-1 font-mono truncate text-micro"
              />
              <button
                onClick={handleCopy}
                className="btn btn-primary btn-sm shrink-0"
              >
                {copied ? <span className="flex items-center gap-1"><Icon name="check" size={13} /> {t('common.copied')}</span> : t('common.copy')}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-micro text-muted">
                {t('share.viewOnlyHintShort')}
              </p>
              <button
                onClick={() => setOpen(false)}
                className="btn btn-ghost btn-xs"
              >
                {t('share.close')}
              </button>
            </div>
          </div>
        )}

        {/* People with edit access — owner-only manage section (contract D1/D3) */}
        {mounted && (
          <div className="mt-4 pt-4 border-t border-neutral-200">
            <label className={sectionLabel}>{t('share.peopleWithEditAccess')}</label>

            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => {
                if (e.key !== 'Enter' || lookup.state !== 'results') return;
                const first = lookup.accounts.find(a => a.id !== userId);
                if (first) handleAdd(first.email);
              }}
              placeholder={t('share.searchByEmailPlaceholder')}
              aria-label={t('share.emailToGrantAccessAriaLabel')}
              disabled={pending}
              className="input input-sm w-full text-caption"
            />

            {/* Matching accounts — pick a row to grant access */}
            {lookup.state === 'searching' && (
              <p className="text-meta text-muted mt-2">{t('share.searching')}</p>
            )}
            {lookup.state === 'results' && (() => {
              const candidates = lookup.accounts.filter(
                a => a.id !== userId && !collaborators.some(c => c.user_id === a.id),
              );
              if (candidates.length === 0) {
                return (
                  <p className="text-meta text-muted mt-2">
                    {t('share.noMatchingAccounts')}
                  </p>
                );
              }
              return (
                <div
                  className="flex flex-col mt-2 rounded-md border border-[var(--border-accent)] overflow-hidden"
                >
                  {candidates.map(a => (
                    <button
                      key={a.id}
                      onClick={() => handleAdd(a.email)}
                      disabled={pending}
                      className="flex items-center gap-2 text-start px-3 py-2 bg-transparent border-b border-subtle cursor-pointer transition-colors hover:bg-accent-muted"
                    >
                      <Avatar seed={fullName(a)} size={28} />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="truncate text-caption font-semibold text-primary">
                          {fullName(a)}
                        </span>
                        <span className="truncate text-micro text-muted">{a.email}</span>
                      </div>
                      <span className="badge shrink-0 text-micro">{t('common.add')}</span>
                    </button>
                  ))}
                </div>
              );
            })()}

            {message && (
              <p className="text-meta text-green-600 mt-2">{message}</p>
            )}

            {collaborators.length > 0 && (
              <ul className="flex flex-col gap-1 mt-3">
                {collaborators.map(c => (
                  <li key={c.user_id} className="flex items-center gap-2">
                    <Avatar seed={fullName(c)} size={26} />
                    <span className="flex-1 truncate text-caption text-primary font-medium">
                      {fullName(c)}
                    </span>
                    <button
                      onClick={() => handleRemove(c.user_id)}
                      className="btn btn-ghost btn-xs shrink-0"
                    >
                      {t('share.remove')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </PanelCard>
  );
}

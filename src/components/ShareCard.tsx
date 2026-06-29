'use client';
import { useEffect, useState } from 'react';
import { addByEmail, list, remove, type Collaborator } from '@/lib/services/collaborators';

interface Props {
  userId: string;
  pageNum: number;
  sets: { id: string; name: string }[];
}

/**
 * V3 Story 14 — Share card.
 * Card chrome matches Notes card: white surface / radius-lg / neutral-200 border / shadow-e1.
 * Full-width green CTA ("Create Share Link") reuses the same share URL generation +
 * clipboard copy logic as ShareButton — the share URL contract is untouched.
 * Button text contains "Share" so `button:has-text("Share")` still matches.
 */
export default function ShareCard({ userId, pageNum, sets }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState(sets[0]?.id ?? '');

  // Edit-access management. ShareCard renders only in the owner's own reader over
  // the owner's own sets (see reader page comment), so this section is inherently
  // owner-only — never shown in any read-only/collaborator/guest view (contract D3).
  const [email, setEmail] = useState('');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  // Client-only: this section's state (email/pending) and its collaborator list are
  // resolved on the client, so rendering it during SSR causes a hydration mismatch on
  // the Add button's `disabled`. Gate it to post-mount — it has no SSR value anyway.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const refreshCollaborators = () => {
    list(selectedSetId).then(setCollaborators).catch(() => {});
  };

  useEffect(() => {
    if (!selectedSetId) return;
    list(selectedSetId).then(setCollaborators).catch(() => setCollaborators([]));
  }, [selectedSetId]);

  const fullName = (c: { first_name?: string; last_name?: string }) =>
    [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || 'Someone';

  const handleAdd = async () => {
    if (!email.trim() || pending) return;
    setPending(true);
    setMessage('');
    try {
      const r = await addByEmail(selectedSetId, email);
      const name = fullName(r);
      setMessage(r.alreadyCollaborator ? `${name} already has access` : `Added ${name}`);
      setEmail('');
      refreshCollaborators();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPending(false);
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await remove(selectedSetId, userId);
      refreshCollaborators();
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
      // fallback: do nothing (same as original ShareButton)
    }
  };

  return (
    <section
      data-testid="share-card"
      style={{
        background: 'var(--surface-main)',
        borderRadius: 'var(--radius-lg-px)',
        border: '1px solid var(--neutral-200)',
        boxShadow: 'var(--shadow-e1)',
        overflow: 'hidden',
      }}
    >
      {/* Card header */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: 'var(--space-16) var(--space-16) var(--space-12)',
          borderBottom: '1px solid var(--neutral-200)',
        }}
      >
        <h2
          className="font-semibold"
          style={{ fontSize: '13px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
        >
          Share
        </h2>
      </div>

      {/* Card body */}
      <div style={{ padding: 'var(--space-16)' }}>
        <p
          style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            lineHeight: '1.5',
            marginBottom: 'var(--space-12)',
          }}
        >
          Generate a read-only link to share your annotations and notes with others.
        </p>

        {/* Set selector — only when multiple sets exist */}
        {sets.length > 1 && (
          <div style={{ marginBottom: 'var(--space-12)' }}>
            <label
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '4px',
              }}
            >
              Annotation Set
            </label>
            <select
              value={selectedSetId}
              onChange={e => setSelectedSetId(e.target.value)}
              className="input input-sm w-full"
              style={{ cursor: 'pointer' }}
            >
              {sets.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Primary CTA — full-width green button */}
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="btn btn-primary w-full"
            style={{ justifyContent: 'center' }}
          >
            <svg
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ flexShrink: 0 }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            Create Share Link
          </button>
        ) : (
          /* Expanded: show URL + copy button, matching original ShareButton flow */
          <div>
            <div
              className="flex gap-2"
              style={{ marginBottom: 'var(--space-8)' }}
            >
              <input
                readOnly
                value={shareUrl}
                aria-label="Share URL"
                className="input input-sm flex-1 font-mono truncate"
                style={{ fontSize: '10px' }}
              />
              <button
                onClick={handleCopy}
                className="btn btn-primary"
                style={{ fontSize: '12px', padding: '6px 14px', flexShrink: 0 }}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              Anyone with this link can view your annotations (read-only).
            </p>
            <button
              onClick={() => setOpen(false)}
              className="btn btn-ghost"
              style={{ marginTop: 'var(--space-8)', fontSize: '11px', padding: '4px 8px' }}
            >
              Close
            </button>
          </div>
        )}

        {/* People with edit access — owner-only manage section (contract D1/D3) */}
        {mounted && (
        <div
          style={{
            marginTop: 'var(--space-16)',
            paddingTop: 'var(--space-16)',
            borderTop: '1px solid var(--neutral-200)',
          }}
        >
          <h3
            className="font-semibold"
            style={{ fontSize: '12px', color: 'var(--text-primary)', marginBottom: 'var(--space-8)' }}
          >
            People with edit access
          </h3>

          <div className="flex gap-2" style={{ marginBottom: 'var(--space-8)' }}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="name@example.com"
              aria-label="Email to grant edit access"
              disabled={pending}
              className="input input-sm flex-1"
              style={{ fontSize: '12px' }}
            />
            <button
              onClick={handleAdd}
              disabled={pending || !email.trim()}
              className="btn btn-primary"
              style={{ fontSize: '12px', padding: '6px 14px', flexShrink: 0 }}
            >
              Add
            </button>
          </div>

          {message && (
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 'var(--space-8)' }}>
              {message}
            </p>
          )}

          {collaborators.length === 0 ? (
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No one yet.</p>
          ) : (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {collaborators.map(c => (
                <li key={c.user_id} className="flex items-center justify-between">
                  <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{fullName(c)}</span>
                  <button
                    onClick={() => handleRemove(c.user_id)}
                    className="btn btn-ghost"
                    style={{ fontSize: '11px', padding: '4px 8px' }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        )}
      </div>
    </section>
  );
}

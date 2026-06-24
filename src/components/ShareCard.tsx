'use client';
import { useState } from 'react';

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
      </div>
    </section>
  );
}

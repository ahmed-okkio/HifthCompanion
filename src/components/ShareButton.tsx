'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  userId: string;
  pageNum: number;
  sets: { id: string; name: string }[];
}

export default function ShareButton({ userId, pageNum, sets }: Props) {
  const [copied, setCopied] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState(sets[0]?.id ?? '');
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  if (sets.length === 0) return null;

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${userId}/${pageNum}?set=${selectedSetId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  };

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || typeof window === 'undefined') {
      if (!open) setMenuPosition(null);
      return;
    }

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const menuWidth = 280;
      const menuHeight = 220;
      const padding = 8;
      const top = Math.min(rect.bottom + padding, window.innerHeight - menuHeight - padding);
      const left = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - padding);

      setMenuPosition({ top: Math.max(padding, top), left: Math.max(padding, left) });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(o => !o)}
        className="btn btn-outline"
        style={{ fontSize: '12px', padding: '6px 14px' }}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        Share
      </button>

      {open && menuPosition && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-label="Share link"
          className="card fixed z-[9999]"
          style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px`, padding: '16px', width: '280px' }}
        >
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Share page {pageNum}
          </p>

          {sets.length > 1 && (
            <div className="mb-3">
              <label className="text-[10px] font-semibold mb-1 block"
                     style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Annotation Set
              </label>
              <select
                value={selectedSetId}
                onChange={e => setSelectedSetId(e.target.value)}
                className="input input-sm w-full"
                style={{ cursor: 'pointer' }}
              >
                {sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-2">
            <input
              readOnly
              value={shareUrl}
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

          <p className="mt-2.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Anyone with this link can view your annotations (read-only).
          </p>
        </div>,
        document.body
      )}
    </div>
  );
}

'use client';

/**
 * Progress — the single pass-progress bar on a wird card (H7). A flex track so
 * the fill anchors to the inline-start edge and flips under [dir="rtl"] (N3);
 * a width-only fill would always grow from the physical left. Colour + radius
 * read from tokens only (M1). No "cycle" wording lives here (H12) — the bar is
 * silent; the card's own line carries "N pages to go".
 */
export default function Progress({ pct, label }: { pct: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        display: 'flex',
        height: 8,
        borderRadius: 'var(--radius-full)',
        background: 'var(--accent-muted)',
        overflow: 'hidden',
      }}
    >
      <span
        aria-hidden
        style={{
          width: `${clamped}%`,
          background: 'var(--accent)',
          borderRadius: 'var(--radius-full)',
          transition: 'width var(--duration-normal) var(--ease-out)',
        }}
      />
    </div>
  );
}

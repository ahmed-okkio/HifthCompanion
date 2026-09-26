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
      className="flex h-2 rounded-full bg-accent-muted overflow-hidden"
    >
      <span
        aria-hidden
        className="bg-accent rounded-full transition-all duration-(--duration-normal) ease-out"
        // eslint-disable-next-line shadcn/no-inline-styles -- runtime progress %
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

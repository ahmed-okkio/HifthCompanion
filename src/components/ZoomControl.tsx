'use client';

/** The floating desktop zoom control (50%–200%, step 10, + reset). Extracted from
 *  AnnotationCanvas so single mode and the M4 spread shell render the same control — in spread
 *  one instance scales BOTH pages (F3). */
export default function ZoomControl({
  zoom,
  onZoomOut,
  onZoomIn,
  onReset,
}: {
  zoom: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onReset: () => void;
}) {
  return (
    <div
      data-testid="zoom-control"
      aria-label="Zoom controls"
      className="hidden lg:flex items-center justify-center"
      style={{
        marginTop: 'var(--space-12)',
        height: '52px',
        background: 'var(--surface-main)',
        borderRadius: 'var(--radius-lg-px)',
        border: '1px solid rgba(15, 23, 42, 0.05)',
        boxShadow: 'var(--shadow-e2)',
        padding: '0 var(--space-8)',
        userSelect: 'none',
      }}
    >
      <button
        type="button"
        aria-label="Zoom out"
        onClick={onZoomOut}
        disabled={zoom <= 50}
        className="flex items-center justify-center"
        style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', cursor: zoom <= 50 ? 'default' : 'pointer', color: 'var(--neutral-600)', fontSize: '20px', fontWeight: 500, opacity: zoom <= 50 ? 0.4 : 1 }}
        onMouseEnter={e => { if (zoom > 50) (e.currentTarget as HTMLButtonElement).style.background = 'var(--neutral-100)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
      >
        −
      </button>

      <span style={{ minWidth: '52px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {zoom}%
      </span>

      <button
        type="button"
        aria-label="Zoom in"
        onClick={onZoomIn}
        disabled={zoom >= 200}
        className="flex items-center justify-center"
        style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', cursor: zoom >= 200 ? 'default' : 'pointer', color: 'var(--neutral-600)', fontSize: '20px', fontWeight: 500, opacity: zoom >= 200 ? 0.4 : 1 }}
        onMouseEnter={e => { if (zoom < 200) (e.currentTarget as HTMLButtonElement).style.background = 'var(--neutral-100)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
      >
        +
      </button>

      <div aria-hidden="true" style={{ width: '1px', height: '24px', background: 'var(--border-subtle)', margin: '0 var(--space-8)' }} />

      <button
        type="button"
        aria-label="Reset zoom"
        onClick={onReset}
        className="flex items-center gap-2"
        style={{ height: '38px', padding: '0 var(--space-12)', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: 'var(--neutral-600)', whiteSpace: 'nowrap' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--neutral-100)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
      >
        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M20 9a8 8 0 00-14.9-3M4 15a8 8 0 0014.9 3" />
        </svg>
        Reset
      </button>
    </div>
  );
}

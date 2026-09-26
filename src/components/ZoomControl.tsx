'use client';
import { useI18n } from '@/components/I18nProvider';

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
  const { t } = useI18n();
  return (
    <div
      data-testid="zoom-control"
      aria-label={t('reader.zoomControls')}
      className="hidden lg:flex items-center justify-center"
      style={{
        marginTop: 'var(--space-12)',
        height: '52px',
        background: 'var(--surface-main)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid rgba(15, 23, 42, 0.05)',
        boxShadow: 'var(--shadow-e2)',
        padding: '0 var(--space-8)',
        userSelect: 'none',
      }}
    >
      <button
        type="button"
        aria-label={t('reader.zoomOut')}
        onClick={onZoomOut}
        disabled={zoom <= 50}
        className="btn btn-ghost btn-icon"
        style={{ fontSize: 20 }}
      >
        −
      </button>

      <span style={{ minWidth: '52px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {zoom}%
      </span>

      <button
        type="button"
        aria-label={t('reader.zoomIn')}
        onClick={onZoomIn}
        disabled={zoom >= 200}
        className="btn btn-ghost btn-icon"
        style={{ fontSize: 20 }}
      >
        +
      </button>

      <div aria-hidden="true" style={{ width: '1px', height: '24px', background: 'var(--border-subtle)', margin: '0 var(--space-8)' }} />

      <button
        type="button"
        aria-label={t('reader.resetZoom')}
        onClick={onReset}
        className="btn btn-ghost"
      >
        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M20 9a8 8 0 00-14.9-3M4 15a8 8 0 0014.9 3" />
        </svg>
        {t('reader.reset')}
      </button>
    </div>
  );
}

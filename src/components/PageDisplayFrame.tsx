'use client';

import type { ReactNode, RefObject } from 'react';
import type { PageCanvasSize } from '@/lib/pageCanvas';

interface Props {
  containerRef: RefObject<HTMLDivElement | null>;
  size: PageCanvasSize | null;
  maxHeightOffset: number;
  children: ReactNode;
  ready?: boolean;
  /** When true, omit mx-auto so the page can be edge-aligned (spread mode). */
  noAutoMargin?: boolean;
  /** Spread mode: 'start' = flush-left, 'end' = flush-right. Overrides noAutoMargin. */
  align?: 'start' | 'end';
}

export default function PageDisplayFrame({ containerRef, size, maxHeightOffset, children, ready, noAutoMargin, align }: Props) {
  const marginClass = align === 'start' ? 'mr-auto ml-0' : align === 'end' ? 'ml-auto mr-0' : noAutoMargin ? '' : 'mx-auto';
  return (
    // V3 Story 11 — warm cream reader-canvas hero. The cream surface (#F6F1D9 via
    // --surface-canvas), radius 24 (--radius-canvas, the one PRD-sanctioned >20 value),
    // 32px padding (--space-32) and the subtle hero shadow (--shadow-canvas) live on THIS
    // outer wrapper so the page reads like the hero. Crucially the padding is provided by the
    // wrapper, NOT subtracted from the size-driven inner frame — so the per-page contain-fit
    // (mobile canvas keeps full column width, desktop fits viewport height with no doc-scroll)
    // and the .page-display-frame canvas-fill guard (frameH ≈ canvasH) are untouched.
    // No bare hex/radius/shadow literals — all tokens.
    <div className={`reader-canvas-hero flex w-fit max-w-full items-center justify-center ${marginClass}`}>
      <div
        ref={containerRef}
        data-canvas-ready={ready ? 'true' : undefined}
        className="page-display-frame flex items-center justify-center overflow-hidden"
        style={{
          position: 'relative',
          // No maxHeight cap: `size` already fits the page to the container per-page (desktop is
          // capped to available height; mobile is full height and scrolls). An inline maxHeight
          // here previously clipped tall mobile pages (it overrode the responsive CSS rule).
          // Pre-size fallback resolves against the viewport (not the shrink-to-fit cream
          // wrapper) so consumers that read this frame's clientWidth before the image loads
          // (ReadOnlyCanvas on the share page) still measure a real column width.
          width: size ? `${size.width}px` : 'clamp(280px, 90vw, 820px)',
          height: size ? `${size.height}px` : 'auto',
          maxWidth: '100%',
          // object-fit: contain — page scales to fit its size box preserving aspect ratio.
          borderRadius: 'var(--radius-page)',
          // Drop shadow under the page so it lifts off the flat workspace background.
          boxShadow: '0 6px 16px rgba(15, 23, 42, 0.10)',
          objectFit: 'contain',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'var(--radius-page)',
            background: 'linear-gradient(90deg, rgba(15,23,42,0.04) 0%, rgba(15,23,42,0.08) 50%, rgba(15,23,42,0.04) 100%)',
            backgroundSize: '200% 100%',
            animation: ready ? 'none' : 'shimmer 1.4s linear infinite',
            opacity: ready ? 0 : 1,
            pointerEvents: 'none',
            transition: 'opacity 0.25s ease',
          }}
        />
        {/* Page animates in once the canvas is ready: skeleton (above) fades out, page fades +
            scales up. */}
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: ready ? 1 : 0,
            transform: ready ? 'scale(1)' : 'scale(0.985)',
            transition: 'opacity 0.35s ease, transform 0.35s var(--ease-out, ease)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

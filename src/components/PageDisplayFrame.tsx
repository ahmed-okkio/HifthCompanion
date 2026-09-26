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
  /** Spread mode: drop the per-page shadow — it bleeds across the gutter onto the neighbor page
   *  now that the slots don't clip. The whole book gets one shadow on the shared row instead. */
  noShadow?: boolean;
}

export default function PageDisplayFrame({ containerRef, size, maxHeightOffset, children, ready, noAutoMargin, align, noShadow }: Props) {
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
        className={`page-display-frame relative flex max-w-full items-center justify-center overflow-hidden rounded-page object-contain ${noShadow ? '' : 'shadow-page'}`}
        style={{
          // No maxHeight cap: `size` already fits the page to the container per-page (desktop is
          // capped to available height; mobile is full height and scrolls). An inline maxHeight
          // here previously clipped tall mobile pages (it overrode the responsive CSS rule).
          // Pre-size fallback resolves against the viewport (not the shrink-to-fit cream
          // wrapper) so consumers that read this frame's clientWidth before the image loads
          // (ReadOnlyCanvas on the share page) still measure a real column width.
          // eslint-disable-next-line shadcn/no-inline-styles -- runtime page size
          width: size ? `${size.width}px` : 'clamp(280px, 90vw, 820px)',
          // eslint-disable-next-line shadcn/no-inline-styles -- runtime page size
          height: size ? `${size.height}px` : 'auto',
        }}
      >
        <div
          aria-hidden
          // Fade OUT smoothly when the page is ready; appear INSTANTLY when a swap starts
          // (ready→false) so a fast/cached page change still flashes the skeleton.
          className={`pointer-events-none absolute inset-0 rounded-page skeleton ${
            ready ? 'animate-none opacity-0 transition-opacity duration-250' : 'opacity-100 transition-none'
          }`}
        />
        {/* Page fades in once the canvas is ready; skeleton (above) fades out. No scale — the
            frame keeps its size the whole time so the page never appears to grow on swap. */}
        {/* Fade IN when ready; hide instantly on swap start so the skeleton shows at once. */}
        <div
          className={`flex h-full w-full items-center justify-center ${ready ? 'opacity-100 transition-opacity duration-350' : 'opacity-0 transition-none'}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

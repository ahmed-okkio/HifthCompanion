'use client';

import type { ReactNode, RefObject } from 'react';
import type { PageCanvasSize } from '@/lib/pageCanvas';

interface Props {
  containerRef: RefObject<HTMLDivElement | null>;
  size: PageCanvasSize | null;
  maxHeightOffset: number;
  children: ReactNode;
  ready?: boolean;
}

export default function PageDisplayFrame({ containerRef, size, maxHeightOffset, children, ready }: Props) {
  return (
    <div
      ref={containerRef}
      data-canvas-ready={ready ? 'true' : undefined}
      className="page-display-frame mx-auto flex items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #fff 0%, #fbfaf6 100%)',
        borderRadius: '24px',
        border: '1px solid rgba(15,23,42,0.08)',
        boxShadow: '0 24px 70px rgba(15,23,42,0.12), 0 0 0 8px rgba(255,255,255,0.44)',
        maxHeight: `calc(100dvh - ${maxHeightOffset}px)`,
        width: size ? `${size.width}px` : '100%',
        height: size ? `${size.height}px` : 'auto',
        maxWidth: '100%',
      }}
    >
      {children}
    </div>
  );
}

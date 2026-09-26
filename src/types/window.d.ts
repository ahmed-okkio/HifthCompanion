import type { fabric } from 'fabric';

// Globals the annotation canvas publishes on `window`: cross-instance coordination
// (skeletons, reader savers/flush) and hooks the E2E suite reads.
declare global {
  interface Window {
    fabricCanvas?: fabric.Canvas;
    __hifthCanvasByPage?: Record<number, fabric.Canvas>;
    __hifthFabricCreatedCount?: number;
    __hifthCanvasSkeletons?: Set<() => void>;
    __hifthReaderSavers?: Set<() => Promise<void>>;
    __hifthFlushReaderCanvas?: () => Promise<void>;
    __annotationTool?: string;
  }
}

export {};

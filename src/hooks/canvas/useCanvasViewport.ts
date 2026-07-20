import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { fabric } from 'fabric';
import { calculatePageCanvasSize, type PageCanvasSize } from '@/lib/pageCanvas';

const SHARPNESS = 1.5;
const MAX_PIXEL_RATIO = 3;
const PAGE_BOTTOM_GAP = 92;
const FALLBACK_PAGE_OFFSET = 200;

function applyHiQ(canvas: fabric.Canvas): void {
  const ctx = canvas.getContext();
  if (ctx) ctx.imageSmoothingQuality = 'high';
  const topCtx = (canvas as unknown as { getSelectionContext?: () => CanvasRenderingContext2D | null }).getSelectionContext?.();
  if (topCtx) topCtx.imageSmoothingQuality = 'high';
}

function pageBackingRatio(natW: number, fitW: number, zoom: number): number {
  const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const target = zoom * dpr * SHARPNESS;
  const nativeCap = fitW > 0 ? natW / fitW : target;
  return Math.min(MAX_PIXEL_RATIO, Math.max(dpr, Math.min(target, nativeCap)));
}

interface UseCanvasViewportProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  fabricRef: React.MutableRefObject<fabric.Canvas | null>;
  naturalSizeRef: React.MutableRefObject<{ w: number; h: number }>;
}

export function useCanvasViewport({ containerRef, wrapperRef, canvasRef, fabricRef, naturalSizeRef }: UseCanvasViewportProps) {
  const [canvasSize, setCanvasSize] = useState<PageCanvasSize | null>(null);
  const [pageMaxHeightOffset, setPageMaxHeightOffset] = useState(FALLBACK_PAGE_OFFSET);
  
  const displayZoomRef = useRef(1);
  const backingRatioRef = useRef(1);

  const measurePageOffset = useCallback(() => {
    const frame = containerRef.current;
    const main = frame?.closest('main') as HTMLElement | null;
    const centered = frame?.closest('[data-canvas-centered]') as HTMLElement | null;
    let anchor: HTMLElement | null = (centered?.firstElementChild as HTMLElement | null) ?? null;
    if (!anchor) {
      for (let el = frame?.parentElement ?? null; el; el = el.parentElement) {
        if (el.matches('[data-page-column]')) anchor = el;
      }
    }
    if (frame && main && anchor && main.clientHeight > 0) {
      const chromeAbove = frame.getBoundingClientRect().top - anchor.getBoundingClientRect().top;
      const avail = main.clientHeight - chromeAbove - PAGE_BOTTOM_GAP;
      const offset = Math.round(window.innerHeight - Math.max(320, avail));
      setPageMaxHeightOffset(offset);
      return offset;
    }
    const top = frame ? frame.getBoundingClientRect().top : 0;
    const offset = top > 0 ? Math.round(top) + PAGE_BOTTOM_GAP : FALLBACK_PAGE_OFFSET;
    setPageMaxHeightOffset(offset);
    return offset;
  }, [containerRef]);

  const computeFitSize = useCallback((natW: number, natH: number): PageCanvasSize => {
    const slot = containerRef.current?.closest('[data-page-slot]') as HTMLElement | null;
    const wrapperWidth = slot?.clientWidth || wrapperRef.current?.clientWidth || window.innerWidth - 72;
    const isMobile = window.innerWidth < 1024;
    const availableHeight = isMobile ? 100000 : Math.max(320, window.innerHeight - measurePageOffset());
    return calculatePageCanvasSize(natW || 827, natH || 1158, wrapperWidth, availableHeight, 1);
  }, [measurePageOffset, containerRef, wrapperRef]);

  const sizeCanvasForImage = useCallback((canvas: fabric.Canvas, natW: number, natH: number): PageCanvasSize => {
    naturalSizeRef.current = { w: natW, h: natH };
    const fit = computeFitSize(natW, natH);
    setCanvasSize(fit);
    backingRatioRef.current = pageBackingRatio(natW, fit.width, displayZoomRef.current);
    (fabric as unknown as { devicePixelRatio: number }).devicePixelRatio = backingRatioRef.current;
    canvas.setDimensions({ width: fit.width, height: fit.height });
    applyHiQ(canvas);
    if (canvasRef.current) {
      canvasRef.current.style.width = `${fit.width}px`;
      canvasRef.current.style.height = `${fit.height}px`;
    }
    return fit;
  }, [computeFitSize, canvasRef, naturalSizeRef]);

  const applyBackingForZoom = useCallback((zoom: number) => {
    displayZoomRef.current = zoom;
    const canvas = fabricRef.current;
    if (!canvas) return;
    const { w: natW } = naturalSizeRef.current;
    const w = canvas.getWidth();
    const h = canvas.getHeight();
    const ratio = pageBackingRatio(natW, w, zoom);
    if (Math.abs(backingRatioRef.current - ratio) < 0.01) return;
    backingRatioRef.current = ratio;
    (fabric as unknown as { devicePixelRatio: number }).devicePixelRatio = ratio;
    canvas.setDimensions({ width: w, height: h });
    applyHiQ(canvas);
    try { canvas.requestRenderAll(); } catch { /* disposed */ }
  }, [fabricRef, naturalSizeRef]);

  const rescaleObjects = useCallback((canvas: fabric.Canvas, ratio: number) => {
    if (!ratio || ratio === 1 || !isFinite(ratio)) return;
    canvas.getObjects().forEach((o) => {
      o.set({
        left: (o.left ?? 0) * ratio,
        top: (o.top ?? 0) * ratio,
        scaleX: (o.scaleX ?? 1) * ratio,
        scaleY: (o.scaleY ?? 1) * ratio,
      });
      o.setCoords();
    });
  }, []);

  useLayoutEffect(() => {
    if (canvasRef.current && containerRef.current) setCanvasSize(prev => prev ?? computeFitSize(0, 0));
  }, [computeFitSize, canvasRef, containerRef]);

  useEffect(() => {
    measurePageOffset();
    window.addEventListener('resize', measurePageOffset);
    return () => window.removeEventListener('resize', measurePageOffset);
  }, [measurePageOffset]);

  return {
    canvasSize,
    setCanvasSize,
    pageMaxHeightOffset,
    displayZoomRef,
    backingRatioRef,
    measurePageOffset,
    computeFitSize,
    sizeCanvasForImage,
    applyBackingForZoom,
    rescaleObjects,
    applyHiQ,
    pageBackingRatio,
  };
}

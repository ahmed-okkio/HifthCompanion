'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { AnnotationSet } from '@/types';
import { CanvasHistory } from '@/lib/canvasHistory';
import { getToolCursor } from '@/lib/canvasTools';

import { useToolState, useCanvasTools, type ToolState } from './canvas/useCanvasTools';
import { useCanvasViewport } from './canvas/useCanvasViewport';
import { useCanvasPersistence, lockMark } from './canvas/useCanvasPersistence';

export type { ToolState };
export { useToolState };

interface UseAnnotationCanvasProps {
  pageNum: number;
  imageUrl: string;
  sets: Pick<AnnotationSet, 'id' | 'name'>[];
  user: { id: string } | null;
  /** Collaborator (locked-set) mode: a save rejected by RLS means access was revoked. */
  lockedSet?: boolean;
  /** M4 spread mode: external tool state shared across both canvases (F2). Omit ⇒ own state. */
  tools?: ToolState;
  /** M4 spread mode: fires ONCE per committed user action so the shell controller can record
   *  which canvas it hit, building the unified undo ordering (F4). Not called for the baseline
   *  load snapshot. */
  onCommit?: () => void;
  /** PRD 0009 R3: fired after a successful save with the page's new mark count
   *  (objects.length; 0 on the empty-delete path). Lets the reader patch the Marked
   *  tab in place without refetching. */
  onSaved?: (setId: string, page: number, count: number) => void;
}

export function useAnnotationCanvas({ pageNum, imageUrl, sets, user, lockedSet = false, tools, onCommit, onSaved }: UseAnnotationCanvasProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const historyRef = useRef<CanvasHistory | null>(null);
  
  const loadedKeyRef = useRef<{ setId: string; page: number } | null>(null);
  const naturalSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const pageNumRef = useRef(pageNum);
  const imageUrlRef = useRef(imageUrl);
  pageNumRef.current = pageNum;
  imageUrlRef.current = imageUrl;

  const [selectedSetId, setSelectedSetId] = useState<string>(() => searchParams.get('set') ?? sets[0]?.id ?? '');
  const [canvasReady, setCanvasReady] = useState(false);

  const internalTools = useToolState();
  const resolvedTools = tools ?? internalTools;
  const { activeTool, setActiveTool, activeColor, setActiveColor, opacity, setOpacity, penWidth, setPenWidth, eraserSize, setEraserSize } = resolvedTools;

  useEffect(() => {
    const setFromUrl = searchParams.get('set');
    if (setFromUrl && setFromUrl !== selectedSetId) {
      setSelectedSetId(setFromUrl);
      return;
    }
    if (!setFromUrl && !selectedSetId && sets[0]?.id) {
      setSelectedSetId(sets[0].id);
    }
  }, [searchParams, selectedSetId, sets]);

  const viewport = useCanvasViewport({ containerRef, wrapperRef, canvasRef, fabricRef, naturalSizeRef });
  
  const persistence = useCanvasPersistence({
    pageNum, imageUrl, user, selectedSetId, lockedSet, onCommit, onSaved,
    fabricRef, historyRef, setCanvasReady,
    sizeCanvasForImage: viewport.sizeCanvasForImage,
    rescaleObjects: viewport.rescaleObjects,
    loadedKeyRef,
  });

  const canvasTools = useCanvasTools({
    fabricRef, tools: resolvedTools, user, selectedSetId, pageNum,
    commit: persistence.commit, saveNow: persistence.saveNow, canvasReady
  });

  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  const updateSelectedSetInUrl = useCallback((setId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (setId) params.set('set', setId);
    else params.delete('set');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [searchParams, router, pathname]);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    let isMounted = true;
    const img = new Image();
    img.src = imageUrlRef.current;
    let canvas: fabric.Canvas | null = null;

    img.onload = async () => {
      if (!isMounted) return;
      const natW = img.naturalWidth || 1;
      const natH = img.naturalHeight || 1;
      naturalSizeRef.current = { w: natW, h: natH };
      const fitSize = viewport.computeFitSize(natW, natH);
      viewport.setCanvasSize(fitSize);

      viewport.backingRatioRef.current = viewport.pageBackingRatio(natW, fitSize.width, viewport.displayZoomRef.current);
      (fabric as unknown as { devicePixelRatio: number }).devicePixelRatio = viewport.backingRatioRef.current;

      canvas = new fabric.Canvas(canvasRef.current!, {
        width: fitSize.width,
        height: fitSize.height,
        enableRetinaScaling: true,
        imageSmoothingEnabled: true,
        isDrawingMode: !!user && !!selectedSetId && activeTool === 'pen',
        defaultCursor: getToolCursor(activeTool),
        hoverCursor: getToolCursor(activeTool),
        moveCursor: getToolCursor(activeTool),
        freeDrawingCursor: getToolCursor('pen'),
      });
      canvas.setDimensions({ width: fitSize.width, height: fitSize.height });
      viewport.applyHiQ(canvas);
      if (canvasRef.current) {
        canvasRef.current.style.width = `${fitSize.width}px`;
        canvasRef.current.style.height = `${fitSize.height}px`;
      }
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.width = penWidth;
      canvas.freeDrawingBrush.color = activeColor;
      fabricRef.current = canvas;
      historyRef.current = new CanvasHistory(canvas);
      
      // @ts-ignore
      window.fabricCanvas = canvas;
      ((window as any).__hifthCanvasByPage ??= {})[pageNumRef.current] = canvas;
      (window as any).__hifthFabricCreatedCount = ((window as any).__hifthFabricCreatedCount ?? 0) + 1;

      canvas.on('before:render', () => {
        if (!canvas) return;
        (fabric as unknown as { devicePixelRatio: number }).devicePixelRatio = viewport.backingRatioRef.current;
        viewport.applyHiQ(canvas);
      });

      await persistence.applyBackground(canvas, imageUrlRef.current);

      if (selectedSetId && isMounted) {
        loadedKeyRef.current = { setId: selectedSetId, page: pageNumRef.current };
        persistence.loadAnnotation(canvas, selectedSetId, pageNumRef.current);
      } else {
        historyRef.current.snapshot();
        persistence.refreshHistory();
        setCanvasReady(true);
      }

      const handleCompletedDraw = (e: fabric.IEvent) => {
        const path = (e as any).path as fabric.Object | undefined;
        if (path && activeToolRef.current === 'highlighter') {
          path.set({ strokeLineCap: 'round', strokeLineJoin: 'round' });
          (path as any).globalCompositeOperation = 'multiply';
        }
        persistence.commitRef.current();
        void persistence.saveNowRef.current();
      };
      canvas.on('path:created', handleCompletedDraw);
      canvas.on('object:modified', () => { persistence.commitRef.current(); persistence.scheduleSaveRef.current(); });
      canvas.on('object:removed', () => { persistence.commitRef.current(); persistence.scheduleSaveRef.current(); });
      canvas.on('object:added', (e) => { persistence.commitRef.current(); lockMark(e.target); });
    };

    const ro = new ResizeObserver(() => {
      const c = fabricRef.current;
      const { w, h } = naturalSizeRef.current;
      if (!c || !w || !h) return;
      const prevW = c.getWidth();
      const fitSize = viewport.sizeCanvasForImage(c, w, h);
      viewport.rescaleObjects(c, prevW ? fitSize.width / prevW : 1);
      const bg = c.backgroundImage as fabric.Image | undefined;
      if (bg && typeof bg.scaleToWidth === 'function') bg.scaleToWidth(fitSize.width);
      c.renderAll();
    });
    if (wrapperRef.current) ro.observe(wrapperRef.current);

    return () => {
      isMounted = false;
      ro.disconnect();
      if ((window as any).fabricCanvas === fabricRef.current) delete (window as any).fabricCanvas;
      if (fabricRef.current) { fabricRef.current.dispose(); fabricRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, persistence.applyBackground]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !selectedSetId) return;

    const prev = loadedKeyRef.current;
    const changed = !prev || prev.setId !== selectedSetId || prev.page !== pageNum;
    loadedKeyRef.current = { setId: selectedSetId, page: pageNum };

    const run = async () => {
      if (changed && prev) {
        // Flush the OUTGOING page under its own key. saveNow() is bound to the new
        // pageNum while the canvas still holds the old page's objects — using it here
        // writes the previous page's marks onto the incoming page.
        if (user && prev.setId) await persistence.saveCanvas(canvas, prev.setId, prev.page);
      }
      await persistence.loadAnnotation(canvas, selectedSetId, pageNum);
    };
    void run();
  }, [selectedSetId, pageNum, persistence.loadAnnotation, persistence.saveCanvas, user]);

  return {
    containerRef, wrapperRef, canvasRef, fabricRef,
    selectedSetId, saving: persistence.saving, accessRevoked: persistence.accessRevoked,
    activeTool, activeColor, opacity, penWidth, eraserSize,
    canUndo: persistence.canUndo, canRedo: persistence.canRedo,
    canvasReady, canvasSize: viewport.canvasSize, pageMaxHeightOffset: viewport.pageMaxHeightOffset,
    hoveredTool: canvasTools.hoveredTool, hoverPos: canvasTools.hoverPos,
    interactionMode: canvasTools.interactionMode, setInteractionMode: canvasTools.setInteractionMode,
    setSelectedSetId, setActiveColor, setOpacity, setPenWidth, setEraserSize,
    handleUndo: persistence.handleUndo, handleRedo: persistence.handleRedo,
    handleClear: persistence.handleClear, handleToolClick: canvasTools.handleToolClick,
    updateSelectedSetInUrl,
    onHoverEnter: canvasTools.onHoverEnter, onHoverLeave: canvasTools.onHoverLeave, onHoverCancelLeave: canvasTools.onHoverCancelLeave,
    applyBackingForZoom: viewport.applyBackingForZoom,
    beginPageNav: () => {
      const set = (window as any).__hifthCanvasSkeletons as Set<() => void> | undefined;
      if (set && set.size) set.forEach(fn => fn());
      else persistence.scheduleSkeleton();
    },
  };
}

'use client';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { fabric } from 'fabric';
import { createClient } from '@/lib/supabase/client';
import type { AnnotationSet } from '@/types';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { calculatePageCanvasSize, type PageCanvasSize } from '@/lib/pageCanvas';
import { CanvasHistory } from '@/lib/canvasHistory';
import { type Tool, getToolCursor } from '@/lib/canvasTools';

const SAVE_DELAY_MS = 1500;
// Bottom breathing room below the page-display-frame inside the desktop app-shell.
const PAGE_BOTTOM_GAP = 24;
// Fallback offset before the chrome above the page can be measured (≈ nav + padding + set-picker).
const FALLBACK_PAGE_OFFSET = 200;

interface UseAnnotationCanvasProps {
  pageNum: number;
  imageUrl: string;
  sets: Pick<AnnotationSet, 'id' | 'name'>[];
  user: { id: string } | null;
}

export function useAnnotationCanvas({ pageNum, imageUrl, sets, user }: UseAnnotationCanvasProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const historyRef = useRef<CanvasHistory | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeLoadSetIdRef = useRef<string | null>(null);
  const lastLoadedRef = useRef<{ setId: string; pageNum: number } | null>(null);
  // Tracks the (set, page) currently rendered into the live canvas so the soft-swap effect
  // can flush the OUTGOING page before loading the next one (Story 24).
  const loadedKeyRef = useRef<{ setId: string; page: number } | null>(null);
  const lastSnapshotAtRef = useRef<number>(0);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supabase = useMemo(() => createClient(), []);

  // Live refs so the mount-only init effect can read the current page/image without
  // re-running (and disposing the Fabric instance) on every page change. The page swap
  // is handled by the separate load effect below, which keeps the same canvas alive.
  const pageNumRef = useRef(pageNum);
  const imageUrlRef = useRef(imageUrl);
  pageNumRef.current = pageNum;
  imageUrlRef.current = imageUrl;

  const [selectedSetId, setSelectedSetId] = useState<string>(() => searchParams.get('set') ?? sets[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [activeTool, setActiveTool] = useState<Tool>('pen');
  const [activeColor, setActiveColor] = useState<string>('#ef4444');
  const [opacity, setOpacity] = useState<number>(0.4);
  const [penWidth, setPenWidth] = useState<number>(6);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [canvasSize, setCanvasSize] = useState<PageCanvasSize | null>(null);
  const [pageMaxHeightOffset, setPageMaxHeightOffset] = useState(FALLBACK_PAGE_OFFSET);
  const [hoveredTool, setHoveredTool] = useState<Tool | null>(null);
  const [hoverPos, setHoverPos] = useState<{ top: number; left: number } | null>(null);

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

  // Distance (px) from the viewport top to the bottom limit available to the page-display-frame:
  // the frame's own top offset (covers fixed nav + main padding + set-picker chrome) plus a gap.
  // Falls back to a constant before the frame is mounted/positioned. Also syncs state so the
  // frame's CSS maxHeight tracks the same value used to size the canvas.
  const measurePageOffset = useCallback(() => {
    const frame = containerRef.current;
    const top = frame ? frame.getBoundingClientRect().top : 0;
    const offset = top > 0 ? Math.round(top) + PAGE_BOTTOM_GAP : FALLBACK_PAGE_OFFSET;
    setPageMaxHeightOffset(offset);
    return offset;
  }, []);

  const refreshHistory = useCallback(() => {
    const h = historyRef.current;
    if (h) {
      setCanUndo(h.canUndo());
      setCanRedo(h.canRedo());
    }
  }, []);

  const applyBackground = useCallback((canvas: fabric.Canvas, url: string, width: number) => {
    return new Promise<void>((resolve) => {
      fabric.Image.fromURL(url, (fbImg) => {
        fbImg.scaleToWidth(width);
        canvas.setBackgroundImage(fbImg, () => {
          try { canvas.renderAll(); } catch { /* canvas disposed between request and callback */ }
          resolve();
        });
      }, { crossOrigin: 'anonymous' });
    });
  }, []);

  const saveCanvas = useCallback(async (canvas: fabric.Canvas, setId: string, page: number) => {
    if (!user || !setId) return;
    setSaving(true);
    try {
      const json = canvas.toJSON();
      delete (json as any).backgroundImage;
      const canvasJson = { width: canvas.getWidth(), height: canvas.getHeight(), ...json };
      const { error } = await supabase.from('annotations').upsert(
        { set_id: setId, page_number: page, canvas_json: canvasJson, updated_at: new Date().toISOString() },
        { onConflict: 'set_id,page_number' }
      );
      if (error) console.error('[AnnotationCanvas] Save error:', error);
      else console.log('Save successful');
    } catch (err) {
      console.error('[AnnotationCanvas] Unexpected save error:', err);
    } finally {
      setSaving(false);
    }
  }, [user, supabase]);

  const scheduleSave = useCallback(() => {
    if (!user || !selectedSetId || !fabricRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveCanvas(fabricRef.current!, selectedSetId, pageNum);
    }, SAVE_DELAY_MS);
  }, [selectedSetId, pageNum, saveCanvas, user]);

  const saveNow = useCallback(async () => {
    if (!user || !selectedSetId || !fabricRef.current) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await saveCanvas(fabricRef.current, selectedSetId, pageNum);
  }, [pageNum, saveCanvas, selectedSetId, user]);

  useEffect(() => {
    (window as any).__hifthFlushReaderCanvas = saveNow;
    return () => {
      if ((window as any).__hifthFlushReaderCanvas === saveNow) {
        delete (window as any).__hifthFlushReaderCanvas;
      }
    };
  }, [saveNow]);

  const loadAnnotation = useCallback(async (canvas: fabric.Canvas, setId: string, page: number) => {
    if (lastLoadedRef.current?.setId === setId && lastLoadedRef.current?.pageNum === page) return;
    activeLoadSetIdRef.current = setId;
    setCanvasReady(false);

    const { data, error } = await supabase
      .from('annotations').select('canvas_json')
      .eq('set_id', setId).eq('page_number', page).maybeSingle();

    if (activeLoadSetIdRef.current !== setId) return;
    if (error) { console.error('[AnnotationCanvas] Load error:', error); return; }

    if (data?.canvas_json) {
      canvas.loadFromJSON(data.canvas_json, async () => {
        if (activeLoadSetIdRef.current !== setId) return;
        if (containerRef.current) await applyBackground(canvas, imageUrl, canvas.getWidth());
        historyRef.current?.clear();
        historyRef.current?.snapshot();
        refreshHistory();
        lastLoadedRef.current = { setId, pageNum: page };
        setCanvasReady(true);
      });
    } else {
      canvas.clear();
      if (containerRef.current) await applyBackground(canvas, imageUrl, canvas.getWidth());
      historyRef.current?.clear();
      historyRef.current?.snapshot();
      refreshHistory();
      lastLoadedRef.current = { setId, pageNum: page };
      setCanvasReady(true);
    }
  }, [supabase, imageUrl, applyBackground, refreshHistory]);

  // Canvas init + resize.
  // Story 24 (soft page swap): this effect creates/disposes the Fabric instance ONCE
  // (mount/unmount + auth change only). Page navigation does NOT re-run it — the separate
  // load effect below swaps the background image + objects into the SAME canvas instance,
  // so changing pages no longer tears down and recreates Fabric (the old "reload" flash).
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    let isMounted = true;
    setCanvasSize(null);
    const img = new Image();
    img.src = imageUrlRef.current;
    let naturalWidth = 0;
    let naturalHeight = 0;
    let canvas: fabric.Canvas | null = null;

    // Measure stable wrapper (grid cell), not the frame — frame size is derived from this calculation
    const computeFitSize = () => {
      const wrapperWidth = wrapperRef.current?.clientWidth || window.innerWidth - 72;
      // Desktop: cap available height so the page fits in the fixed app-shell without scrolling.
      // Mobile (< 1024px): document-flow model — no height cap; canvas fills available width at
      // natural aspect ratio and the user scrolls vertically (Story 8).
      const isMobile = window.innerWidth < 1024;
      const offset = measurePageOffset();
      const availableHeight = isMobile ? 99999 : Math.max(320, window.innerHeight - offset);
      return calculatePageCanvasSize(
        naturalWidth, naturalHeight,
        Math.max(280, wrapperWidth),
        availableHeight,
      );
    };

    img.onload = async () => {
      if (!isMounted) return;
      naturalWidth = img.naturalWidth || 1;
      naturalHeight = img.naturalHeight || 1;
      const fitSize = computeFitSize();
      setCanvasSize(fitSize);

      canvas = new fabric.Canvas(canvasRef.current!, {
        width: fitSize.width,
        height: fitSize.height,
        isDrawingMode: !!user && !!selectedSetId && activeTool === 'pen',
        defaultCursor: getToolCursor(activeTool),
        hoverCursor: getToolCursor(activeTool),
        moveCursor: getToolCursor(activeTool),
        freeDrawingCursor: getToolCursor('pen'),
      });
      canvas.setDimensions({ width: fitSize.width, height: fitSize.height });
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
      // Soft-swap proof (Story 24): increment a window counter every time a Fabric
      // instance is actually CREATED. Page navigation must reuse the instance, so this
      // value stays stable across prev/next/jump/surah-select to a different page.
      (window as any).__hifthFabricCreatedCount = ((window as any).__hifthFabricCreatedCount ?? 0) + 1;

      await applyBackground(canvas, imageUrlRef.current, fitSize.width);

      if (selectedSetId && isMounted) {
        loadedKeyRef.current = { setId: selectedSetId, page: pageNumRef.current };
        loadAnnotation(canvas, selectedSetId, pageNumRef.current);
      } else {
        historyRef.current.snapshot();
        refreshHistory();
        setCanvasReady(true);
      }

      const snapshotWithDebounce = (force = false) => {
        const now = Date.now();
        if (!force && now - lastSnapshotAtRef.current < 120) return;
        lastSnapshotAtRef.current = now;
        historyRef.current?.snapshot();
        refreshHistory();
      };

      const handleCompletedDraw = () => { snapshotWithDebounce(); void saveNow(); };
      canvas.on('path:created', handleCompletedDraw);
      canvas.on('object:modified', () => { snapshotWithDebounce(); scheduleSave(); });
      canvas.on('object:removed', () => { snapshotWithDebounce(); scheduleSave(); });
      canvas.on('object:added', () => { snapshotWithDebounce(); });
    };

    const ro = new ResizeObserver(() => {
      if (!naturalWidth || !naturalHeight || !canvas) return;
      const fitSize = computeFitSize();
      setCanvasSize(fitSize);
      canvas.setDimensions({ width: fitSize.width, height: fitSize.height });
      if (canvasRef.current) {
        canvasRef.current.style.width = `${fitSize.width}px`;
        canvasRef.current.style.height = `${fitSize.height}px`;
      }
      void applyBackground(canvas, imageUrlRef.current, fitSize.width);
      canvas.renderAll();
    });
    if (wrapperRef.current) ro.observe(wrapperRef.current);

    return () => {
      isMounted = false;
      ro.disconnect();
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        if (fabricRef.current && selectedSetId) saveCanvas(fabricRef.current, selectedSetId, pageNumRef.current);
      }
      lastLoadedRef.current = null;
      if ((window as any).fabricCanvas === fabricRef.current) delete (window as any).fabricCanvas;
      if (fabricRef.current) { fabricRef.current.dispose(); fabricRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, applyBackground]);

  // Keep the page-fit offset measured so the frame's CSS maxHeight tracks the chrome above it.
  useEffect(() => {
    measurePageOffset();
    window.addEventListener('resize', measurePageOffset);
    return () => window.removeEventListener('resize', measurePageOffset);
  }, [measurePageOffset]);

  // Sync drawing mode + brush when tool/color/width changes
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.isDrawingMode = !!user && !!selectedSetId && activeTool === 'pen';
    const cursor = getToolCursor(activeTool);
    canvas.defaultCursor = cursor;
    canvas.hoverCursor = cursor;
    canvas.moveCursor = cursor;
    canvas.freeDrawingCursor = cursor;
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = activeColor;
      canvas.freeDrawingBrush.width = penWidth;
    }
    canvas.renderAll();
  }, [activeTool, activeColor, penWidth, user, selectedSetId]);

  // Eraser
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const handleEraserMouseDown = (opt: fabric.IEvent) => {
      if (activeTool !== 'eraser') return;
      const target = opt.target || canvas.findTarget(opt.e, false);
      if (target) {
        canvas.remove(target);
        canvas.discardActiveObject();
        canvas.renderAll();
        historyRef.current?.snapshot();
        refreshHistory();
        void saveNow();
      }
    };
    if (activeTool === 'eraser') {
      canvas.on('mouse:down', handleEraserMouseDown);
      canvas.selection = false;
    } else {
      canvas.selection = true;
    }
    return () => { canvas.off('mouse:down', handleEraserMouseDown); };
  }, [activeTool, refreshHistory, saveNow]);

  // Soft page/set swap (Story 24): when the route re-renders with a new page (or the user
  // switches set), the Fabric instance is NOT disposed — we flush any pending edits of the
  // OUTGOING (set, page) to its own page number, then load the new page's background image +
  // canvas_json into the existing canvas. This replaces the old dispose/recreate flash.
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !selectedSetId) return;

    const prev = loadedKeyRef.current;
    const changed = !prev || prev.setId !== selectedSetId || prev.page !== pageNum;
    loadedKeyRef.current = { setId: selectedSetId, page: pageNum };

    const run = async () => {
      // Flush the outgoing page first so a pending debounce/edit is not lost when we
      // swap objects in place (no dispose-time save fires any more on page change).
      if (changed && prev) {
        if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
        if (user && prev.setId) await saveCanvas(canvas, prev.setId, prev.page);
      }
      await loadAnnotation(canvas, selectedSetId, pageNum);
    };
    void run();
  }, [selectedSetId, pageNum, loadAnnotation, saveCanvas, user]);

  // Shape + text drawing
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    (window as any).__annotationTool = activeTool;
    let isDrawing = false;
    let shape: fabric.Object | null = null;
    let startX = 0;
    let startY = 0;

    const handleMouseDown = (opt: fabric.IEvent) => {
      if (activeTool === 'pen' || activeTool === 'eraser') return;
      if (activeTool === 'text') {
        const pointer = canvas.getPointer(opt.e);
        const text = new fabric.IText('Type here', {
          left: pointer.x, top: pointer.y,
          fontSize: 18, fill: activeColor,
          fontFamily: 'sans-serif', editable: true,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        canvas.renderAll();
        historyRef.current?.snapshot();
        refreshHistory();
        void saveNow();
        return;
      }
      const pointer = canvas.getPointer(opt.e);
      isDrawing = true;
      startX = pointer.x;
      startY = pointer.y;
      if (activeTool === 'highlighter') {
        shape = new fabric.Rect({ left: startX, top: startY, width: 0, height: 0, fill: activeColor, opacity, selectable: false, hasBorders: false, hasControls: false });
      } else if (activeTool === 'circle') {
        shape = new fabric.Ellipse({ left: startX, top: startY, rx: 0, ry: 0, fill: 'transparent', stroke: activeColor, strokeWidth: 2, selectable: false, hasBorders: false, hasControls: false });
      } else if (activeTool === 'underline') {
        shape = new fabric.Line([startX, startY, startX, startY], { stroke: activeColor, strokeWidth: 2, selectable: false, hasBorders: false, hasControls: false });
      }
      if (shape) { canvas.add(shape); canvas.setActiveObject(shape); }
    };

    const handleMouseMove = (opt: fabric.IEvent) => {
      if (!isDrawing || !shape) return;
      const pointer = canvas.getPointer(opt.e);
      const x = pointer.x;
      const y = pointer.y;
      if (activeTool === 'highlighter') {
        (shape as fabric.Rect).set({ left: Math.min(startX, x), top: Math.min(startY, y), width: Math.abs(startX - x), height: Math.abs(startY - y) });
      } else if (activeTool === 'circle') {
        const rx = Math.abs(startX - x) / 2;
        const ry = Math.abs(startY - y) / 2;
        (shape as fabric.Ellipse).set({ left: Math.min(startX, x), top: Math.min(startY, y), rx, ry });
      } else if (activeTool === 'underline') {
        (shape as fabric.Line).set({ x2: x, y2: startY });
      }
      canvas.renderAll();
    };

    const handleMouseUp = () => {
      if (!isDrawing) return;
      isDrawing = false;
      if (shape) {
        const obj = shape as any;
        let tooSmall = false;
        if (obj.type === 'rect') tooSmall = (obj.width ?? 0) < 2 || (obj.height ?? 0) < 2;
        else if (obj.type === 'ellipse') tooSmall = (obj.rx ?? 0) < 2 || (obj.ry ?? 0) < 2;
        else if (obj.type === 'line') tooSmall = Math.abs((obj.x2 ?? 0) - (obj.x1 ?? 0)) < 2 && Math.abs((obj.y2 ?? 0) - (obj.y1 ?? 0)) < 2;
        if (tooSmall) { canvas.remove(shape); }
        else { historyRef.current?.snapshot(); refreshHistory(); void saveNow(); }
        shape = null;
      }
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
    };
  }, [activeTool, activeColor, opacity, saveNow, refreshHistory]);

  const handleUndo = useCallback(() => {
    historyRef.current?.undo(() => { scheduleSave(); refreshHistory(); });
    refreshHistory();
  }, [scheduleSave, refreshHistory]);

  const handleRedo = useCallback(() => {
    historyRef.current?.redo(() => { scheduleSave(); refreshHistory(); });
    refreshHistory();
  }, [scheduleSave, refreshHistory]);

  const handleClear = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (!confirm('Clear all annotations on this page?')) return;
    canvas.getObjects().forEach(obj => canvas.remove(obj));
    canvas.renderAll();
    historyRef.current?.snapshot();
    refreshHistory();
    scheduleSave();
  }, [refreshHistory, scheduleSave]);

  const handleToolClick = useCallback((t: Tool) => {
    setActiveTool(prev => prev === t ? 'pen' : t);
  }, []);

  const updateSelectedSetInUrl = useCallback((setId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (setId) params.set('set', setId);
    else params.delete('set');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [searchParams, router, pathname]);

  const onHoverEnter = useCallback((t: Tool, pos: { top: number; left: number }) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current as any);
    setHoveredTool(t);
    setHoverPos(pos);
  }, []);

  const onHoverLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => setHoveredTool(null), 150);
  }, []);

  const onHoverCancelLeave = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current as any);
  }, []);

  return {
    containerRef, wrapperRef, canvasRef,
    selectedSetId, saving, activeTool, activeColor, opacity, penWidth,
    canUndo, canRedo, canvasReady, canvasSize, pageMaxHeightOffset, hoveredTool, hoverPos,
    setSelectedSetId, setActiveColor, setOpacity, setPenWidth,
    handleUndo, handleRedo, handleClear, handleToolClick,
    updateSelectedSetInUrl, onHoverEnter, onHoverLeave, onHoverCancelLeave,
  };
}

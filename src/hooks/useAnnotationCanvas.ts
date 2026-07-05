'use client';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { fabric } from 'fabric';
import { createClient } from '@/lib/supabase/client';
import type { AnnotationSet } from '@/types';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { calculatePageCanvasSize, type PageCanvasSize } from '@/lib/pageCanvas';
import { CanvasHistory } from '@/lib/canvasHistory';
import { type Tool, getToolCursor } from '@/lib/canvasTools';
import { createAnnotationStore, type CanvasJson } from '@/lib/annotationStore';

const SAVE_DELAY_MS = 1500;
// Supersample factor: render the canvas backing store above the display resolution, then let
// the browser downscale it to the CSS fit box — the page image reads noticeably crisper. This
// multiplies fabric's retina scaling only (backing pixels), NOT the canvas coordinate space, so
// annotation coordinates and saved canvas_json are unaffected.
const SUPERSAMPLE = 1.5;
// Bottom breathing room below the page-display-frame inside the desktop app-shell. Reserves
// space for the floating zoom control that sits below the page (kept off the no-doc-scroll path).
const PAGE_BOTTOM_GAP = 92;
// Fallback offset before the chrome above the page can be measured (≈ nav + padding + set-picker).
const FALLBACK_PAGE_OFFSET = 200;

// M4: the pen/color/width/opacity selection. In single mode each canvas owns its own; in
// spread mode the SHELL owns ONE ToolState and passes it to BOTH hooks so a tool chosen once
// applies to both pages (F2).
export interface ToolState {
  activeTool: Tool; setActiveTool: React.Dispatch<React.SetStateAction<Tool>>;
  activeColor: string; setActiveColor: React.Dispatch<React.SetStateAction<string>>;
  opacity: number; setOpacity: React.Dispatch<React.SetStateAction<number>>;
  penWidth: number; setPenWidth: React.Dispatch<React.SetStateAction<number>>;
}

export function useToolState(): ToolState {
  const [activeTool, setActiveTool] = useState<Tool>('pen');
  const [activeColor, setActiveColor] = useState<string>('#ef4444');
  const [opacity, setOpacity] = useState<number>(0.4);
  const [penWidth, setPenWidth] = useState<number>(6);
  return { activeTool, setActiveTool, activeColor, setActiveColor, opacity, setOpacity, penWidth, setPenWidth };
}

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
}

export function useAnnotationCanvas({ pageNum, imageUrl, sets, user, lockedSet = false, tools, onCommit }: UseAnnotationCanvasProps) {
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
  const store = useMemo(() => createAnnotationStore(supabase), [supabase]);

  // Live refs so the mount-only init effect can read the current page/image without
  // re-running (and disposing the Fabric instance) on every page change. The page swap
  // is handled by the separate load effect below, which keeps the same canvas alive.
  const pageNumRef = useRef(pageNum);
  const imageUrlRef = useRef(imageUrl);
  pageNumRef.current = pageNum;
  imageUrlRef.current = imageUrl;

  const [selectedSetId, setSelectedSetId] = useState<string>(() => searchParams.get('set') ?? sets[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [accessRevoked, setAccessRevoked] = useState(false);
  const accessRevokedRef = useRef(false);
  // Tool state: shared (spread, passed in) or own (single mode). useToolState is always called
  // to keep hook order stable; its values are simply ignored when `tools` is provided.
  const internalTools = useToolState();
  const { activeTool, setActiveTool, activeColor, setActiveColor, opacity, setOpacity, penWidth, setPenWidth } = tools ?? internalTools;
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [canvasSize, setCanvasSize] = useState<PageCanvasSize | null>(null);
  const [pageMaxHeightOffset, setPageMaxHeightOffset] = useState(FALLBACK_PAGE_OFFSET);
  const [hoveredTool, setHoveredTool] = useState<Tool | null>(null);
  const [hoverPos, setHoverPos] = useState<{ top: number; left: number } | null>(null);
  // Mobile only: 'move' lets a finger scroll the page (canvas ignores touch); 'draw' captures
  // touch to annotate. Default 'move' so users don't draw by accident when scrolling. Desktop
  // (mouse) always draws regardless of this — the gating effect below is width-scoped.
  const [interactionMode, setInteractionMode] = useState<'move' | 'draw'>('move');

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

  // Single chokepoint for every committed user action: snapshot + refresh + notify the shell
  // controller (F4). Gated by isLoadingRef so the object:added events fired while loading a
  // page's saved JSON (and the baseline load snapshot) don't register as user actions.
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const isLoadingRef = useRef(false);
  const commit = useCallback((force = false) => {
    if (isLoadingRef.current) return;
    // Undo/redo reloads the canvas via loadFromJSON, which re-fires object:added/removed.
    // Those are NOT user actions: snapshotting or notifying the shell here would re-grow the
    // stack and re-push onto the cross-page undo order (F4), so the oldest stroke can never be
    // reached. snapshot() self-guards on `frozen`; this guards the onCommit/refresh side too.
    if (historyRef.current?.restoring) return;
    const now = Date.now();
    if (!force && now - lastSnapshotAtRef.current < 120) return;
    lastSnapshotAtRef.current = now;
    historyRef.current?.snapshot();
    refreshHistory();
    onCommitRef.current?.();
  }, [refreshHistory]);
  // Live ref so the mount-only init effect's handlers always call the current commit.
  const commitRef = useRef(commit);
  commitRef.current = commit;

  // Natural (intrinsic) size of the page image currently shown. Each of the 604 pages can have
  // different intrinsic dimensions, so we re-read this for every page rather than assuming one.
  const naturalSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  // Fit the page's intrinsic size into its container, preserving aspect ratio (object-fit:
  // contain). Desktop is height-bound (fits the fixed app-shell, no page scroll); mobile is
  // width-bound (fills the column width, scroll down for the rest). No per-page tuning — just
  // scale the native image up/down to fit whatever box the layout gives it.
  const computeFitSize = useCallback((_natW: number, _natH: number): PageCanvasSize => {
    const wrapperWidth = wrapperRef.current?.clientWidth || window.innerWidth - 72;
    const isMobile = window.innerWidth < 1024;
    const availableHeight = isMobile ? 100000 : Math.max(320, window.innerHeight - measurePageOffset());
    return calculatePageCanvasSize(800, 1132, Math.max(280, wrapperWidth), availableHeight);
  }, [measurePageOffset]);

  // Resize the live canvas to the contain-fit box for the given intrinsic size, and publish that
  // size to the frame. Returns the fit box so callers can rescale objects to match.
  const sizeCanvasForImage = useCallback((canvas: fabric.Canvas, natW: number, natH: number): PageCanvasSize => {
    naturalSizeRef.current = { w: natW, h: natH };
    const fit = computeFitSize(natW, natH);
    setCanvasSize(fit);
    canvas.setDimensions({ width: fit.width, height: fit.height });
    if (canvasRef.current) {
      canvasRef.current.style.width = `${fit.width}px`;
      canvasRef.current.style.height = `${fit.height}px`;
    }
    return fit;
  }, [computeFitSize]);

  // Load the page image, size the canvas to it (per-page intrinsic dims), and paint it as the
  // background scaled to fill that box. Resizing here means changing pages always re-fits.
  const applyBackground = useCallback((canvas: fabric.Canvas, url: string) => {
    return new Promise<PageCanvasSize>((resolve) => {
      fabric.Image.fromURL(url, (fbImg) => {
        const natW = (fbImg.width as number) || 1;
        const natH = (fbImg.height as number) || 1;
        const fit = sizeCanvasForImage(canvas, natW, natH);
        fbImg.scaleToWidth(fit.width);
        canvas.setBackgroundImage(fbImg, () => {
          try { canvas.renderAll(); } catch { /* canvas disposed between request and callback */ }
          resolve(fit);
        });
      }, { crossOrigin: 'anonymous' });
    });
  }, [sizeCanvasForImage]);

  // Scale every object on the canvas by `ratio` (used when the canvas is resized to a different
  // page/container, so existing drawings stay aligned to the page).
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

  const saveCanvas = useCallback(async (canvas: fabric.Canvas, setId: string, page: number) => {
    if (!user || !setId || accessRevokedRef.current) return;
    setSaving(true);
    try {
      const json = canvas.toJSON();
      delete (json as any).backgroundImage;
      // json carries `objects`; the store decides empty→delete vs upsert internally.
      const payload: CanvasJson = { width: canvas.getWidth(), height: canvas.getHeight(), ...(json as any) };
      const r = await store.save(setId, page, payload);
      if (r.status === 'denied') {
        // ponytail: revoke only on RLS denial (store already classified it), never on a
        // transient/network error. An owner (lockedSet false) just logs and retries.
        if (lockedSet) {
          accessRevokedRef.current = true;
          setAccessRevoked(true);
          if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
        } else {
          console.error('[AnnotationCanvas] Save denied (owner):', setId, page);
        }
      } else if (r.status === 'error') {
        console.error('[AnnotationCanvas] Save error:', r.err);
      }
    } catch (err) {
      console.error('[AnnotationCanvas] Unexpected save error:', err);
    } finally {
      setSaving(false);
    }
  }, [user, store, lockedSet]);

  const scheduleSave = useCallback(() => {
    if (!user || !selectedSetId || !fabricRef.current || accessRevokedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveCanvas(fabricRef.current!, selectedSetId, pageNum);
    }, SAVE_DELAY_MS);
  }, [selectedSetId, pageNum, saveCanvas, user]);

  const saveNow = useCallback(async () => {
    if (!user || !selectedSetId || !fabricRef.current || accessRevokedRef.current) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await saveCanvas(fabricRef.current, selectedSetId, pageNum);
  }, [pageNum, saveCanvas, selectedSetId, user]);

  // The canvas draw/save event handlers are bound ONCE in the mount-only init effect, so a
  // closure captured there freezes the page/set it was mounted with. After a soft page swap
  // (Story 24) the handlers would otherwise still save to the OUTGOING page — and worse, when
  // loadAnnotation clears the canvas to load the new page, the fired object:removed schedules a
  // debounced save of the now-empty canvas against the old page, wiping it (F6). Route the
  // handlers through live refs so they always save the CURRENT page/set.
  const scheduleSaveRef = useRef(scheduleSave);
  const saveNowRef = useRef(saveNow);
  scheduleSaveRef.current = scheduleSave;
  saveNowRef.current = saveNow;

  // Flush-before-nav (surah jump): consumers call window.__hifthFlushReaderCanvas() to persist
  // pending edits before routing. A spread mounts TWO canvas instances, so this is a registry of
  // savers (one per live canvas) rather than a single function — otherwise the second instance
  // would clobber the first and the un-flushed page would lose its debounced edits (F6).
  useEffect(() => {
    const w = window as any;
    const savers: Set<() => Promise<void>> = w.__hifthReaderSavers ?? (w.__hifthReaderSavers = new Set());
    savers.add(saveNow);
    w.__hifthFlushReaderCanvas = async () => { await Promise.all([...savers].map((fn) => fn())); };
    return () => {
      savers.delete(saveNow);
      if (savers.size === 0) delete w.__hifthFlushReaderCanvas;
    };
  }, [saveNow]);

  const loadAnnotation = useCallback(async (canvas: fabric.Canvas, setId: string, page: number) => {
    if (lastLoadedRef.current?.setId === setId && lastLoadedRef.current?.pageNum === page) return;
    activeLoadSetIdRef.current = setId;
    isLoadingRef.current = true;
    setCanvasReady(false);

    let canvasJson: CanvasJson | null;
    try {
      canvasJson = await store.load(setId, page);
    } catch (error) {
      console.error('[AnnotationCanvas] Load error:', error);
      return;
    }

    // Alive = right set still loading AND canvas not disposed. Fabric nulls lowerCanvasEl
    // on dispose(), so operating after that throws "ctx is null" in clear()/clearRect.
    const alive = () => activeLoadSetIdRef.current === setId && (canvas as any).lowerCanvasEl != null;
    if (!alive()) return;

    if (canvasJson) {
      const savedW = canvasJson.width;
      canvas.loadFromJSON(canvasJson, async () => {
        if (!alive()) return;
        // Re-fit the canvas to THIS page's image, then scale the loaded objects from the size
        // they were saved at to the current fit — keeps existing drawings aligned to the page.
        const fit = await applyBackground(canvas, imageUrl);
        if (!alive()) return;
        rescaleObjects(canvas, savedW ? fit.width / savedW : 1);
        canvas.renderAll();
        historyRef.current?.clear();
        historyRef.current?.snapshot();
        refreshHistory();
        lastLoadedRef.current = { setId, pageNum: page };
        isLoadingRef.current = false;
        setCanvasReady(true);
      });
    } else {
      canvas.clear();
      await applyBackground(canvas, imageUrl);
      if (!alive()) return;
      historyRef.current?.clear();
      historyRef.current?.snapshot();
      refreshHistory();
      lastLoadedRef.current = { setId, pageNum: page };
      isLoadingRef.current = false;
      setCanvasReady(true);
    }
  }, [store, imageUrl, applyBackground, rescaleObjects, refreshHistory]);

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
    let canvas: fabric.Canvas | null = null;

    img.onload = async () => {
      if (!isMounted) return;
      const natW = img.naturalWidth || 1;
      const natH = img.naturalHeight || 1;
      naturalSizeRef.current = { w: natW, h: natH };
      const fitSize = computeFitSize(natW, natH);
      setCanvasSize(fitSize);

      // Supersample: raise fabric's device-pixel ratio so the backing store renders above the
      // display resolution and downscales crisp. Coordinate space stays at the CSS fit box.
      (fabric as unknown as { devicePixelRatio: number }).devicePixelRatio =
        (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1) * SUPERSAMPLE;

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
      // ponytail: test-only registry so E2E can read EACH spread canvas independently
      // (window.fabricCanvas is overwritten by the 2nd instance). Keyed by the page it mounted.
      ((window as any).__hifthCanvasByPage ??= {})[pageNumRef.current] = canvas;
      // Soft-swap proof (Story 24): increment a window counter every time a Fabric
      // instance is actually CREATED. Page navigation must reuse the instance, so this
      // value stays stable across prev/next/jump/surah-select to a different page.
      (window as any).__hifthFabricCreatedCount = ((window as any).__hifthFabricCreatedCount ?? 0) + 1;

      await applyBackground(canvas, imageUrlRef.current);

      if (selectedSetId && isMounted) {
        loadedKeyRef.current = { setId: selectedSetId, page: pageNumRef.current };
        loadAnnotation(canvas, selectedSetId, pageNumRef.current);
      } else {
        historyRef.current.snapshot();
        refreshHistory();
        setCanvasReady(true);
      }

      const handleCompletedDraw = () => { commitRef.current(); void saveNowRef.current(); };
      canvas.on('path:created', handleCompletedDraw);
      canvas.on('object:modified', () => { commitRef.current(); scheduleSaveRef.current(); });
      canvas.on('object:removed', () => { commitRef.current(); scheduleSaveRef.current(); });
      canvas.on('object:added', () => { commitRef.current(); });
    };

    const ro = new ResizeObserver(() => {
      const c = fabricRef.current;
      const { w, h } = naturalSizeRef.current;
      if (!c || !w || !h) return;
      const prevW = c.getWidth();
      const fitSize = sizeCanvasForImage(c, w, h);
      // Keep existing drawings + the background aligned to the new container size.
      rescaleObjects(c, prevW ? fitSize.width / prevW : 1);
      const bg = c.backgroundImage as fabric.Image | undefined;
      if (bg && typeof bg.scaleToWidth === 'function') bg.scaleToWidth(fitSize.width);
      c.renderAll();
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
        commit(true);
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
  }, [activeTool, commit, saveNow]);

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
        commit(true);
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
        else { commit(true); void saveNow(); }
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
  }, [activeTool, activeColor, opacity, saveNow, commit]);

  const handleUndo = useCallback(() => {
    historyRef.current?.undo(() => { scheduleSave(); refreshHistory(); });
    refreshHistory();
  }, [scheduleSave, refreshHistory]);

  const handleRedo = useCallback(() => {
    historyRef.current?.redo(() => { scheduleSave(); refreshHistory(); });
    refreshHistory();
  }, [scheduleSave, refreshHistory]);

  // skipConfirm must be strictly true to skip the prompt: handleClear is also wired straight to
  // a button onClick in single mode, which would pass the click event as the first arg — a
  // truthy object that must NOT bypass the confirm. The spread shell passes literal true after
  // its own single combined confirm.
  const handleClear = useCallback((skipConfirm = false) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (skipConfirm !== true && !confirm('Clear all annotations on this page?')) return;
    canvas.getObjects().forEach(obj => canvas.remove(obj));
    canvas.renderAll();
    commit(true);
    scheduleSave();
  }, [commit, scheduleSave]);

  const handleToolClick = useCallback((t: Tool) => {
    setActiveTool(prev => prev === t ? 'pen' : t);
    // Choosing a tool means "I want to draw" — enter draw mode (mobile; no-op effect on desktop).
    setInteractionMode('draw');
  }, []);

  // Mobile move/draw gating: in 'move' mode (and below the lg breakpoint) the Fabric upper
  // canvas ignores pointer events so a finger scrolls the page instead of drawing. Desktop
  // (>= 1024px, mouse) always draws. Re-applied on mode change, canvas (re)ready, and resize.
  useEffect(() => {
    const apply = () => {
      const canvas = fabricRef.current as unknown as {
        wrapperEl?: HTMLElement;
        upperCanvasEl?: HTMLCanvasElement;
        lowerCanvasEl?: HTMLCanvasElement;
      } | null;
      const wrapper = canvas?.wrapperEl;
      const upper = canvas?.upperCanvasEl;
      const lower = canvas?.lowerCanvasEl;
      if (!wrapper && !upper) return;
      const isMobile = window.innerWidth < 1024;
      const allowDraw = !isMobile || interactionMode === 'draw';
      // In Move mode the whole canvas wrapper ignores pointer events (and allows vertical
      // panning), so a finger swiping over the IMAGE scrolls the page through to the document
      // instead of being swallowed by Fabric's touch-action:none. Draw mode restores capture.
      for (const el of [wrapper, upper, lower]) {
        if (!el) continue;
        el.style.pointerEvents = allowDraw ? '' : 'none';
        el.style.touchAction = allowDraw ? (el === upper ? 'none' : '') : 'pan-y';
      }
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [interactionMode, canvasReady]);

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
    selectedSetId, saving, accessRevoked, activeTool, activeColor, opacity, penWidth,
    canUndo, canRedo, canvasReady, canvasSize, pageMaxHeightOffset, hoveredTool, hoverPos,
    interactionMode, setInteractionMode,
    setSelectedSetId, setActiveColor, setOpacity, setPenWidth,
    handleUndo, handleRedo, handleClear, handleToolClick,
    updateSelectedSetInUrl, onHoverEnter, onHoverLeave, onHoverCancelLeave,
  };
}

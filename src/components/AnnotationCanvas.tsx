'use client';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { fabric } from 'fabric';
import { createClient } from '@/lib/supabase/client';
import type { AnnotationSet } from '@/types';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import PageDisplayFrame from '@/components/PageDisplayFrame';
import { calculatePageCanvasSize, type PageCanvasSize } from '@/lib/pageCanvas';

interface Props {
  pageNum: number;
  imageUrl: string;
  sets: Pick<AnnotationSet, 'id' | 'name'>[];
  user: { id: string } | null;
}

const SAVE_DELAY_MS = 1500;

const PRESET_COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
];

type Tool = 'pen' | 'highlighter' | 'circle' | 'underline' | 'text' | 'eraser';

// --- History management (simple undo/redo via JSON snapshots) ---
class CanvasHistory {
  private stack: string[] = [];
  private ptr = -1;
  private canvas: fabric.Canvas;
  private frozen = false;

  constructor(canvas: fabric.Canvas) {
    this.canvas = canvas;
  }

  snapshot() {
    if (this.frozen) return;
    const json = JSON.stringify(this.canvas.toJSON());
    this.stack = this.stack.slice(0, this.ptr + 1);
    this.stack.push(json);
    this.ptr = this.stack.length - 1;
  }

  clear() {
    this.stack = [];
    this.ptr = -1;
  }

  undo(onDone?: () => void) {
    if (this.ptr <= 0) return;
    this.ptr--;
    this.restore(onDone);
  }

  redo(onDone?: () => void) {
    if (this.ptr >= this.stack.length - 1) return;
    this.ptr++;
    this.restore(onDone);
  }

  canUndo() { return this.ptr > 0; }
  canRedo() { return this.ptr < this.stack.length - 1; }

  private restore(onDone?: () => void) {
    this.frozen = true;
    const json = this.stack[this.ptr];
    this.canvas.loadFromJSON(JSON.parse(json), () => {
      this.canvas.renderAll();
      this.frozen = false;
      onDone?.();
    });
  }
}

const TOOL_ICONS: Record<Tool, React.ReactNode> = {
  pen: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  ),
  highlighter: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 15.5L15.5 4 20 8.5 8.5 20H4v-4.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13.5 6l4.5 4.5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3.5 21h9" />
    </svg>
  ),
  circle: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx={12} cy={12} r={7.5} strokeWidth={2.4} />
    </svg>
  ),
  underline: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M7.5 5.5v6.25a4.5 4.5 0 009 0V5.5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6.5 19.5h11" />
    </svg>
  ),
  text: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.35} d="M5.5 6.5h13" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.35} d="M12 6.5v12" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.35} d="M9.5 18.5h5" />
    </svg>
  ),
  eraser: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4.5 15.5L14 6a2 2 0 012.8 0l2.7 2.7a2 2 0 010 2.8L12 19H8l-3.5-3.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M11.5 8.5l4 4" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 19h7.5" />
    </svg>
  ),
};

const TOOL_LABELS: Record<Tool, string> = {
  pen: 'Pen',
  highlighter: 'Highlighter',
  circle: 'Circle',
  underline: 'Underline',
  text: 'Text',
  eraser: 'Eraser',
};

const cursorSvg = (svg: string, x = 12, y = 12) => {
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `url("data:image/svg+xml,${encoded}") ${x} ${y}, auto`;
};

const getToolCursor = (tool: Tool): string => {
  const cursors: Record<Tool, string> = {
    pen: cursorSvg('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M21.2 4.8l6 6L11.8 26.2 5 28l1.8-6.8L21.2 4.8z" fill="#fff" stroke="#111827" stroke-width="3" stroke-linejoin="round"/><path d="M19.3 7.2l5.5 5.5" stroke="#10b981" stroke-width="3" stroke-linecap="round"/></svg>', 6, 27),
    highlighter: cursorSvg('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M7 19.5L20.5 6 26 11.5 12.5 25H7v-5.5z" fill="#fff" stroke="#111827" stroke-width="3" stroke-linejoin="round"/><path d="M18.5 8.5l5 5" stroke="#10b981" stroke-width="3" stroke-linecap="round"/><path d="M5 28h14" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/></svg>', 7, 26),
    circle: cursorSvg('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="10" fill="#fff" stroke="#111827" stroke-width="3"/><path d="M16 4v4M16 24v4M4 16h4M24 16h4" stroke="#10b981" stroke-width="3" stroke-linecap="round"/></svg>', 16, 16),
    underline: cursorSvg('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="4" y="4" width="24" height="24" rx="7" fill="#fff" stroke="#111827" stroke-width="2.5"/><path d="M10 9v7a6 6 0 0012 0V9" fill="none" stroke="#111827" stroke-width="3" stroke-linecap="round"/><path d="M9 24h14" stroke="#10b981" stroke-width="4" stroke-linecap="round"/></svg>', 16, 24),
    text: cursorSvg('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="5" y="4" width="22" height="24" rx="7" fill="#fff" stroke="#111827" stroke-width="2.5"/><path d="M10 10h12M16 10v13M13 23h6" stroke="#111827" stroke-width="3" stroke-linecap="round"/></svg>', 16, 16),
    eraser: cursorSvg('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M21 5l7 7-12 12H9l-5-5L21 5z" fill="#fff" stroke="#111827" stroke-width="3" stroke-linejoin="round"/><path d="M15.5 10.5l6 6" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/><path d="M15 27h12" stroke="#10b981" stroke-width="4" stroke-linecap="round"/></svg>', 8, 22),
  };
  return cursors[tool];
};

export default function AnnotationCanvas({ pageNum, imageUrl, sets, user }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  // Stable measurement point for available width. Unlike `containerRef`
  // (the PageDisplayFrame itself, whose CSS width/height are *derived from*
  // canvasSize), this wrapper's width is controlled purely by the CSS grid
  // and never depends on canvasSize — so it's safe to measure for sizing
  // without creating a circular dependency.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fabricRef = useRef<fabric.Canvas | null>(null);
  const historyRef = useRef<CanvasHistory | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const [selectedSetId, setSelectedSetId] = useState<string>(() => searchParams.get('set') ?? sets[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [activeTool, setActiveTool] = useState<Tool>('pen');
  const [activeColor, setActiveColor] = useState<string>('#ef4444');
  const [opacity, setOpacity] = useState<number>(0.4);
  const [penWidth, setPenWidth] = useState<number>(3);
  const [toolbarOpen, setToolbarOpen] = useState<boolean>(true);
  const [openPopoverTool, setOpenPopoverTool] = useState<Tool | null>(null); // kept for backward-compat but click popover removed
  const [hoveredTool, setHoveredTool] = useState<Tool | null>(null);
  const [hoverPos, setHoverPos] = useState<{ top: number; left: number } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonRefs = useRef<Record<Tool, HTMLButtonElement | null>>({} as Record<Tool, HTMLButtonElement | null>);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [canvasSize, setCanvasSize] = useState<PageCanvasSize | null>(null);

  const lastLoadedRef = useRef<{ setId: string; pageNum: number } | null>(null);
  const lastSnapshotAtRef = useRef<number>(0);

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
          canvas.renderAll();
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

      const canvasJson = {
        width: canvas.getWidth(),
        height: canvas.getHeight(),
        ...json,
      };
      const { error } = await supabase.from('annotations').upsert(
        { set_id: setId, page_number: page, canvas_json: canvasJson, updated_at: new Date().toISOString() },
        { onConflict: 'set_id,page_number' }
      );
      if (error) console.error('[AnnotationCanvas] Save error:', error);
      else console.log('[AnnotationCanvas] Save successful');
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

  const activeLoadSetIdRef = useRef<string | null>(null);

  const loadAnnotation = useCallback(async (canvas: fabric.Canvas, setId: string, page: number) => {
    if (lastLoadedRef.current?.setId === setId && lastLoadedRef.current?.pageNum === page) return;

    activeLoadSetIdRef.current = setId;
    setCanvasReady(false);

    const { data, error } = await supabase
      .from('annotations').select('canvas_json')
      .eq('set_id', setId).eq('page_number', page).maybeSingle();

    if (activeLoadSetIdRef.current !== setId) return; // stale request

    if (error) { console.error('[AnnotationCanvas] Load error:', error); return; }

    if (data?.canvas_json) {
      console.log('[AnnotationCanvas] Calling loadFromJSON with objects:', data.canvas_json.objects?.length);
      canvas.loadFromJSON(data.canvas_json, async () => {
        console.log('[AnnotationCanvas] loadFromJSON callback! current ref:', activeLoadSetIdRef.current, 'setId:', setId);
        if (activeLoadSetIdRef.current !== setId) return;
        if (containerRef.current) {
          await applyBackground(canvas, imageUrl, canvas.getWidth());
        }
        historyRef.current?.clear();
        historyRef.current?.snapshot();
        refreshHistory();
        lastLoadedRef.current = { setId, pageNum: page };
        setCanvasReady(true);
        console.log('[AnnotationCanvas] Restored objects:', canvas.getObjects().length);
      });
    } else {
      canvas.clear();
      if (containerRef.current) {
        await applyBackground(canvas, imageUrl, canvas.getWidth());
      }
      historyRef.current?.clear();
      historyRef.current?.snapshot();
      refreshHistory();
      lastLoadedRef.current = { setId, pageNum: page };
      setCanvasReady(true);
    }
  }, [supabase, imageUrl, applyBackground, refreshHistory]);

  // Init Fabric canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    let isMounted = true;
    setCanvasSize(null);
    const img = new Image();
    img.src = imageUrl;

    // Hoisted so the ResizeObserver below can reuse them without re-decoding the image.
    let naturalWidth = 0;
    let naturalHeight = 0;
    let canvas: fabric.Canvas | null = null;

    // Measure the stable wrapper (grid cell), NOT the frame itself — the
    // frame's own size is derived from this calculation, so measuring it
    // here would be circular and produce stale/incorrect results.
    const computeFitSize = () => {
      const wrapperWidth = wrapperRef.current?.clientWidth || window.innerWidth - 72;
      return calculatePageCanvasSize(
        naturalWidth,
        naturalHeight,
        Math.max(280, wrapperWidth),
        Math.max(320, window.innerHeight - 96),
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

      await applyBackground(canvas, imageUrl, fitSize.width);

      if (selectedSetId && isMounted) {
        loadAnnotation(canvas, selectedSetId, pageNum);
      } else {
        historyRef.current.snapshot();
        refreshHistory();
        setCanvasReady(true);
      }

      const snapshotWithDebounce = (force = false) => {
        const now = Date.now();
        if (!force && now - lastSnapshotAtRef.current < 120) return; // avoid double snapshots
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

    // Recompute the fit size whenever the stable wrapper's box changes
    // (window resize, sidebar collapse/expand, etc). Without this, sizing
    // only ran once on mount and never adapted afterward.
    const ro = new ResizeObserver(() => {
      if (!naturalWidth || !naturalHeight || !canvas) return;
      const fitSize = computeFitSize();
      setCanvasSize(fitSize);
      canvas.setDimensions({ width: fitSize.width, height: fitSize.height });
      if (canvasRef.current) {
        canvasRef.current.style.width = `${fitSize.width}px`;
        canvasRef.current.style.height = `${fitSize.height}px`;
      }
      void applyBackground(canvas, imageUrl, fitSize.width);
      canvas.renderAll();
    });
    if (wrapperRef.current) ro.observe(wrapperRef.current);

    return () => {
      isMounted = false;
      ro.disconnect();
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        if (fabricRef.current && selectedSetId) saveCanvas(fabricRef.current, selectedSetId, pageNum);
      }
      if (fabricRef.current) { fabricRef.current.dispose(); fabricRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNum, imageUrl, user, applyBackground]);

  // Sync drawing mode & brush settings when tool/color/penWidth changes
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

  // Eraser tool logic
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
    }

    return () => {
      canvas.off('mouse:down', handleEraserMouseDown);
    };
  }, [activeTool, refreshHistory, saveNow]);

  // Set change
  useEffect(() => {
    const canvas = fabricRef.current;
    if (canvas && selectedSetId) loadAnnotation(canvas, selectedSetId, pageNum);
  }, [selectedSetId, pageNum, loadAnnotation]);

  // Shape/text drawing via mouse events
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    let isDrawing = false;
    let shape: fabric.Object | null = null;
    let startX = 0;
    let startY = 0;

    const handleMouseDown = (opt: fabric.IEvent) => {
      if (activeTool === 'pen' || activeTool === 'eraser') return;

      // Text: place IText on click
      if (activeTool === 'text') {
        const pointer = canvas.getPointer(opt.e);
        const text = new fabric.IText('Type here', {
          left: pointer.x,
          top: pointer.y,
          fontSize: 18,
          fill: activeColor,
          fontFamily: 'sans-serif',
          editable: true,
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
        shape = new fabric.Rect({
          left: startX, top: startY, width: 0, height: 0,
          fill: activeColor, opacity, selectable: false,
          hasBorders: false, hasControls: false,
        });
      } else if (activeTool === 'circle') {
        shape = new fabric.Ellipse({
          left: startX, top: startY, rx: 0, ry: 0,
          fill: 'transparent', stroke: activeColor, strokeWidth: 2,
          selectable: false, hasBorders: false, hasControls: false,
        });
      } else if (activeTool === 'underline') {
        shape = new fabric.Line([startX, startY, startX, startY], {
          stroke: activeColor, strokeWidth: 2,
          selectable: false, hasBorders: false, hasControls: false,
        });
      }

      if (shape) { canvas.add(shape); canvas.setActiveObject(shape); }
    };

    const handleMouseMove = (opt: fabric.IEvent) => {
      if (!isDrawing || !shape) return;
      const pointer = canvas.getPointer(opt.e);
      const x = pointer.x;
      const y = pointer.y;

      if (activeTool === 'highlighter') {
        (shape as fabric.Rect).set({
          left: Math.min(startX, x), top: Math.min(startY, y),
          width: Math.abs(startX - x), height: Math.abs(startY - y),
        });
      } else if (activeTool === 'circle') {
        const rx = Math.abs(startX - x) / 2;
        const ry = Math.abs(startY - y) / 2;
        (shape as fabric.Ellipse).set({
          left: Math.min(startX, x), top: Math.min(startY, y), rx, ry,
        });
      } else if (activeTool === 'underline') {
        (shape as fabric.Line).set({ x2: x, y2: startY }); // horizontal
      }

      canvas.renderAll();
    };

    const handleMouseUp = () => {
      if (!isDrawing) return;
      isDrawing = false;
      // Remove tiny/accidental shapes
      if (shape) {
        const obj = shape as any;
        let tooSmall = false;
        if (obj.type === 'rect') {
          tooSmall = (obj.width ?? 0) < 2 || (obj.height ?? 0) < 2;
        } else if (obj.type === 'ellipse') {
          tooSmall = (obj.rx ?? 0) < 2 || (obj.ry ?? 0) < 2;
        } else if (obj.type === 'line') {
          tooSmall = Math.abs((obj.x2 ?? 0) - (obj.x1 ?? 0)) < 2 && Math.abs((obj.y2 ?? 0) - (obj.y1 ?? 0)) < 2;
        }

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

  const handleUndo = () => {
    historyRef.current?.undo(() => { scheduleSave(); refreshHistory(); });
    refreshHistory();
  };

  const handleRedo = () => {
    historyRef.current?.redo(() => { scheduleSave(); refreshHistory(); });
    refreshHistory();
  };

  const handleClear = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (!confirm('Clear all annotations on this page?')) return;
    canvas.getObjects().forEach(obj => canvas.remove(obj));
    canvas.renderAll();
    historyRef.current?.snapshot();
    refreshHistory();
    scheduleSave();
  };

  const handleToolClick = (t: Tool) => {
    // simply switch active tool. click popovers have been removed in favor of centralized controls.
    if (activeTool === t) {
      setActiveTool('pen'); // toggle back to pen as a simple behavior
    } else {
      setActiveTool(t);
    }
  };

  const tools: Tool[] = ['pen', 'highlighter', 'circle', 'underline', 'text', 'eraser'];

  const updateSelectedSetInUrl = (setId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (setId) params.set('set', setId);
    else params.delete('set');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="flex w-full justify-center">
      <div className="grid w-full grid-cols-1 items-start gap-4 sm:gap-5 lg:grid-cols-[72px_minmax(0,1fr)_72px]">
        {/* Vertical Toolbar (compact) */}
        <aside className="sticky top-24 flex flex-col items-center gap-3 justify-self-start" style={{ width: '72px' }}>
          <div className="flex w-full flex-col items-center rounded-3xl bg-white/82 p-2 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl" style={{ border: '1px solid var(--border-subtle)' }}>
            {/* Top: set picker (compact) */}
            <div className="w-full h-2" />

            {/* Tool icons */}
            <div className="flex flex-col items-center gap-2 my-1 w-full">
              {tools.map(t => (
                <button
                  key={t}
                  ref={el => { buttonRefs.current[t] = el; }}
                  onClick={() => handleToolClick(t)}
                  onMouseEnter={(e) => {
                    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current as any);
                    const el = buttonRefs.current[t];
                    if (el) {
                      const rect = el.getBoundingClientRect();
                      // force popout to the left side and clamp inside viewport
                      const popWidth = 260;
                      const margin = 12;
                      let leftPos = rect.left - popWidth - margin;
                      try {
                        const vw = window.innerWidth || 1024;
                        // clamp so it never goes off-screen on the left
                        leftPos = Math.max(8, leftPos);
                        // also ensure it doesn't overflow right edge
                        leftPos = Math.min(leftPos, Math.max(8, vw - popWidth - 8));
                      } catch (err) {
                        leftPos = Math.max(8, rect.left - popWidth - margin);
                      }
                      setHoverPos({ left: leftPos, top: rect.top + rect.height / 2 });
                    }
                    setHoveredTool(t);
                  }}
                  onMouseLeave={() => {
                    hoverTimeoutRef.current = setTimeout(() => setHoveredTool(null), 150);
                  }}
                  title={TOOL_LABELS[t]}
                  className="w-12 h-12 flex items-center justify-center rounded-2xl [&>svg]:h-5 [&>svg]:w-5"
                  style={{
                    transition: 'all var(--duration-fast) var(--ease-out)',
                    ...(activeTool === t
                      ? { background: 'var(--accent-muted)', color: 'var(--text-accent)', boxShadow: '0 6px 18px var(--accent-glow)' }
                      : { color: 'var(--text-muted)' }),
                  }}
                >
                  {TOOL_ICONS[t]}
                </button>
              ))}

              {/* Always-visible color swatches (vertical) */}
              <div className="flex flex-col items-center gap-2 my-2 w-full mt-3 rounded-2xl bg-slate-950/[0.025] py-2">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setActiveColor(c.value)}
                    title={c.name}
                    className="w-6 h-6 rounded-full"
                    style={{
                      backgroundColor: c.value,
                      border: activeColor === c.value ? '2px solid var(--text-primary)' : '2px solid transparent',
                      boxShadow: activeColor === c.value ? `0 4px 12px ${c.value}30` : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            <hr style={{ width: '100%', borderColor: 'var(--border-subtle)' }} />



            <div className="mt-3 w-full flex flex-col items-center gap-2">
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                suppressHydrationWarning
                title="Undo"
                aria-disabled={!canUndo}
                className="w-12 h-12 flex items-center justify-center rounded-full btn btn-ghost"
                style={{
                  border: '1px solid var(--border-subtle)',
                  ...( !canUndo ? { opacity: 0.45, cursor: 'not-allowed', color: 'var(--text-muted)', pointerEvents: 'none', background: 'transparent', boxShadow: 'none' } : {}),
                }}
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
              </button>

              <button
                onClick={handleRedo}
                disabled={!canRedo}
                suppressHydrationWarning
                title="Redo"
                aria-disabled={!canRedo}
                className="w-12 h-12 flex items-center justify-center rounded-full btn btn-ghost"
                style={{
                  border: '1px solid var(--border-subtle)',
                  ...( !canRedo ? { opacity: 0.45, cursor: 'not-allowed', color: 'var(--text-muted)', pointerEvents: 'none', background: 'transparent', boxShadow: 'none' } : {}),
                }}
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
              </button>

              <button onClick={handleClear} title="Clear all drawings" aria-label="Clear all drawings" className="w-12 h-12 flex items-center justify-center rounded-full btn btn-danger-ghost" style={{ border: '1px solid var(--border-subtle)' }}>
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>

            {saving && <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />}
          </div>
        </aside>



        {/* Hover popover (anchored to tool button) */}
        {hoveredTool && hoverPos && (hoveredTool === 'pen' || hoveredTool === 'circle' || hoveredTool === 'underline' || hoveredTool === 'highlighter') && (
          <div
            onMouseEnter={() => {
              if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current as any);
            }}
            onMouseLeave={() => {
              hoverTimeoutRef.current = setTimeout(() => setHoveredTool(null), 120);
            }}
            style={{ position: 'fixed', left: hoverPos.left, top: hoverPos.top, transform: 'translateY(-50%)', width: 260, zIndex: 60 }}
            className="hidden lg:block"
          >
            <div className="bg-[var(--bg-elevated)] rounded-md p-3 shadow-lg" style={{ border: '1px solid var(--border-subtle)' }}>
              { (hoveredTool === 'pen' || hoveredTool === 'circle' || hoveredTool === 'underline') && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">Size</span>
                  <input type="range" min="1" max="40" step="1" value={penWidth} onChange={e => setPenWidth(Number(e.target.value))} className="w-full h-1 rounded-lg cursor-pointer accent-emerald-500" />
                  <span className="text-sm font-mono w-8">{penWidth}</span>
                </div>
              )}

              { hoveredTool === 'highlighter' && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">Opacity</span>
                  <input type="range" min="0.1" max="0.9" step="0.05" value={opacity} onChange={e => setOpacity(parseFloat(e.target.value))} className="w-full h-1 rounded-lg cursor-pointer accent-emerald-500" />
                  <span className="text-sm font-mono w-8">{Math.round(opacity*100)}%</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Canvas area */}
        <div ref={wrapperRef} className="min-w-0 w-full lg:col-start-2 lg:w-full">
          <div className="mb-3 flex items-center justify-between rounded-2xl border border-[var(--border-subtle)] bg-white/72 px-3 py-2 shadow-sm backdrop-blur">
            {user ? (
              sets.length > 0 ? (
                <select
                  id="set-picker-top"
                  value={selectedSetId}
                  onChange={e => {
                    const nextSetId = e.target.value;
                    setSelectedSetId(nextSetId);
                    updateSelectedSetInUrl(nextSetId);
                  }}
                  className="input input-sm"
                  style={{ minWidth: '180px' }}
                >
                  {sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : (
                <a href="/sets" className="text-sm" style={{ color: 'var(--text-accent)' }}>Create set</a>
              )
            ) : (
              <a href="/login" className="text-sm" style={{ color: 'var(--text-accent)' }}>Log in to annotate</a>
            )}
            {saving && <span className="text-sm" style={{ color: 'var(--text-accent)' }}>Saving…</span>}
          </div>

          <PageDisplayFrame containerRef={containerRef} size={canvasSize} maxHeightOffset={96}>
            <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }} />
          </PageDisplayFrame>
        </div>
        <div aria-hidden className="hidden lg:block" />
      </div>
    </div>
  );
}
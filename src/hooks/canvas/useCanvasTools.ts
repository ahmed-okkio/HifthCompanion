import { useEffect, useState, useCallback, useRef } from 'react';
import { fabric } from 'fabric';
import { type Tool, getToolCursor } from '@/lib/canvasTools';

// Highlighter is a fixed wide brush (like a real marker), independent of the pen width.
const HIGHLIGHTER_WIDTH = 22;

// #rrggbb → rgba() so the highlighter brush is translucent WHILE dragging
function hexToRgba(hex: string, a: number): string {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}

export interface ToolState {
  activeTool: Tool; setActiveTool: React.Dispatch<React.SetStateAction<Tool>>;
  activeColor: string; setActiveColor: React.Dispatch<React.SetStateAction<string>>;
  opacity: number; setOpacity: React.Dispatch<React.SetStateAction<number>>;
  penWidth: number; setPenWidth: React.Dispatch<React.SetStateAction<number>>;
  eraserSize: number; setEraserSize: React.Dispatch<React.SetStateAction<number>>;
}

export function useToolState(): ToolState {
  const [activeTool, setActiveTool] = useState<Tool>('pen');
  const [activeColor, setActiveColor] = useState<string>('#ef4444');
  const [opacity, setOpacity] = useState<number>(0.4);
  const [penWidth, setPenWidth] = useState<number>(4);
  const [eraserSize, setEraserSize] = useState<number>(20);
  return { activeTool, setActiveTool, activeColor, setActiveColor, opacity, setOpacity, penWidth, setPenWidth, eraserSize, setEraserSize };
}

interface UseCanvasToolsProps {
  fabricRef: React.MutableRefObject<fabric.Canvas | null>;
  tools: ToolState;
  user: { id: string } | null;
  selectedSetId: string;
  commit: (force?: boolean) => void;
  saveNow: () => Promise<void>;
  canvasReady: boolean;
}

export function useCanvasTools({ fabricRef, tools, user, selectedSetId, commit, saveNow, canvasReady }: UseCanvasToolsProps) {
  const { activeTool, activeColor, opacity, penWidth, eraserSize, setActiveTool } = tools;
  
  const [hoveredTool, setHoveredTool] = useState<Tool | null>(null);
  const [hoverPos, setHoverPos] = useState<{ top: number; left: number } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mobile only: 'move' lets a finger scroll the page (canvas ignores touch); 'draw' captures
  // touch to annotate. Default 'move' so users don't draw by accident when scrolling. Desktop
  // (mouse) always draws regardless of this — the gating effect below is width-scoped.
  const [interactionMode, setInteractionMode] = useState<'move' | 'draw'>('move');

  const handleToolClick = useCallback((t: Tool) => {
    setActiveTool(prev => prev === t ? 'pen' : t);
    // Choosing a tool means "I want to draw" — enter draw mode (mobile; no-op effect on desktop).
    setInteractionMode('draw');
  }, [setActiveTool]);

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
  }, [interactionMode, canvasReady, fabricRef]);

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

  // Sync drawing mode + brush when tool/color/width changes
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const isBrush = activeTool === 'pen' || activeTool === 'highlighter';
    canvas.isDrawingMode = !!user && !!selectedSetId && isBrush;
    // Underline + eraser render their own overlay cursor, so hide Fabric's
    const cursor = activeTool === 'underline' || activeTool === 'eraser' ? 'none' : getToolCursor(activeTool);
    canvas.defaultCursor = cursor;
    canvas.hoverCursor = cursor;
    canvas.moveCursor = cursor;
    canvas.freeDrawingCursor = cursor;
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = activeTool === 'highlighter' ? hexToRgba(activeColor, opacity) : activeColor;
      canvas.freeDrawingBrush.width = activeTool === 'highlighter' ? HIGHLIGHTER_WIDTH : penWidth;
    }
    canvas.renderAll();
  }, [activeTool, activeColor, penWidth, opacity, user, selectedSetId, fabricRef]);

  // Eraser: a radius brush (size `eraserSize`), not a click-to-delete.
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.selection = false;
    if (activeTool !== 'eraser') return;

    const r = eraserSize;
    const upper = (canvas as any).upperCanvasEl as HTMLElement | undefined;
    const container = upper?.parentElement ?? null;

    const cursorEl = document.createElement('div');
    Object.assign(cursorEl.style, {
      position: 'absolute', pointerEvents: 'none', boxSizing: 'border-box',
      border: '1.5px dashed rgba(15,23,42,0.75)', borderRadius: '50%',
      width: `${r * 2}px`, height: `${r * 2}px`, transform: 'translate(-50%,-50%)',
      display: 'none', zIndex: '5',
    } as CSSStyleDeclaration);
    container?.appendChild(cursorEl);
    const prevCursor = upper?.style.cursor ?? '';
    if (upper) upper.style.cursor = 'none';

    const eraseAt = (p: { x: number; y: number }) => {
      let removed = false;
      for (const o of canvas.getObjects().slice()) {
        const b = o.getBoundingRect(true, true);
        const cx = Math.max(b.left, Math.min(p.x, b.left + b.width));
        const cy = Math.max(b.top, Math.min(p.y, b.top + b.height));
        const dx = p.x - cx, dy = p.y - cy;
        if (dx * dx + dy * dy <= r * r) { canvas.remove(o); removed = true; }
      }
      if (removed) canvas.renderAll();
      return removed;
    };

    let down = false, didErase = false;
    const onDown = (opt: fabric.IEvent) => { down = true; if (eraseAt(canvas.getPointer(opt.e))) didErase = true; };
    const onMove = (opt: fabric.IEvent) => {
      const p = canvas.getPointer(opt.e);
      cursorEl.style.display = 'block';
      cursorEl.style.left = `${p.x}px`;
      cursorEl.style.top = `${p.y}px`;
      if (down && eraseAt(p)) didErase = true;
    };
    const onUp = () => { down = false; if (didErase) { didErase = false; commit(true); void saveNow(); } };
    const onOut = () => { cursorEl.style.display = 'none'; };

    canvas.on('mouse:down', onDown);
    canvas.on('mouse:move', onMove);
    canvas.on('mouse:up', onUp);
    canvas.on('mouse:out', onOut);
    return () => {
      canvas.off('mouse:down', onDown);
      canvas.off('mouse:move', onMove);
      canvas.off('mouse:up', onUp);
      canvas.off('mouse:out', onOut);
      cursorEl.remove();
      if (upper) upper.style.cursor = prevCursor;
    };
  }, [activeTool, eraserSize, commit, saveNow, fabricRef]);

  // Underline cursor
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || activeTool !== 'underline') return;
    const upper = (canvas as any).upperCanvasEl as HTMLElement | undefined;
    const container = upper?.parentElement ?? null;

    const guide = document.createElement('div');
    Object.assign(guide.style, {
      position: 'absolute', pointerEvents: 'none', height: '3px', width: '56px',
      background: activeColor, borderRadius: '2px', transform: 'translate(-50%,-50%)',
      display: 'none', zIndex: '5', opacity: '0.9',
    } as CSSStyleDeclaration);
    container?.appendChild(guide);
    const prevCursor = upper?.style.cursor ?? '';
    if (upper) upper.style.cursor = 'none';

    const onMove = (opt: fabric.IEvent) => {
      const p = canvas.getPointer(opt.e);
      guide.style.display = 'block';
      guide.style.left = `${p.x}px`;
      guide.style.top = `${p.y}px`;
    };
    const onOut = () => { guide.style.display = 'none'; };
    canvas.on('mouse:move', onMove);
    canvas.on('mouse:out', onOut);
    return () => {
      canvas.off('mouse:move', onMove);
      canvas.off('mouse:out', onOut);
      guide.remove();
      if (upper) upper.style.cursor = prevCursor;
    };
  }, [activeTool, activeColor, fabricRef]);

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
      if (activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'eraser') return;
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
      if (activeTool === 'circle') {
        shape = new fabric.Ellipse({ left: startX, top: startY, rx: 0, ry: 0, fill: 'transparent', stroke: activeColor, strokeWidth: 2, selectable: false, hasBorders: false, hasControls: false });
      } else if (activeTool === 'underline') {
        shape = new fabric.Line([startX, startY, startX, startY], { stroke: activeColor, strokeWidth: 2, selectable: false, hasBorders: false, hasControls: false });
      }
      if (shape) { canvas.add(shape); }
    };

    const handleMouseMove = (opt: fabric.IEvent) => {
      if (!isDrawing || !shape) return;
      const pointer = canvas.getPointer(opt.e);
      const x = pointer.x;
      const y = pointer.y;
      if (activeTool === 'circle') {
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
  }, [activeTool, activeColor, opacity, saveNow, commit, fabricRef]);

  return {
    hoveredTool, hoverPos, interactionMode, setInteractionMode,
    handleToolClick, onHoverEnter, onHoverLeave, onHoverCancelLeave
  };
}

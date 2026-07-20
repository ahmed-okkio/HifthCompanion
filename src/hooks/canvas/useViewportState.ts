import { useState, useRef, useCallback, useEffect } from 'react';
import { type Tool } from '@/lib/canvasTools';

export interface CanvasView {
  zoom: number;
  pan: { x: number; y: number };
  dragging: boolean;
  moveTool: boolean;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setMoveTool: React.Dispatch<React.SetStateAction<boolean>>;
  onPanDown: (e: React.MouseEvent) => void;
  onPanMove: (e: { clientX: number; clientY: number }) => void;
  endPan: () => void;
  clampZoom: (z: number) => number;
  resetView: () => void;
}

export function useViewportState(resetDeps: any[]): CanvasView {
  const [zoom, setZoom] = useState(100);
  const clampZoom = useCallback((z: number) => Math.min(200, Math.max(50, z)), []);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ sx: number; sy: number; bx: number; by: number } | null>(null);
  const [moveTool, setMoveTool] = useState(false);

  const resetView = useCallback(() => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
    setMoveTool(false);
  }, []);

  // Reset view when dependencies (like pageNum) change
  useEffect(() => {
    resetView();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetDeps);

  const onPanDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { sx: e.clientX, sy: e.clientY, bx: pan.x, by: pan.y };
    setDragging(true);
  }, [pan]);

  const onPanMove = useCallback((e: { clientX: number; clientY: number }) => {
    if (!dragRef.current || zoom <= 100) return;
    setPan({
      x: dragRef.current.bx + (e.clientX - dragRef.current.sx),
      y: dragRef.current.by + (e.clientY - dragRef.current.sy)
    });
  }, [zoom]);

  const endPan = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
  }, []);

  return {
    zoom, pan, dragging, moveTool, setZoom, setMoveTool,
    onPanDown, onPanMove, endPan, clampZoom, resetView
  };
}

export function useHoverState() {
  const [hoveredTool, setHoveredTool] = useState<Tool | null>(null);
  const [hoverPos, setHoverPos] = useState<{ top: number; left: number } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    hoveredTool, hoverPos,
    onHoverEnter, onHoverLeave, onHoverCancelLeave
  };
}

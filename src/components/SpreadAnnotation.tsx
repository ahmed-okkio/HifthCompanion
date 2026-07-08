'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnnotationSet } from '@/types';
import { getPageImageUrl } from '@/lib/quran';
import { type Tool } from '@/lib/canvasTools';
import { useToolState } from '@/hooks/useAnnotationCanvas';
import AnnotationCanvas, { type CanvasHandle, type CanvasView } from '@/components/AnnotationCanvas';
import AnnotationToolbar from '@/components/AnnotationToolbar';
import ToolHoverPopover from '@/components/ToolHoverPopover';
import ZoomControl from '@/components/ZoomControl';
import { LegendButton } from '@/components/LegendModal';
import SpreadToggle from '@/components/SpreadToggle';
import { useI18n } from '@/components/I18nProvider';

interface Props {
  /** [low, high] page numbers. RTL: low/odd renders on the RIGHT, high/even on the LEFT. */
  pages: [number, number];
  sets: Pick<AnnotationSet, 'id' | 'name'>[];
  user: { id: string } | null;
  lockedSet?: boolean;
  /** When set (e.g. `/share/{setId}`), prev/next links target the share route instead of /reader. */
  sharePageBasePath?: string;
  /** PRD 0009 R3: patch the reader's Marked tab after a save (page, new mark count). */
  onSaved?: (setId: string, page: number, count: number) => void;
}

/**
 * M4 — unifies the controls across the two spread canvases.
 *  - ONE shared ToolState drives both pages (F2).
 *  - ONE zoom/pan + ONE Clear fan out to both (F3).
 *  - A shell-level history controller owns the cross-page ordering so undo/redo is a single
 *    chronological timeline regardless of which page each action hit (F4); empty = no-op (F5).
 * Per PRD D10 each canvas keeps its OWN CanvasHistory; this controller only owns the order
 * arrays and calls the right canvas's undo/redo.
 */
export default function SpreadAnnotation({ pages, sets, user, lockedSet = false, sharePageBasePath, onSaved }: Props) {
  const { t } = useI18n();
  const tools = useToolState();
  const { activeTool, setActiveTool, activeColor, setActiveColor, opacity, setOpacity, penWidth, setPenWidth, eraserSize, setEraserSize } = tools;

  // Index 0 = RIGHT (low/odd page), index 1 = LEFT (high/even page) — matches the render order.
  const rightRef = useRef<CanvasHandle>(null);
  const leftRef = useRef<CanvasHandle>(null);
  const handles = [rightRef, leftRef] as const;

  // Cross-page undo ordering (F4). undoOrder holds the canvas id of each committed action in
  // chronological order; redoOrder is the mirror of undone actions. A new commit clears the
  // redo future (standard semantics + matches each CanvasHistory slicing its own future).
  const undoOrder = useRef<number[]>([]);
  const redoOrder = useRef<number[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const sync = useCallback(() => {
    setCanUndo(undoOrder.current.length > 0);
    setCanRedo(redoOrder.current.length > 0);
  }, []);

  const onCommit = useCallback((id: number) => {
    undoOrder.current.push(id);
    redoOrder.current = [];
    sync();
  }, [sync]);

  const undo = useCallback(() => {
    const id = undoOrder.current.pop();
    if (id === undefined) return; // F5: empty timeline = safe no-op
    handles[id].current?.undo();
    redoOrder.current.push(id);
    sync();
  }, [sync]);

  const redo = useCallback(() => {
    const id = redoOrder.current.pop();
    if (id === undefined) return; // F5
    handles[id].current?.redo();
    undoOrder.current.push(id);
    sync();
  }, [sync]);

  const clear = useCallback(() => {
    if (!confirm(t('annot.confirmClearBoth'))) return;
    rightRef.current?.clear();
    leftRef.current?.clear();
  }, []);

  // Shared zoom/pan so one control scales BOTH pages (F3).
  const [zoom, setZoom] = useState(100);
  const clampZoom = (z: number) => Math.min(200, Math.max(50, z));
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ sx: number; sy: number; bx: number; by: number } | null>(null);
  const [moveTool, setMoveTool] = useState(false);
  const resetView = () => { setZoom(100); setPan({ x: 0, y: 0 }); setMoveTool(false); };
  useEffect(() => { resetView(); }, [pages[0], pages[1]]);

  const onPanDown = (e: React.MouseEvent) => { dragRef.current = { sx: e.clientX, sy: e.clientY, bx: pan.x, by: pan.y }; setDragging(true); };
  const onPanMove = (e: React.MouseEvent) => {
    if (!dragRef.current || zoom <= 100) return;
    setPan({ x: dragRef.current.bx + (e.clientX - dragRef.current.sx), y: dragRef.current.by + (e.clientY - dragRef.current.sy) });
  };
  const endPan = () => { dragRef.current = null; setDragging(false); };
  const view: CanvasView = { zoom, pan, dragging, moveTool, onPanDown, onPanMove, endPan };

  // Hover popover (pen width / opacity) — shell-local since the toolbar lives here now.
  const [hoveredTool, setHoveredTool] = useState<Tool | null>(null);
  const [hoverPos, setHoverPos] = useState<{ top: number; left: number } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onHoverEnter = (t: Tool, pos: { top: number; left: number }) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredTool(t); setHoverPos(pos);
  };
  const onHoverLeave = () => { hoverTimeoutRef.current = setTimeout(() => setHoveredTool(null), 150); };
  const onHoverCancelLeave = () => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); };

  const onToolClick = (t: Tool) => { setMoveTool(false); setActiveTool(prev => prev === t ? 'pen' : t); };

  return (
    <div className="flex w-full flex-col items-stretch gap-4 sm:gap-5">
      <div className="hidden lg:block">
        <AnnotationToolbar
          activeTool={activeTool}
          activeColor={activeColor}
          canUndo={canUndo}
          canRedo={canRedo}
          saving={false}
          onToolClick={onToolClick}
          onColorChange={setActiveColor}
          onUndo={undo}
          onRedo={redo}
          onClear={clear}
          onHoverEnter={onHoverEnter}
          onHoverLeave={onHoverLeave}
          moveActive={moveTool}
          onMoveToggle={() => setMoveTool(m => !m)}
        />
      </div>

      <ToolHoverPopover
        hoveredTool={hoveredTool}
        hoverPos={hoverPos}
        penWidth={penWidth}
        opacity={opacity}
        eraserSize={eraserSize}
        onPenWidthChange={setPenWidth}
        onOpacityChange={setOpacity}
        onEraserSizeChange={setEraserSize}
        onMouseEnter={onHoverCancelLeave}
        onMouseLeave={onHoverLeave}
      />

      {/* Low/odd page on the RIGHT, high/even on the LEFT — a physical book layout, identical
          in both locales. Pin dir=ltr so the flush/arrow logic (authored physical) isn't
          logical-flipped under ar's dir=rtl (which double-flipped the pages). */}
      <div className="flex flex-row-reverse items-start" dir="ltr">
        <div className="flex-1 min-w-0">
          <AnnotationCanvas
            ref={rightRef}
            pageNum={pages[0]}
            imageUrl={getPageImageUrl(pages[0])}
            sets={sets}
            user={user}
            lockedSet={lockedSet}
            tools={tools}
            onCommit={() => onCommit(0)}
            onSaved={onSaved}
            view={view}
            flush="start"
            sharePageBasePath={sharePageBasePath}
          />
        </div>
        <div className="flex-1 min-w-0">
          <AnnotationCanvas
            ref={leftRef}
            pageNum={pages[1]}
            imageUrl={getPageImageUrl(pages[1])}
            sets={sets}
            user={user}
            lockedSet={lockedSet}
            showSetsCard={false}
            tools={tools}
            onCommit={() => onCommit(1)}
            onSaved={onSaved}
            view={view}
            flush="end"
            sharePageBasePath={sharePageBasePath}
          />
        </div>
      </div>

      <div className="flex justify-center items-center gap-3">
        <LegendButton />
        <ZoomControl
          zoom={zoom}
          onZoomOut={() => setZoom(z => clampZoom(z - 10))}
          onZoomIn={() => setZoom(z => clampZoom(z + 10))}
          onReset={resetView}
        />
        {/* M5 C1: spread toggle sits by the zoom control (spread mode → turn spread OFF). */}
        <SpreadToggle page={pages[0]} active={true} basePath={sharePageBasePath} />
      </div>
    </div>
  );
}

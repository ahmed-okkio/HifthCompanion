'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AnnotationSet } from '@/types';
import PageDisplayFrame from '@/components/PageDisplayFrame';
import AnnotationToolbar from '@/components/AnnotationToolbar';
import MobileAnnotationBar from '@/components/MobileAnnotationBar';
import ToolHoverPopover from '@/components/ToolHoverPopover';
import SetsCard from '@/components/SetsCard';
import { useAnnotationCanvas } from '@/hooks/useAnnotationCanvas';

interface Props {
  pageNum: number;
  imageUrl: string;
  sets: Pick<AnnotationSet, 'id' | 'name'>[];
  user: { id: string } | null;
}

export default function AnnotationCanvas({ pageNum, imageUrl, sets, user }: Props) {
  const {
    containerRef, wrapperRef, canvasRef,
    selectedSetId, saving, activeTool, activeColor, opacity, penWidth,
    canUndo, canRedo, canvasReady, canvasSize, pageMaxHeightOffset, hoveredTool, hoverPos,
    interactionMode, setInteractionMode,
    setSelectedSetId, setActiveColor, setOpacity, setPenWidth,
    handleUndo, handleRedo, handleClear, handleToolClick,
    updateSelectedSetInUrl, onHoverEnter, onHoverLeave, onHoverCancelLeave,
  } = useAnnotationCanvas({ pageNum, imageUrl, sets, user });

  useEffect(() => {
    localStorage.setItem('hifth:lastPage', String(pageNum));
  }, [pageNum]);

  // The Sets card renders at the TOP of the right context panel (a slot owned by ReaderShell),
  // not above the page. Portal it there once that slot is in the DOM so it shares canvas state.
  const [setsSlot, setSetsSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSetsSlot(document.getElementById('sets-card-portal'));
  }, []);

  // Zoom (desktop): a transform scale on the page, 50%–200%, stepped by 10. Reset returns to
  // 100% (the per-page contain-fit size). Drawing is best at 100%; this is primarily for reading.
  const [zoom, setZoom] = useState(100);
  const clampZoom = (z: number) => Math.min(200, Math.max(50, z));
  // Pan offset while zoomed in (drag the page around). Reset with zoom.
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ sx: number; sy: number; bx: number; by: number } | null>(null);
  // Desktop Move tool: when on, dragging pans the (zoomed) page and drawing is suspended.
  const [moveTool, setMoveTool] = useState(false);
  const resetView = () => { setZoom(100); setPan({ x: 0, y: 0 }); setMoveTool(false); };

  // Changing pages while zoomed used to push the toolbar/zoom-control off-screen. Reset the view
  // on every page change so navigation always lands at the clean 100% contain-fit.
  useEffect(() => { resetView(); }, [pageNum]);

  const onPanDown = (e: React.MouseEvent) => {
    dragRef.current = { sx: e.clientX, sy: e.clientY, bx: pan.x, by: pan.y };
    setDragging(true);
  };
  const onPanMove = (e: React.MouseEvent) => {
    if (!dragRef.current || zoom <= 100) return;
    setPan({ x: dragRef.current.bx + (e.clientX - dragRef.current.sx), y: dragRef.current.by + (e.clientY - dragRef.current.sy) });
  };
  const endPan = () => { dragRef.current = null; setDragging(false); };

  return (
    <div className="flex w-full justify-center">
      {/* V3 Story 9 — single workspace column: horizontal annotation bar ABOVE the page,
          the contain-fit page BELOW it. (Was a 72px | page | 72px grid with a vertical
          toolbar.) measurePageOffset reads the live top of .page-display-frame, so moving the
          bar above the page automatically shifts the available height used to fit the page —
          desktop still fits with no document scroll. */}
      <div className="flex w-full flex-col items-stretch gap-4 sm:gap-5">
        <div className="hidden lg:block">
          <AnnotationToolbar
            activeTool={activeTool}
            activeColor={activeColor}
            canUndo={canUndo}
            canRedo={canRedo}
            saving={saving}
            onToolClick={t => { setMoveTool(false); handleToolClick(t); }}
            onColorChange={setActiveColor}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={handleClear}
            onHoverEnter={onHoverEnter}
            onHoverLeave={onHoverLeave}
            moveActive={moveTool}
            onMoveToggle={() => setMoveTool(m => !m)}
          />
        </div>

        <MobileAnnotationBar
          activeTool={activeTool}
          activeColor={activeColor}
          canUndo={canUndo}
          canRedo={canRedo}
          saving={saving}
          mode={interactionMode}
          onModeChange={setInteractionMode}
          onToolClick={handleToolClick}
          onColorChange={setActiveColor}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClear={handleClear}
        />

        <ToolHoverPopover
          hoveredTool={hoveredTool}
          hoverPos={hoverPos}
          penWidth={penWidth}
          opacity={opacity}
          onPenWidthChange={setPenWidth}
          onOpacityChange={setOpacity}
          onMouseEnter={onHoverCancelLeave}
          onMouseLeave={onHoverLeave}
        />

        {/* Sets card portaled into the right context panel top (replaces the old wide bar). */}
        {setsSlot && createPortal(
          <SetsCard
            user={user}
            sets={sets}
            selectedSetId={selectedSetId}
            saving={saving}
            onSetChange={id => { setSelectedSetId(id); updateSelectedSetInUrl(id); }}
          />,
          setsSlot,
        )}

        <div ref={wrapperRef} className="min-w-0 w-full pb-[72px] lg:pb-0">
          {/* V3 Story 12 — zoom controls positioned below the cream hero.
              Uses position:relative on this wrapper + position:absolute on the control
              so the zoom bar contributes ZERO layout height — the desktop no-document-scroll
              constraint is not disturbed. The control floats 12px below the hero bottom edge
              and is clipped by the workspace overflow:hidden if viewport is very short.
              INERT PLACEHOLDER: aria-disabled on every interactive child; no click handlers;
              pointerEvents:none on buttons. Fabric zoom deferred to future Opus story. */}
          <div className="relative flex flex-col items-center">
            {/* transform: scale zooms the page from its center (contain-fit size = 100% baseline).
                The clip wrapper is sized to the un-scaled page (transform doesn't change layout),
                so a zoomed-in page is cropped to its own box and never overflows onto the zoom
                control below. Drawing is best at 100% (the default). */}
            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-page)' }}>
              <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`, transformOrigin: 'center center', transition: dragging ? 'none' : 'transform 120ms var(--ease-out, ease)' }}>
                <PageDisplayFrame containerRef={containerRef} size={canvasSize} maxHeightOffset={pageMaxHeightOffset} ready={canvasReady}>
                  <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }} />
                </PageDisplayFrame>
              </div>

              {/* Pan overlay — present while the Move tool is active. Captures drag to move the
                  zoomed page (and blocks drawing); absent otherwise so annotation drawing works. */}
              {moveTool && (
                <div
                  aria-label="Drag to move the page"
                  onMouseDown={onPanDown}
                  onMouseMove={onPanMove}
                  onMouseUp={endPan}
                  onMouseLeave={endPan}
                  style={{ position: 'absolute', inset: 0, zIndex: 3, cursor: dragging ? 'grabbing' : 'grab' }}
                />
              )}
            </div>

            {/* Zoom control — floats just below the page (desktop). Reserved space is provided by
                PAGE_BOTTOM_GAP so it never forces document scroll. */}
            <div
              data-testid="zoom-control"
              aria-label="Zoom controls"
              className="hidden lg:flex items-center justify-center"
              style={{
                marginTop: 'var(--space-12)',
                height: '52px',
                background: 'var(--surface-main)',
                borderRadius: 'var(--radius-lg-px)',
                border: '1px solid rgba(15, 23, 42, 0.05)',
                boxShadow: 'var(--shadow-e2)',
                padding: '0 var(--space-8)',
                userSelect: 'none',
              }}
            >
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => setZoom(z => clampZoom(z - 10))}
                disabled={zoom <= 50}
                className="flex items-center justify-center"
                style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', cursor: zoom <= 50 ? 'default' : 'pointer', color: 'var(--neutral-600)', fontSize: '20px', fontWeight: 500, opacity: zoom <= 50 ? 0.4 : 1 }}
                onMouseEnter={e => { if (zoom > 50) (e.currentTarget as HTMLButtonElement).style.background = 'var(--neutral-100)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                −
              </button>

              <span style={{ minWidth: '52px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {zoom}%
              </span>

              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => setZoom(z => clampZoom(z + 10))}
                disabled={zoom >= 200}
                className="flex items-center justify-center"
                style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', cursor: zoom >= 200 ? 'default' : 'pointer', color: 'var(--neutral-600)', fontSize: '20px', fontWeight: 500, opacity: zoom >= 200 ? 0.4 : 1 }}
                onMouseEnter={e => { if (zoom < 200) (e.currentTarget as HTMLButtonElement).style.background = 'var(--neutral-100)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                +
              </button>

              <div aria-hidden="true" style={{ width: '1px', height: '24px', background: 'var(--border-subtle)', margin: '0 var(--space-8)' }} />

              <button
                type="button"
                aria-label="Reset zoom"
                onClick={resetView}
                className="flex items-center gap-2"
                style={{ height: '38px', padding: '0 var(--space-12)', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: 'var(--neutral-600)', whiteSpace: 'nowrap' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--neutral-100)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M20 9a8 8 0 00-14.9-3M4 15a8 8 0 0014.9 3" />
                </svg>
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

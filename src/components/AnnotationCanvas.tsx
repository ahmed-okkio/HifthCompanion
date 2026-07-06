'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AnnotationSet } from '@/types';
import { TOTAL_PAGES, clampPage, spreadUrl } from '@/lib/quran';
import PageDisplayFrame from '@/components/PageDisplayFrame';
import AnnotationToolbar from '@/components/AnnotationToolbar';
import MobileAnnotationBar from '@/components/MobileAnnotationBar';
import ToolHoverPopover from '@/components/ToolHoverPopover';
import SetsCard from '@/components/SetsCard';
import ZoomControl from '@/components/ZoomControl';
import SpreadToggle from '@/components/SpreadToggle';
import { useAnnotationCanvas, type ToolState } from '@/hooks/useAnnotationCanvas';
import { useI18n } from '@/components/I18nProvider';

/** M4 spread mode: zoom/pan state lifted to the shell so ONE control scales BOTH pages (F3). */
export interface CanvasView {
  zoom: number;
  pan: { x: number; y: number };
  dragging: boolean;
  moveTool: boolean;
  onPanDown: (e: React.MouseEvent) => void;
  onPanMove: (e: React.MouseEvent) => void;
  endPan: () => void;
}

/** Imperative handle the spread shell controller drives for the unified undo timeline (F4). */
export interface CanvasHandle {
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

interface Props {
  pageNum: number;
  imageUrl: string;
  sets: Pick<AnnotationSet, 'id' | 'name'>[];
  user: { id: string } | null;
  /** Collaborator share view: lock to the single shared set and hide the set swapper. */
  lockedSet?: boolean;
  /** Spread mode mounts two canvases that share the one #sets-card-portal slot; only the
   *  primary instance renders the SetsCard so it isn't duplicated. */
  showSetsCard?: boolean;
  /** M4 spread mode: shared tool state from the shell so a tool chosen once drives both (F2). */
  tools?: ToolState;
  /** M4 spread mode: notify the shell controller of a committed action (F4). */
  onCommit?: () => void;
  /** M4 spread mode: when present, the canvas is "controlled" — it renders only the page (no
   *  toolbar / mobile bar / zoom control; those live once in the shell) and uses this shared
   *  zoom/pan so both pages scale together (F3). */
  view?: CanvasView;
  /** Spread mode horizontal alignment: 'start' = flush-left (right page toward center),
   *  'end' = flush-right (left page toward center). Default 'center' (single mode). */
  flush?: 'start' | 'end';
  /** When set (e.g. `/share/{setId}`), prev/next links target the share route instead of /reader. */
  sharePageBasePath?: string;
  /** PRD 0009 R3: patch the reader's Marked tab after a save (page, new mark count). */
  onSaved?: (page: number, count: number) => void;
}

function AnnotationCanvasInner(
  { pageNum, imageUrl, sets, user, lockedSet = false, showSetsCard = true, tools, onCommit, view, flush, sharePageBasePath, onSaved }: Props,
  ref: React.Ref<CanvasHandle>,
) {
  const {
    containerRef, wrapperRef, canvasRef,
    selectedSetId, saving, accessRevoked, activeTool, activeColor, opacity, penWidth,
    canUndo, canRedo, canvasReady, canvasSize, pageMaxHeightOffset, hoveredTool, hoverPos,
    interactionMode, setInteractionMode,
    setSelectedSetId, setActiveColor, setOpacity, setPenWidth,
    handleUndo, handleRedo, handleClear, handleToolClick,
    updateSelectedSetInUrl, onHoverEnter, onHoverLeave, onHoverCancelLeave,
  } = useAnnotationCanvas({ pageNum, imageUrl, sets, user, lockedSet, tools, onCommit, onSaved });
  const { t } = useI18n();

  // Spread shell drives undo/redo/clear through this handle (F4). clear skips the per-canvas
  // confirm — the shell shows ONE combined confirm before fanning out.
  useImperativeHandle(ref, () => ({
    undo: handleUndo,
    redo: handleRedo,
    clear: () => handleClear(true),
  }), [handleUndo, handleRedo, handleClear]);

  const controlled = !!view;
  const router = useRouter();
  const searchParams = useSearchParams();

  const go = (page: number) => {
    const clamped = clampPage(page);
    if (sharePageBasePath) {
      router.push(`${sharePageBasePath}/${clamped}`, { scroll: false });
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    const qs = params.toString();
    router.push(`/reader/${clamped}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  // Spread-mode arrows navigate straight to the target SPREAD segment ("N-M") so
  // we never bounce through a single page that only re-expands if the localStorage
  // spread preference happens to be set (that made spread nav collapse to single).
  const goSpread = (page: number) => {
    const seg = spreadUrl(clampPage(page));
    if (sharePageBasePath) {
      router.push(`${sharePageBasePath}/${seg}`, { scroll: false });
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    const qs = params.toString();
    router.push(`/reader/${seg}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  // D2: a collaborator's access was revoked mid-session — their next save was rejected by RLS.
  // Show a toast, then bounce them to their own reader.
  useEffect(() => {
    if (!accessRevoked) return;
    const t = setTimeout(() => router.push('/reader/1'), 1500);
    return () => clearTimeout(t);
  }, [accessRevoked, router]);

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

  // Controlled (spread) canvases use the shell's shared zoom/pan so both pages scale as one (F3);
  // single mode uses the internal state above.
  const eff: CanvasView = view ?? { zoom, pan, dragging, moveTool, onPanDown, onPanMove, endPan };

  return (
    <div className={`flex w-full ${flush === 'end' ? 'justify-end' : flush === 'start' ? 'justify-start' : 'justify-center'}`}>
      {accessRevoked && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: 'var(--space-16, 16px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'var(--surface-main)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg-px)',
            boxShadow: 'var(--shadow-e2)',
            padding: 'var(--space-12) var(--space-16)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          {t('annot.accessRevoked')}
        </div>
      )}
      {/* V3 Story 9 — single workspace column: horizontal annotation bar ABOVE the page,
          the contain-fit page BELOW it. (Was a 72px | page | 72px grid with a vertical
          toolbar.) measurePageOffset reads the live top of .page-display-frame, so moving the
          bar above the page automatically shifts the available height used to fit the page —
          desktop still fits with no document scroll. */}
      <div className="flex w-full flex-col items-stretch gap-4 sm:gap-5">
        {!controlled && (
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
        )}

        {!controlled && (
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
        )}

        {!controlled && (
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
        )}

        {/* Sets card portaled into the right context panel top (replaces the old wide bar).
            Hidden in the locked collaborator share view — only the one shared set is editable. */}
        {showSetsCard && !lockedSet && setsSlot && createPortal(
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
          <div className={`relative flex flex-col${flush ? '' : ' items-center'}`}>
            {/* transform: scale zooms the page from its center (contain-fit size = 100% baseline).
                The clip wrapper is sized to the un-scaled page (transform doesn't change layout),
                so a zoomed-in page is cropped to its own box and never overflows onto the zoom
                control below. Drawing is best at 100% (the default). */}
            {controlled ? (
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch' }}>
              {flush === 'end' && (
              <button
                onClick={() => goSpread(pageNum + 2)}
                disabled={pageNum >= TOTAL_PAGES - (controlled ? 1 : 0)}
                aria-label={t('reader.nextPage')}
                style={{
                  width: 'clamp(50px, 4vw, 120px)', minWidth: 50, flexShrink: 0,
                  border: 'none',
                  background: 'transparent', boxShadow: 'none',
                  cursor: pageNum >= TOTAL_PAGES - (controlled ? 1 : 0) ? 'default' : 'pointer',
                  borderRadius: 'var(--radius-lg-px)',
                  transition: 'background 220ms ease, box-shadow 220ms ease, transform 120ms var(--ease-out)',
                  opacity: pageNum >= TOTAL_PAGES - (controlled ? 1 : 0) ? 0.3 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => {
                  if (pageNum >= TOTAL_PAGES - (controlled ? 1 : 0)) return;
                  const el = e.currentTarget;
                  el.style.background = 'var(--surface-app)';
                  el.style.boxShadow = '0 4px 12px rgba(15,23,42,0.12)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget;
                  el.style.background = 'transparent';
                  el.style.boxShadow = 'none';
                }}
                onMouseDown={e => {
                  if (pageNum >= TOTAL_PAGES - (controlled ? 1 : 0)) return;
                  const el = e.currentTarget;
                  el.style.transform = 'scale(0.94)';
                  el.style.boxShadow = '0 2px 8px rgba(15,23,42,0.18)';
                }}
                onMouseUp={e => {
                  const el = e.currentTarget;
                  el.style.transform = '';
                  el.style.boxShadow = '0 4px 12px rgba(15,23,42,0.12)';
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transition: 'color 220ms ease' }}>
                  <path d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              )}
            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-page)', flex: 1, minWidth: 0 }}>
              <div style={{ transform: `translate(${eff.pan.x}px, ${eff.pan.y}px) scale(${eff.zoom / 100})`, transformOrigin: 'center center', transition: eff.dragging ? 'none' : 'transform 120ms var(--ease-out, ease)' }}>
                <PageDisplayFrame containerRef={containerRef} size={canvasSize} maxHeightOffset={pageMaxHeightOffset} ready={canvasReady} align={flush}>
                  <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }} />
                </PageDisplayFrame>
              </div>

              {/* Pan overlay — present while the Move tool is active. Captures drag to move the
                  zoomed page (and blocks drawing); absent otherwise so annotation drawing works. */}
              {eff.moveTool && (
                <div
                  aria-label={t('annot.dragToMove')}
                  onMouseDown={eff.onPanDown}
                  onMouseMove={eff.onPanMove}
                  onMouseUp={eff.endPan}
                  onMouseLeave={eff.endPan}
                  style={{ position: 'absolute', inset: 0, zIndex: 3, cursor: eff.dragging ? 'grabbing' : 'grab' }}
                />
              )}
            </div>
              {flush === 'start' && (
              <button
                onClick={() => goSpread(pageNum - 2)}
                disabled={pageNum <= 1}
                aria-label={t('reader.prevPage')}
                style={{
                  width: 'clamp(50px, 4vw, 120px)', minWidth: 50, flexShrink: 0,
                  border: 'none',
                  background: 'transparent', boxShadow: 'none',
                  cursor: pageNum <= 1 ? 'default' : 'pointer',
                  borderRadius: 'var(--radius-lg-px)',
                  transition: 'background 220ms ease, box-shadow 220ms ease, transform 120ms var(--ease-out)',
                  opacity: pageNum <= 1 ? 0.3 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => {
                  if (pageNum <= 1) return;
                  const el = e.currentTarget;
                  el.style.background = 'var(--surface-app)';
                  el.style.boxShadow = '0 4px 12px rgba(15,23,42,0.12)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget;
                  el.style.background = 'transparent';
                  el.style.boxShadow = 'none';
                }}
                onMouseDown={e => {
                  if (pageNum <= 1) return;
                  const el = e.currentTarget;
                  el.style.transform = 'scale(0.94)';
                  el.style.boxShadow = '0 2px 8px rgba(15,23,42,0.18)';
                }}
                onMouseUp={e => {
                  const el = e.currentTarget;
                  el.style.transform = '';
                  el.style.boxShadow = '0 4px 12px rgba(15,23,42,0.12)';
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transition: 'color 220ms ease' }}>
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
              )}
            </div>
            ) : (
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <button
                onClick={() => go(pageNum + (controlled ? 2 : 1))}
                disabled={pageNum >= TOTAL_PAGES - (controlled ? 1 : 0)}
                aria-label={t('reader.nextPage')}
                style={{
                  position: 'absolute', right: 'calc(100% + 20px)', top: 0, bottom: 0,
                  width: '16vw', zIndex: 4, border: 'none',
                  background: 'transparent', boxShadow: 'none',
                  cursor: pageNum >= TOTAL_PAGES - (controlled ? 1 : 0) ? 'default' : 'pointer',
                  borderRadius: 'var(--radius-lg-px)',
                  transition: 'background 220ms ease, box-shadow 220ms ease, transform 120ms var(--ease-out)',
                  opacity: pageNum >= TOTAL_PAGES - (controlled ? 1 : 0) ? 0.3 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => {
                  if (pageNum >= TOTAL_PAGES - (controlled ? 1 : 0)) return;
                  const el = e.currentTarget;
                  el.style.background = 'var(--surface-app)';
                  el.style.boxShadow = '0 4px 12px rgba(15,23,42,0.12)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget;
                  el.style.background = 'transparent';
                  el.style.boxShadow = 'none';
                }}
                onMouseDown={e => {
                  if (pageNum >= TOTAL_PAGES - (controlled ? 1 : 0)) return;
                  const el = e.currentTarget;
                  el.style.transform = 'scale(0.94)';
                  el.style.boxShadow = '0 2px 8px rgba(15,23,42,0.18)';
                }}
                onMouseUp={e => {
                  const el = e.currentTarget;
                  el.style.transform = '';
                  el.style.boxShadow = '0 4px 12px rgba(15,23,42,0.12)';
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transition: 'color 220ms ease' }}>
                  <path d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-page)' }}>
              <div style={{ transform: `translate(${eff.pan.x}px, ${eff.pan.y}px) scale(${eff.zoom / 100})`, transformOrigin: 'center center', transition: eff.dragging ? 'none' : 'transform 120ms var(--ease-out, ease)' }}>
                <PageDisplayFrame containerRef={containerRef} size={canvasSize} maxHeightOffset={pageMaxHeightOffset} ready={canvasReady} align={flush}>
                  <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }} />
                </PageDisplayFrame>
              </div>

              {/* Pan overlay — present while the Move tool is active. Captures drag to move the
                  zoomed page (and blocks drawing); absent otherwise so annotation drawing works. */}
              {eff.moveTool && (
                <div
                  aria-label={t('annot.dragToMove')}
                  onMouseDown={eff.onPanDown}
                  onMouseMove={eff.onPanMove}
                  onMouseUp={eff.endPan}
                  onMouseLeave={eff.endPan}
                  style={{ position: 'absolute', inset: 0, zIndex: 3, cursor: eff.dragging ? 'grabbing' : 'grab' }}
                />
              )}
            </div>
              <button
                onClick={() => go(pageNum - (controlled ? 2 : 1))}
                disabled={pageNum <= 1}
                aria-label={t('reader.prevPage')}
                style={{
                  position: 'absolute', left: 'calc(100% + 20px)', top: 0, bottom: 0,
                  width: '16vw', zIndex: 4, border: 'none',
                  background: 'transparent', boxShadow: 'none',
                  cursor: pageNum <= 1 ? 'default' : 'pointer',
                  borderRadius: 'var(--radius-lg-px)',
                  transition: 'background 220ms ease, box-shadow 220ms ease, transform 120ms var(--ease-out)',
                  opacity: pageNum <= 1 ? 0.3 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => {
                  if (pageNum <= 1) return;
                  const el = e.currentTarget;
                  el.style.background = 'var(--surface-app)';
                  el.style.boxShadow = '0 4px 12px rgba(15,23,42,0.12)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget;
                  el.style.background = 'transparent';
                  el.style.boxShadow = 'none';
                }}
                onMouseDown={e => {
                  if (pageNum <= 1) return;
                  const el = e.currentTarget;
                  el.style.transform = 'scale(0.94)';
                  el.style.boxShadow = '0 2px 8px rgba(15,23,42,0.18)';
                }}
                onMouseUp={e => {
                  const el = e.currentTarget;
                  el.style.transform = '';
                  el.style.boxShadow = '0 4px 12px rgba(15,23,42,0.12)';
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transition: 'color 220ms ease' }}>
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            )}

            {/* Zoom control — floats just below the page (desktop). In spread mode the shell
                renders ONE zoom control that scales both pages, so each canvas hides its own. */}
            {!controlled && (
              <div className="flex items-center justify-center gap-3">
                <ZoomControl
                  zoom={zoom}
                  onZoomOut={() => setZoom(z => clampZoom(z - 10))}
                  onZoomIn={() => setZoom(z => clampZoom(z + 10))}
                  onReset={resetView}
                />
                {/* M5 C1: spread toggle sits by the zoom control (single mode → turn spread ON). */}
                <SpreadToggle page={pageNum} active={false} basePath={sharePageBasePath} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const AnnotationCanvas = forwardRef(AnnotationCanvasInner);
export default AnnotationCanvas;

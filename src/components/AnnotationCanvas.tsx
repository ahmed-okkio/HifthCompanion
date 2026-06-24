'use client';
import { useEffect, useState } from 'react';
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
            onToolClick={handleToolClick}
            onColorChange={setActiveColor}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={handleClear}
            onHoverEnter={onHoverEnter}
            onHoverLeave={onHoverLeave}
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
          <div className="relative">
            <PageDisplayFrame containerRef={containerRef} size={canvasSize} maxHeightOffset={pageMaxHeightOffset} ready={canvasReady}>
              <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }} />
            </PageDisplayFrame>

            {/* Zoom control — INERT. Absolutely positioned, zero layout height impact. */}
            <div
              data-testid="zoom-control"
              aria-label="Zoom controls (coming soon)"
              className="hidden lg:flex items-center justify-center gap-0"
              style={{
                position: 'absolute',
                bottom: '-68px',   /* 56px height + 12px gap */
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'fit-content',
                height: '56px',
                background: 'var(--surface-main)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-e1)',
                padding: '0 var(--space-4)',
                userSelect: 'none',
                zIndex: 1,
              }}
            >
              {/* [-] button — inert */}
              <button
                type="button"
                aria-label="Zoom out"
                aria-disabled="true"
                tabIndex={-1}
                style={{
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'default',
                  color: 'var(--neutral-500)',
                  fontSize: '20px',
                  fontWeight: 500,
                  pointerEvents: 'none',
                }}
              >
                −
              </button>

              {/* current zoom level display — inert */}
              <span
                style={{
                  minWidth: '52px',
                  textAlign: 'center',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  padding: '0 var(--space-4)',
                }}
              >
                100%
              </span>

              {/* [+] button — inert */}
              <button
                type="button"
                aria-label="Zoom in"
                aria-disabled="true"
                tabIndex={-1}
                style={{
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'default',
                  color: 'var(--neutral-500)',
                  fontSize: '20px',
                  fontWeight: 500,
                  pointerEvents: 'none',
                }}
              >
                +
              </button>

              {/* divider */}
              <div
                aria-hidden="true"
                style={{
                  width: '1px',
                  height: '24px',
                  background: 'var(--border-subtle)',
                  margin: '0 var(--space-4)',
                }}
              />

              {/* Fit to width button — inert */}
              <button
                type="button"
                aria-label="Fit to width"
                aria-disabled="true"
                tabIndex={-1}
                style={{
                  height: '40px',
                  padding: '0 var(--space-12)',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'default',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--neutral-500)',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                Fit to width
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

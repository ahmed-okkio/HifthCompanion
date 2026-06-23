'use client';
import { useEffect } from 'react';
import type { AnnotationSet } from '@/types';
import PageDisplayFrame from '@/components/PageDisplayFrame';
import AnnotationToolbar from '@/components/AnnotationToolbar';
import MobileAnnotationBar from '@/components/MobileAnnotationBar';
import ToolHoverPopover from '@/components/ToolHoverPopover';
import SetPicker from '@/components/SetPicker';
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

  return (
    <div className="flex w-full justify-center">
      <div className="grid w-full grid-cols-1 items-start gap-4 sm:gap-5 lg:grid-cols-[72px_minmax(0,1fr)_72px]">
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

        <div ref={wrapperRef} className="min-w-0 w-full lg:col-start-2 lg:w-full pb-[72px] lg:pb-0">
          <SetPicker
            user={user}
            sets={sets}
            selectedSetId={selectedSetId}
            saving={saving}
            onSetChange={id => { setSelectedSetId(id); updateSelectedSetInUrl(id); }}
          />
          <PageDisplayFrame containerRef={containerRef} size={canvasSize} maxHeightOffset={pageMaxHeightOffset} ready={canvasReady}>
            <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }} />
          </PageDisplayFrame>
        </div>

        <div aria-hidden className="hidden lg:block" />
      </div>
    </div>
  );
}

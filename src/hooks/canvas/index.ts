/**
 * Canvas hooks — lifecycle decomposition of the former 1043-line useAnnotationCanvas.
 *
 * @module canvas
 *
 * useCanvasTools     — tool state, cursors, shape/eraser/underline drawing effects
 * useCanvasViewport  — sizing, backing ratio, pan-less layout measurement
 * useCanvasPersistence — load/save, cache, history, skeleton gating
 * useViewportState   — pan/zoom UI state (shared between single & spread modes)
 */

export { useToolState, useCanvasTools, type ToolState } from './useCanvasTools';
export { useCanvasViewport } from './useCanvasViewport';
export { useCanvasPersistence, lockMark } from './useCanvasPersistence';
export { useViewportState, useHoverState, type CanvasView } from './useViewportState';

export interface PageCanvasSize {
  width: number;
  height: number;
}

export function calculatePageCanvasSize(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number,
  // Per-dimension minimum. Clamps width/height independently, so it can BREAK aspect ratio when
  // it triggers — only meaningful as a tiny-canvas guard. The reader passes 1 (no floor) because
  // a narrow spread page slot (< 280) must keep its aspect, not get force-widened and stretched.
  minSize = 280,
): PageCanvasSize {
  const aspectRatio = naturalWidth / naturalHeight;

  let width = maxWidth;
  let height = width / aspectRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  return {
    width: Math.max(minSize, Math.floor(width)),
    height: Math.max(minSize, Math.floor(height)),
  };
}

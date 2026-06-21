export interface PageCanvasSize {
  width: number;
  height: number;
}

export function calculatePageCanvasSize(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number,
): PageCanvasSize {
  const aspectRatio = naturalWidth / naturalHeight;

  let width = maxWidth;
  let height = width / aspectRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  return {
    width: Math.max(280, Math.floor(width)),
    height: Math.max(280, Math.floor(height)),
  };
}

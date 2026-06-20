'use client';
import { useEffect, useRef, useCallback } from 'react';
import { fabric } from 'fabric';

interface Props {
  pageNum: number;
  imageUrl: string;
  canvasJson: any | null;
}

export default function ReadOnlyCanvas({ pageNum, imageUrl, canvasJson }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);

  const applyBackground = useCallback((canvas: fabric.Canvas, url: string, width: number) => {
    return new Promise<void>((resolve) => {
      fabric.Image.fromURL(url, (fbImg) => {
        fbImg.scaleToWidth(width);
        canvas.setBackgroundImage(fbImg, () => {
          canvas.renderAll();
          resolve();
        });
      }, { crossOrigin: 'anonymous' });
    });
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    let isMounted = true;
    const width = containerRef.current.offsetWidth;
    const img = new Image();
    img.src = imageUrl;

    img.onload = async () => {
      if (!isMounted) return;
      const height = (img.naturalHeight / img.naturalWidth) * width;

      const canvas = new fabric.Canvas(canvasRef.current!, {
        width, height,
        isDrawingMode: false,
        selection: false,
      });
      // Make all objects non-interactive
      canvas.on('object:added', (e) => {
        if (e.target) {
          e.target.selectable = false;
          e.target.evented = false;
        }
      });

      fabricRef.current = canvas;
      await applyBackground(canvas, imageUrl, width);

      if (canvasJson) {
        canvas.loadFromJSON(canvasJson, async () => {
          // Disable selection on all loaded objects
          canvas.getObjects().forEach(obj => {
            obj.selectable = false;
            obj.evented = false;
          });
          if (containerRef.current) {
            await applyBackground(canvas, imageUrl, containerRef.current.offsetWidth);
          }
          canvas.renderAll();
        });
      }
    };

    return () => {
      isMounted = false;
      if (fabricRef.current) { fabricRef.current.dispose(); fabricRef.current = null; }
    };
  }, [pageNum, imageUrl, canvasJson, applyBackground]);

  return (
    <div ref={containerRef}
         className="w-full overflow-hidden"
         style={{
           background: 'var(--bg-card)',
           borderRadius: 'var(--radius-xl)',
           border: '1px solid var(--border-subtle)',
           boxShadow: 'var(--shadow-lg)',
         }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import PageDisplayFrame from '@/components/PageDisplayFrame';
import { calculatePageCanvasSize, type PageCanvasSize } from '@/lib/pageCanvas';

interface Props {
  pageNum: number;
  imageUrl: string;
  canvasJson: any | null;
}

export default function ReadOnlyCanvas({ pageNum, imageUrl, canvasJson }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const [canvasSize, setCanvasSize] = useState<PageCanvasSize | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    let isMounted = true;
    setCanvasSize(null);
    setReady(false);
    const img = new Image();
    img.src = imageUrl;

    img.onload = async () => {
     if (!isMounted) return;

     const widthLimit = Math.max(280, containerRef.current!.clientWidth);
     const heightLimit = Math.max(320, window.innerHeight - 24);
     // Use the page's real intrinsic dims (not a fixed 800x1132) so the box hugs the page and
     // matches the aspect annotations were saved at — a fixed aspect letterboxes the page and
     // misaligns the marks. minSize 1: never force-widen a narrow column and break aspect.
     const fitSize = calculatePageCanvasSize(
       img.naturalWidth || 827,
       img.naturalHeight || 1158,
       widthLimit,
       heightLimit,
       1,
     );
     setCanvasSize(fitSize);

     // Supersample the read-only share view too, so the shared page renders as crisp as the
     // editable reader. Backing-store resolution only; coordinate space stays at the fit box.
     (fabric as unknown as { devicePixelRatio: number }).devicePixelRatio =
       (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1) * 1.5;

     const canvas = new fabric.Canvas(canvasRef.current!, {
       width: fitSize.width,
       height: fitSize.height,
       isDrawingMode: false,
       selection: false,
       enableRetinaScaling: true,
       imageSmoothingEnabled: true,
     });
     canvas.setDimensions({ width: fitSize.width, height: fitSize.height });

     fabricRef.current = canvas;

     // Set background image
     fabric.Image.fromURL(imageUrl, (fbImg) => {
       if (!isMounted) return;
       fbImg.scaleToWidth(fitSize.width);
       canvas.setBackgroundImage(fbImg, () => {
         try { canvas.renderAll(); } catch { /* canvas disposed */ }
         if (isMounted) setReady(true);
       });
     }, { crossOrigin: 'anonymous' });

     // Make all objects non-interactive
     canvas.on('object:added', (e) => {
       if (e.target) {
         e.target.selectable = false;
         e.target.evented = false;
       }
     });

     // Load annotations if provided
    if (canvasJson) {
      canvas.loadFromJSON(canvasJson, () => {

        const originalWidth = canvasJson.width;

        if (originalWidth) {
          // Uniform WIDTH ratio on both axes: the page is width-filled + top-aligned, so the
          // saved box height is irrelevant. Scaling Y by a height ratio drifts marks vertically
          // whenever the saved box aspect differs from the current one (the misalignment).
          const ratio = fitSize.width / originalWidth;
          canvas.getObjects().forEach((obj) => {
            obj.scaleX = (obj.scaleX ?? 1) * ratio;
            obj.scaleY = (obj.scaleY ?? 1) * ratio;
            obj.left = (obj.left ?? 0) * ratio;
            obj.top = (obj.top ?? 0) * ratio;
            obj.setCoords();
          });
        }

        canvas.getObjects().forEach(obj => {
          obj.selectable = false;
          obj.evented = false;
        });

        canvas.renderAll();
      });
    }
    };

    return () => {
     isMounted = false;
     if (fabricRef.current) {
       fabricRef.current.dispose();
       fabricRef.current = null;
     }
    };
  }, [pageNum, imageUrl, canvasJson]);

  return (
    <PageDisplayFrame containerRef={containerRef} size={canvasSize} maxHeightOffset={24} ready={ready}>
      <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }} />
    </PageDisplayFrame>
  );
}

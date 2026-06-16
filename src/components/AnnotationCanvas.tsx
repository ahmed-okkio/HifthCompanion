'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import { createClient } from '@/lib/supabase/client';
import type { AnnotationSet } from '@/types';

interface Props {
  pageNum: number;
  imageUrl: string;
  sets: Pick<AnnotationSet, 'id' | 'name'>[];
  user: { id: string } | null;
}

const SAVE_DELAY_MS = 1500; // debounce

export default function AnnotationCanvas({ pageNum, imageUrl, sets, user }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = createClient();

  const [selectedSetId, setSelectedSetId] = useState<string>(sets[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  
  // Track what's currently loaded to avoid redundant reloads
  const lastLoadedRef = useRef<{ setId: string; pageNum: number } | null>(null);

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

  const saveCanvas = useCallback(async (canvas: fabric.Canvas, setId: string, page: number) => {
    if (!user || !setId) return;
    
    setSaving(true);
    try {
      const json = canvas.toJSON();
      // Remove background image from JSON to save space and avoid restoration issues
      delete (json as any).backgroundImage;
      
      const { error } = await supabase.from('annotations').upsert(
        { 
          set_id: setId, 
          page_number: page, 
          canvas_json: json, 
          updated_at: new Date().toISOString() 
        },
        { onConflict: 'set_id,page_number' }
      );

      if (error) {
        console.error('[AnnotationCanvas] Save error:', error);
      } else {
        console.log('[AnnotationCanvas] Save successful');
      }
    } catch (err) {
      console.error('[AnnotationCanvas] Unexpected save error:', err);
    } finally {
      setSaving(false);
    }
  }, [user, supabase]);

  const scheduleSave = useCallback(() => {
    if (!user || !selectedSetId || !fabricRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    
    saveTimerRef.current = setTimeout(() => {
      saveCanvas(fabricRef.current!, selectedSetId, pageNum);
    }, SAVE_DELAY_MS);
  }, [selectedSetId, pageNum, saveCanvas, user]);

  const loadAnnotation = useCallback(async (canvas: fabric.Canvas, setId: string, page: number) => {
    if (lastLoadedRef.current?.setId === setId && lastLoadedRef.current?.pageNum === page) {
      return;
    }

    const { data, error } = await supabase
      .from('annotations')
      .select('canvas_json')
      .eq('set_id', setId)
      .eq('page_number', page)
      .maybeSingle();

    if (error) {
      console.error('[AnnotationCanvas] Load error:', error);
      return;
    }

    // loadFromJSON clears everything.
    // We must ensure the background is re-applied AFTER or DURING restoration.
    if (data?.canvas_json) {
      canvas.loadFromJSON(data.canvas_json, async () => {
        // Re-apply the background image because loadFromJSON might have cleared it
        if (containerRef.current) {
           await applyBackground(canvas, imageUrl, containerRef.current.offsetWidth);
        }
        canvas.renderAll();
        lastLoadedRef.current = { setId, pageNum: page };
      });
    } else {
      // No saved annotations, just clear objects (keeping background if already set)
      canvas.getObjects().forEach(obj => canvas.remove(obj));
      canvas.renderAll();
      lastLoadedRef.current = { setId, pageNum: page };
    }
  }, [supabase, imageUrl, applyBackground]);

  // Init Fabric canvas
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
        width,
        height,
        isDrawingMode: !!user && !!selectedSetId,
      });

      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.width = 3;
      canvas.freeDrawingBrush.color = '#ef4444';

      fabricRef.current = canvas;
      // @ts-ignore
      window.fabricCanvas = canvas;

      // Initial background load
      await applyBackground(canvas, imageUrl, width);
      
      if (selectedSetId && isMounted) {
        loadAnnotation(canvas, selectedSetId, pageNum);
      }

      // Events
      const handleSave = () => scheduleSave();
      canvas.on('path:created', handleSave);
      canvas.on('object:modified', handleSave);
      canvas.on('object:removed', handleSave);
    };

    return () => {
      isMounted = false;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        if (fabricRef.current && selectedSetId) {
          saveCanvas(fabricRef.current, selectedSetId, pageNum);
        }
      }
      
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }
    };
  }, [pageNum, imageUrl, user, applyBackground]); // Re-init on page change or auth change

  // Handle set change without re-initializing canvas
  useEffect(() => {
    const canvas = fabricRef.current;
    if (canvas) {
      canvas.isDrawingMode = !!user && !!selectedSetId;
      if (selectedSetId) {
        loadAnnotation(canvas, selectedSetId, pageNum);
      }
    }
  }, [selectedSetId, user, pageNum, loadAnnotation]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-stone-100">
        {user ? (
          <div className="flex items-center gap-3 text-stone-700 text-sm">
            {sets.length > 0 ? (
              <>
                <label htmlFor="set-picker" className="font-medium">Annotation Set:</label>
                <select
                  id="set-picker"
                  value={selectedSetId}
                  onChange={e => setSelectedSetId(e.target.value)}
                  className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                >
                  {sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </>
            ) : (
              <p className="text-stone-500 italic">No sets found. <a href="/sets" className="text-emerald-600 hover:underline">Create one</a> to start drawing.</p>
            )}
            {saving && (
              <div className="flex items-center gap-1.5 text-stone-400 text-xs animate-pulse ml-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                Saving...
              </div>
            )}
          </div>
        ) : (
          <p className="text-stone-500 text-sm">
            <a href="/login" className="text-emerald-600 font-semibold hover:underline">Log in</a> to annotate this page.
          </p>
        )}
      </div>

      <div 
        ref={containerRef} 
        className="w-full bg-white shadow-xl rounded-2xl overflow-hidden border border-stone-100 transition-all duration-300"
      >
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

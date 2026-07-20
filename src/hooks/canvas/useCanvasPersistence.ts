import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { fabric } from 'fabric';
import { createClient } from '@/lib/supabase/client';
import { createAnnotationStore, type CanvasJson } from '@/lib/annotationStore';
import { pruneDegenerate, clusterCount } from '@/lib/markedPages';
import { CanvasHistory } from '@/lib/canvasHistory';
import { TOTAL_PAGES } from '@/lib/quran';
import { type PageCanvasSize } from '@/lib/pageCanvas';

type AnnotCacheEntry = { json: CanvasJson | null };
const annotCache = new Map<string, AnnotCacheEntry>();
const annotKey = (setId: string, page: number) => `${setId}:${page}`;
const objectsSig = (j: CanvasJson | null) => JSON.stringify((j as any)?.objects ?? []);

const SAVE_DELAY_MS = 1500;
const SKELETON_DELAY_MS = 140;

export function lockMark(o: fabric.Object | undefined) {
  if (!o || o.type === 'i-text' || o.type === 'text') return;
  o.set({ selectable: false, hasControls: false, hasBorders: false });
}

interface UseCanvasPersistenceProps {
  pageNum: number;
  imageUrl: string;
  user: { id: string } | null;
  selectedSetId: string;
  lockedSet?: boolean;
  onCommit?: () => void;
  onSaved?: (setId: string, page: number, count: number) => void;
  fabricRef: React.MutableRefObject<fabric.Canvas | null>;
  historyRef: React.MutableRefObject<CanvasHistory | null>;
  setCanvasReady: React.Dispatch<React.SetStateAction<boolean>>;
  sizeCanvasForImage: (canvas: fabric.Canvas, natW: number, natH: number) => PageCanvasSize;
  rescaleObjects: (canvas: fabric.Canvas, ratio: number) => void;
  loadedKeyRef: React.MutableRefObject<{ setId: string; page: number } | null>;
}

export function useCanvasPersistence({
  pageNum, imageUrl, user, selectedSetId, lockedSet = false,
  onCommit, onSaved, fabricRef, historyRef, setCanvasReady,
  sizeCanvasForImage, rescaleObjects, loadedKeyRef
}: UseCanvasPersistenceProps) {
  const [saving, setSaving] = useState(false);
  const [accessRevoked, setAccessRevoked] = useState(false);
  const accessRevokedRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skeletonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeLoadSetIdRef = useRef<string | null>(null);
  const lastLoadedRef = useRef<{ setId: string; pageNum: number } | null>(null);
  const lastSnapshotAtRef = useRef<number>(0);
  const isLoadingRef = useRef(false);
  const userEditedSinceLoadRef = useRef(false);

  const supabase = useMemo(() => createClient(), []);
  const store = useMemo(() => createAnnotationStore(supabase), [supabase]);

  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  const refreshHistory = useCallback(() => {
    const h = historyRef.current;
    if (h) {
      setCanUndo(h.canUndo());
      setCanRedo(h.canRedo());
    }
  }, [historyRef]);

  const commit = useCallback((force = false) => {
    if (isLoadingRef.current) return;
    userEditedSinceLoadRef.current = true;
    if (historyRef.current?.restoring) return;
    const now = Date.now();
    if (!force && now - lastSnapshotAtRef.current < 120) return;
    lastSnapshotAtRef.current = now;
    historyRef.current?.snapshot();
    refreshHistory();
    onCommitRef.current?.();
  }, [historyRef, refreshHistory]);

  const commitRef = useRef(commit);
  commitRef.current = commit;

  const scheduleSkeleton = useCallback(() => {
    if (skeletonTimerRef.current) return;
    skeletonTimerRef.current = setTimeout(() => {
      skeletonTimerRef.current = null;
      setCanvasReady(false);
    }, SKELETON_DELAY_MS);
  }, [setCanvasReady]);

  const cancelSkeleton = useCallback(() => {
    if (skeletonTimerRef.current) { clearTimeout(skeletonTimerRef.current); skeletonTimerRef.current = null; }
  }, []);

  useEffect(() => () => cancelSkeleton(), [cancelSkeleton]);

  useEffect(() => {
    const w = window as any;
    const set: Set<() => void> = w.__hifthCanvasSkeletons ?? (w.__hifthCanvasSkeletons = new Set());
    set.add(scheduleSkeleton);
    return () => { set.delete(scheduleSkeleton); };
  }, [scheduleSkeleton]);

  const saveCanvas = useCallback(async (canvas: fabric.Canvas, setId: string, page: number) => {
    if (!user || !setId || accessRevokedRef.current) return;
    setSaving(true);
    try {
      const json = canvas.toJSON();
      delete (json as any).backgroundImage;
      (json as any).objects = pruneDegenerate((json as any).objects ?? []);
      const payload: CanvasJson = { width: canvas.getWidth(), height: canvas.getHeight(), ...(json as any) };
      const count = payload.objects.length === 0
        ? 0
        : clusterCount(payload.objects as any, Math.max(16, Math.round(canvas.getWidth() * 0.03)));
      const r = await store.save(setId, page, payload, count);
      if (r.status === 'saved') {
        annotCache.set(annotKey(setId, page), { json: count === 0 ? null : payload });
        onSavedRef.current?.(setId, page, count);
      } else if (r.status === 'denied') {
        if (lockedSet) {
          accessRevokedRef.current = true;
          setAccessRevoked(true);
          if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
        } else {
          console.error('[AnnotationCanvas] Save denied (owner):', setId, page);
        }
      } else if (r.status === 'error') {
        console.error('[AnnotationCanvas] Save error:', r.err);
      }
    } catch (err) {
      console.error('[AnnotationCanvas] Unexpected save error:', err);
    } finally {
      setSaving(false);
    }
  }, [user, store, lockedSet]);

  const scheduleSave = useCallback(() => {
    if (!user || !selectedSetId || !fabricRef.current || accessRevokedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveCanvas(fabricRef.current!, selectedSetId, pageNum);
    }, SAVE_DELAY_MS);
  }, [selectedSetId, pageNum, saveCanvas, user, fabricRef]);

  const saveNow = useCallback(async () => {
    if (!user || !selectedSetId || !fabricRef.current || accessRevokedRef.current) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await saveCanvas(fabricRef.current, selectedSetId, pageNum);
  }, [pageNum, saveCanvas, selectedSetId, user, fabricRef]);

  const scheduleSaveRef = useRef(scheduleSave);
  const saveNowRef = useRef(saveNow);
  scheduleSaveRef.current = scheduleSave;
  saveNowRef.current = saveNow;

  useEffect(() => {
    const w = window as any;
    const savers: Set<() => Promise<void>> = w.__hifthReaderSavers ?? (w.__hifthReaderSavers = new Set());
    savers.add(saveNow);
    w.__hifthFlushReaderCanvas = async () => { await Promise.all([...savers].map((fn) => fn())); };
    return () => {
      savers.delete(saveNow);
      if (savers.size === 0) delete w.__hifthFlushReaderCanvas;
    };
  }, [saveNow]);

  const prefetchAdjacent = useCallback((setId: string, page: number) => {
    const idle: (cb: () => void) => void = (window as any).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 300));
    idle(() => {
      for (const pg of [page - 1, page + 1]) {
        if (pg < 1 || pg > TOTAL_PAGES) continue;
        const k = annotKey(setId, pg);
        if (annotCache.has(k)) continue;
        store.load(setId, pg).then(json => annotCache.set(k, { json })).catch(() => {});
      }
    });
  }, [store]);

  const applyBackground = useCallback((canvas: fabric.Canvas, url: string) => {
    return new Promise<PageCanvasSize>((resolve) => {
      fabric.Image.fromURL(url, (fbImg) => {
        const natW = (fbImg.width as number) || 1;
        const natH = (fbImg.height as number) || 1;
        const fit = sizeCanvasForImage(canvas, natW, natH);
        fbImg.scaleToWidth(fit.width);
        canvas.setBackgroundImage(fbImg, () => {
          try { canvas.renderAll(); } catch { /* disposed */ }
          resolve(fit);
        });
      }, { crossOrigin: 'anonymous' });
    });
  }, [sizeCanvasForImage]);

  const loadAnnotation = useCallback(async (canvas: fabric.Canvas, setId: string, page: number) => {
    if (lastLoadedRef.current?.setId === setId && lastLoadedRef.current?.pageNum === page) return;
    activeLoadSetIdRef.current = setId;
    isLoadingRef.current = true;
    scheduleSkeleton();

    const alive = () => activeLoadSetIdRef.current === setId && (canvas as any).lowerCanvasEl != null;

    const render = (json: CanvasJson | null) => new Promise<void>((resolve) => {
      if (!alive()) return resolve();
      const finish = async () => {
        const fit = await applyBackground(canvas, imageUrl);
        if (!alive()) return resolve();
        if (json) rescaleObjects(canvas, json.width ? fit.width / json.width : 1);
        canvas.getObjects().forEach(lockMark);
        canvas.renderAll();
        historyRef.current?.clear();
        historyRef.current?.snapshot();
        refreshHistory();
        resolve();
      };
      if (json) canvas.loadFromJSON(json, finish);
      else { canvas.clear(); void finish(); }
    });

    const settle = () => {
      cancelSkeleton();
      lastLoadedRef.current = { setId, pageNum: page };
      isLoadingRef.current = false;
      userEditedSinceLoadRef.current = false;
      setCanvasReady(true);
      prefetchAdjacent(setId, page);
    };

    const key = annotKey(setId, page);
    const cached = annotCache.get(key);

    if (cached) {
      await render(cached.json);
      if (!alive()) return;
      settle();
    }

    let fresh: CanvasJson | null;
    try {
      fresh = await store.load(setId, page);
    } catch (error) {
      console.error('[AnnotationCanvas] Load error:', error);
      if (!cached) {
        // Nothing rendered for this page yet, so the canvas still holds the PREVIOUS
        // page's objects. Leaving them would let the next save write them under this
        // page's key. Clear to empty rather than persist another page's marks.
        if (alive()) { canvas.clear(); void applyBackground(canvas, imageUrl); }
        isLoadingRef.current = false;
        userEditedSinceLoadRef.current = false;
        cancelSkeleton();
        setCanvasReady(true);
      }
      return;
    }
    annotCache.set(key, { json: fresh });
    if (!alive()) return;

    if (!cached) {
      await render(fresh);
      if (!alive()) return;
      settle();
    } else if (objectsSig(fresh) !== objectsSig(cached.json)
        && !userEditedSinceLoadRef.current && !saveTimerRef.current) {
      await render(fresh);
      if (!alive()) return;
      userEditedSinceLoadRef.current = false;
    }
  }, [store, imageUrl, applyBackground, rescaleObjects, refreshHistory, prefetchAdjacent, scheduleSkeleton, cancelSkeleton, historyRef, setCanvasReady]);

  const handleUndo = useCallback(() => {
    historyRef.current?.undo(() => { scheduleSave(); refreshHistory(); });
    refreshHistory();
  }, [scheduleSave, refreshHistory, historyRef]);

  const handleRedo = useCallback(() => {
    historyRef.current?.redo(() => { scheduleSave(); refreshHistory(); });
    refreshHistory();
  }, [scheduleSave, refreshHistory, historyRef]);

  const handleClear = useCallback((skipConfirm = false) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (skipConfirm !== true && !confirm('Clear all annotations on this page?')) return;
    canvas.getObjects().forEach(obj => canvas.remove(obj));
    canvas.renderAll();
    commit(true);
    scheduleSave();
  }, [commit, scheduleSave, fabricRef]);

  // Unmount-only cleanup (original lived inside the mount-only init effect). Live values come
  // from refs so page/set changes don't re-run this and race the orchestrator's own flush.
  const cleanupRef = useRef({ selectedSetId, pageNum, saveCanvas });
  cleanupRef.current = { selectedSetId, pageNum, saveCanvas };
  useEffect(() => {
    return () => {
      const { selectedSetId: setId, pageNum: page, saveCanvas: save } = cleanupRef.current;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        if (fabricRef.current && setId) save(fabricRef.current, setId, page);
      }
      lastLoadedRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    saving, accessRevoked, canUndo, canRedo,
    commit, commitRef, saveCanvas, saveNow, saveNowRef, scheduleSave, scheduleSaveRef,
    loadAnnotation, handleUndo, handleRedo, handleClear,
    refreshHistory, applyBackground, scheduleSkeleton
  };
}

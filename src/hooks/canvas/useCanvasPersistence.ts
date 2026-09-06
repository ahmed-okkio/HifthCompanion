import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { fabric } from 'fabric';
import { createClient } from '@/lib/supabase/client';
import { createAnnotationStore, type CanvasJson } from '@/lib/annotationStore';
import { pruneDegenerate, clusterCount } from '@/lib/markedPages';
import { CanvasHistory } from '@/lib/canvasHistory';
import { TOTAL_PAGES } from '@/lib/quran';
import { type PageCanvasSize } from '@/lib/pageCanvas';
import { reconcileNoteBindings } from '@/lib/services/notes';

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
  // Identifies the load in flight by set AND page. Set-only would let a superseded load
  // (page N) keep rendering after the user moved to N+1, dropping N's marks onto N+1.
  const activeLoadKeyRef = useRef<string | null>(null);
  const lastLoadedRef = useRef<{ setId: string; pageNum: number } | null>(null);
  // The canvas instance the last load rendered into. A hot reload disposes + recreates the canvas
  // while lastLoadedRef (a preserved ref) still matches set/page — without this the dedup skips
  // the reload and leaves the fresh canvas empty (then the next save overwrites the DB).
  const lastLoadedCanvasRef = useRef<fabric.Canvas | null>(null);
  const lastSnapshotAtRef = useRef<number>(0);
  const isLoadingRef = useRef(false);
  const userEditedSinceLoadRef = useRef(false);
  // Unsaved changes exist. Distinct from userEditedSinceLoad, which stays true for the whole
  // visit to a page (it guards the empty-payload delete); this clears on every successful
  // write, so it answers "is a save actually owed?".
  const dirtyRef = useRef(false);

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
    // Above BOTH early-outs below: the canvas has really changed by here. The `restoring`
    // check skips undo/redo and the 120ms throttle skips a rapid second stroke — neither is
    // "nothing happened", and marking dirty after them would let saveNow drop the change.
    dirtyRef.current = true;
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
    // Nothing changed since the last successful write, so there is nothing to save. This guard
    // lives HERE rather than in any one caller because two separate paths flush on a page turn
    // and both block the incoming page: useGoToPage awaits the flush before router.push, and
    // useAnnotationCanvas's page-change effect awaits it before loadAnnotation. An
    // unconditional write meant leaving a page that merely HAD annotations cost a store.save
    // plus a reconcileNoteBindings round-trip before the next page could start loading. A
    // blank page never showed it, because the empty-payload guard below bailed first.
    if (!dirtyRef.current && !saveTimerRef.current) return;
    setSaving(true);
    try {
      const json = canvas.toJSON(['id'] as any);
      delete (json as any).backgroundImage;
      (json as any).objects = pruneDegenerate((json as any).objects ?? []);
      const payload: CanvasJson = { width: canvas.getWidth(), height: canvas.getHeight(), ...(json as any) };
      // Never let an empty payload DELETE a page unless the user actually emptied it. A blank
      // payload otherwise means a save raced the async load (fresh mount / hot reload leaves the
      // canvas momentarily empty), and deleting here would silently wipe saved annotations.
      // A real Clear routes through handleClear → commit(true), which sets userEditedSinceLoad.
      if (payload.objects.length === 0 && (!userEditedSinceLoadRef.current || canvas.getObjects().length > 0)) {
        console.warn('[AnnotationCanvas] Skipped empty save: no user edit since load (load/HMR race?)');
        dirtyRef.current = false;
        return;
      }
      const count = payload.objects.length === 0
        ? 0
        : clusterCount(payload.objects as any, Math.max(16, Math.round(canvas.getWidth() * 0.03)));
      // Cleared BEFORE the write, not after: an edit landing mid-flight re-dirties and is
      // picked up by the next save, instead of being swallowed by a late reset.
      dirtyRef.current = false;
      const r = await store.save(setId, page, payload, count);
      if (r.status !== 'saved') dirtyRef.current = true;
      if (r.status === 'saved') {
        annotCache.set(annotKey(setId, page), { json: count === 0 ? null : payload });
        onSavedRef.current?.(setId, page, count);
        // Notes follow the objects they're bound to. Only after a confirmed save, and only for
        // this page — a denied/failed write must not soft-delete anything. `handleClear` lands
        // here too, with an empty id list.
        const ids = (payload.objects as any[]).map(o => o?.id).filter(Boolean) as string[];
        const rec = await reconcileNoteBindings(setId, page, ids);
        if (rec.error) console.error('[AnnotationCanvas] Note reconcile error:', rec.error);
        else window.dispatchEvent(new CustomEvent('hifth:notes-stale', { detail: { setId, pageNum: page } }));
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
      // Clear before firing: a spent timer left in the ref reads as "a save is pending" to the
      // guard in saveCanvas, which would defeat it for the rest of the session.
      saveTimerRef.current = null;
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

  const cancelPendingSave = useCallback(() => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
  }, []);

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

  /** Pages either side to warm. 3, not 1, because of spread mode: a spread [N, N+1] moves to
   *  [N+2, N+3], and at radius 1 the two canvases only reach N+2 — so N+3 missed on EVERY
   *  forward flip. A miss is not just a slower annotation load: loadAnnotation renders (and
   *  therefore starts the page image) only after store.load resolves, so one miss serializes
   *  the PNG behind a DB round-trip and flashes the skeleton across the whole spread. */
  const PREFETCH_RADIUS = 3;

  const prefetchAdjacent = useCallback((setId: string, page: number) => {
    const idle: (cb: () => void) => void = (window as any).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 300));
    const around: number[] = [];
    for (let i = 1; i <= PREFETCH_RADIUS; i++) around.push(page - i, page + i);
    idle(() => {
      for (const pg of around) {
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
    if (lastLoadedRef.current?.setId === setId && lastLoadedRef.current?.pageNum === page
        && lastLoadedCanvasRef.current === canvas) return;
    const key = annotKey(setId, page);
    // Canvas contents are indeterminate from here until settle(): callers must not flush it
    // under any page key while a load is mid-flight.
    lastLoadedRef.current = null;
    activeLoadKeyRef.current = key;
    isLoadingRef.current = true;
    scheduleSkeleton();

    const alive = () => activeLoadKeyRef.current === key && (canvas as any).lowerCanvasEl != null;

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
      lastLoadedCanvasRef.current = canvas;
      isLoadingRef.current = false;
      userEditedSinceLoadRef.current = false;
      dirtyRef.current = false;
      setCanvasReady(true);
      prefetchAdjacent(setId, page);
    };

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
    scheduleSave(); // same save path ⇒ same note reconcile, one batch, no separate clear branch
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
    cancelPendingSave, lastLoadedRef,
    loadAnnotation, handleUndo, handleRedo, handleClear,
    refreshHistory, applyBackground, scheduleSkeleton
  };
}

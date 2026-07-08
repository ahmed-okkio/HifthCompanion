// Persistence seam for annotation canvas JSON. This lifts the load/save/RLS logic
// out of useAnnotationCanvas so it can be unit-tested and reused Fabric-free. It never
// imports fabric; callers hand it a plain CanvasJson (width/height/objects/...). Works
// with EITHER the browser or server Supabase client — both expose the same query chain.

export type CanvasJson = { objects: unknown[]; width: number; height: number; [k: string]: unknown };
export type SaveResult = { status: 'saved' } | { status: 'denied' } | { status: 'error'; err: unknown };

export interface AnnotationStore {
  load(setId: string, page: number): Promise<CanvasJson | null>;
  // `count` is the clustered mark count (proximity-grouped); persisted so the marked_pages
  // RPC returns it instead of raw jsonb_array_length. Defaults to raw object count.
  save(setId: string, page: number, payload: CanvasJson, count?: number): Promise<SaveResult>;
}

// A Supabase/Postgres error is an access-revoked signal only if it's an RLS/permission
// denial — code 42501 or a policy/permission message. Network/transient errors lack both.
export function isRlsDenial(error: { code?: string; message?: string } | null | undefined): boolean {
  if (error?.code === '42501') return true;
  const m = (error?.message ?? '').toLowerCase();
  return m.includes('row-level security') || m.includes('permission denied');
}

export function createAnnotationStore(supabase: any): AnnotationStore {
  return {
    async load(setId, page) {
      const { data, error } = await supabase
        .from('annotations').select('canvas_json')
        .eq('set_id', setId).eq('page_number', page).maybeSingle();
      if (error) throw error;
      return data?.canvas_json ?? null;
    },

    async save(setId, page, payload, count) {
      try {
        // Empty page carries no annotation — delete any existing row instead of
        // storing a `{objects:[]}` shell. Keeps the table free of junk rows as it grows.
        if (payload.objects.length === 0) {
          const { error } = await supabase.from('annotations')
            .delete().match({ set_id: setId, page_number: page });
          if (error) return isRlsDenial(error) ? { status: 'denied' } : { status: 'error', err: error };
          return { status: 'saved' };
        }
        const { error } = await supabase.from('annotations').upsert(
          { set_id: setId, page_number: page, canvas_json: payload, mark_count: count ?? payload.objects.length, updated_at: new Date().toISOString() },
          { onConflict: 'set_id,page_number' }
        );
        if (error) return isRlsDenial(error) ? { status: 'denied' } : { status: 'error', err: error };
        return { status: 'saved' };
      } catch (err) {
        return { status: 'error', err };
      }
    },
  };
}

// In-memory store for tests/previews. No denial simulation — denial is exercised
// against createAnnotationStore with a stub client.
export function createFakeAnnotationStore(seed?: Record<string, CanvasJson>): AnnotationStore {
  const map = new Map<string, CanvasJson>(Object.entries(seed ?? {}));
  const key = (setId: string, page: number) => `${setId}:${page}`;
  return {
    async load(setId, page) {
      return map.get(key(setId, page)) ?? null;
    },
    async save(setId, page, payload) {
      if (payload.objects.length === 0) map.delete(key(setId, page));
      else map.set(key(setId, page), payload);
      return { status: 'saved' };
    },
  };
}

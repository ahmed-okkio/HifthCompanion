import { sortMarked, type MarkedPage } from '@/lib/markedPages';

// S1/S2: marked pages for a set, counted DB-side via jsonb_array_length (see the
// marked_pages RPC migration) so the client never downloads full canvases. The RPC
// runs as invoker, so annotation RLS scopes rows to sets the caller may read.
export async function markedPages(supabase: any, setId: string): Promise<MarkedPage[]> {
  const { data, error } = await supabase.rpc('marked_pages', { p_set_id: setId });
  if (error) throw error;
  const rows: MarkedPage[] = (data ?? []).map((r: { page: number; count: number }) => ({
    page: r.page,
    count: r.count,
  }));
  return sortMarked(rows);
}

import { sortMarked, type MarkColors, type MarkedPage } from '@/lib/markedPages';

// S1/S2: marked pages for a set, counted DB-side via jsonb_array_length (see the
// marked_pages RPC migration) so the client never downloads full canvases. The RPC
// runs as invoker, so annotation RLS scopes rows to sets the caller may read.
export async function markedPages(supabase: any, setId: string): Promise<MarkedPage[]> {
  const { data, error } = await supabase.rpc('marked_pages', { p_set_id: setId });
  if (error) throw error;
  // `colors` is null for rows written before the mark_colors migration — those pages show
  // a total with no per-colour chips until their next save fills it in.
  const rows: MarkedPage[] = (data ?? []).map((r: { page: number; count: number; colors?: MarkColors | null }) => ({
    page: r.page,
    count: r.count,
    colors: r.colors ?? undefined,
  }));
  return sortMarked(rows);
}

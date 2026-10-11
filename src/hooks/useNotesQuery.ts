'use client';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { qk } from '@/lib/query/keys';
import type { Note } from '@/types';

/** One page's notes, read in the browser (PRD 0016 E1; RLS decides set access). Reader + share. */
export function useNotesQuery(setId: string | undefined, page: number | null) {
  return useQuery({
    queryKey: qk.notes(setId ?? '', page ?? 0),
    enabled: !!setId && !!page,
    queryFn: async (): Promise<Note[]> => {
      const { data, error } = await createClient()
        .from('notes')
        .select('*')
        .eq('set_id', setId!)
        .eq('page_number', page!)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

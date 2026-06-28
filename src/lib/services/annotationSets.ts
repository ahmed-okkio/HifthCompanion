'use server';

import { createClient, createClientAction } from '@/lib/supabase/server';
import type { AnnotationSet } from '@/types';

export async function getAnnotationSets(): Promise<AnnotationSet[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Scope to the caller: the teacher-shared-set RLS policy widens SELECT to also
  // return students' shared sets, so without this filter /sets leaks others' sets.
  const { data, error } = await supabase
    .from('annotation_sets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createAnnotationSet(name: string): Promise<AnnotationSet> {
  const supabase = await createClientAction();
  const { data, error } = await supabase
    .from('annotation_sets')
    .insert({ name: name.trim() })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAnnotationSet(id: string, name: string): Promise<void> {
  const supabase = await createClientAction();
  const { error } = await supabase
    .from('annotation_sets')
    .update({ name: name.trim() })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteAnnotationSet(id: string): Promise<void> {
  const supabase = await createClientAction();
  const { error } = await supabase
    .from('annotation_sets')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

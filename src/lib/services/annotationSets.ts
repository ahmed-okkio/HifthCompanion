'use server';

import { createClient, createClientAction } from '@/lib/supabase/server';
import type { AnnotationSet } from '@/types';

export async function getAnnotationSets(): Promise<AnnotationSet[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('annotation_sets')
    .select('*')
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

'use server';

import { createClient, createClientAction } from '@/lib/supabase/server';
import type { Halaqah } from '@/types';

/** Halaqat the current user teaches (created). */
export async function getTeachingHalaqat(): Promise<Halaqah[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('halaqah')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getHalaqah(id: string): Promise<Halaqah | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('halaqah')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/** Look up a halaqah by invite code (for the join flow). */
export async function getHalaqahByCode(code: string): Promise<Halaqah | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('halaqah')
    .select('*')
    .eq('invite_code', code.trim().toLowerCase())
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function createHalaqah(name: string): Promise<Halaqah> {
  const supabase = await createClientAction();
  // Insert with config defaults from the migration.
  const { data, error } = await supabase
    .from('halaqah')
    .insert({ name: name.trim() })
    .select()
    .single();

  if (error) throw error;

  // Creator joins as a teacher membership so member-scoped reads include them.
  const { error: memError } = await supabase
    .from('membership')
    .insert({ halaqah_id: data.id, role: 'teacher' });
  if (memError) throw memError;

  return data;
}

export async function updateHalaqahConfig(
  id: string,
  config: Partial<Pick<Halaqah, 'name' | 'log_types' | 'student_statuses' | 'teacher_statuses'>>,
): Promise<void> {
  const supabase = await createClientAction();
  const { error } = await supabase.from('halaqah').update(config).eq('id', id);
  if (error) throw error;
}

/** Rotate the invite code (M1-5). */
export async function rotateInviteCode(id: string): Promise<string> {
  const supabase = await createClientAction();
  const code = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const { error } = await supabase
    .from('halaqah')
    .update({ invite_code: code })
    .eq('id', id);
  if (error) throw error;
  return code;
}

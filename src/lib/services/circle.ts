'use server';

import { createClient, createClientAction } from '@/lib/supabase/server';
import type { Circle } from '@/types';

/** Circles the current user teaches (created). */
export async function getTeachingCircles(): Promise<Circle[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('circle')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getCircle(id: string): Promise<Circle | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('circle')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/** Look up a circle by invite code (for the join flow). */
export async function getCircleByCode(code: string): Promise<Circle | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('circle')
    .select('*')
    .eq('invite_code', code.trim().toLowerCase())
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function createCircle(name: string): Promise<Circle> {
  const supabase = await createClientAction();
  // Insert with config defaults from the migration.
  const { data, error } = await supabase
    .from('circle')
    .insert({ name: name.trim() })
    .select()
    .single();

  if (error) throw error;

  // Creator joins as a teacher membership so member-scoped reads include them.
  // Teacher's own membership is active (the consent gate only applies to students).
  const { error: memError } = await supabase
    .from('membership')
    .insert({ circle_id: data.id, role: 'teacher', status: 'active' });
  if (memError) throw memError;

  return data;
}

export async function updateCircleConfig(
  id: string,
  config: Partial<Pick<Circle, 'name' | 'student_statuses' | 'teacher_statuses'>>,
): Promise<void> {
  const supabase = await createClientAction();
  const { error } = await supabase.from('circle').update(config).eq('id', id);
  if (error) throw error;
}

/** Delete a circle (RLS: teacher-only). Memberships + their logs/sessions/homework
 *  cascade via FK. Student annotation sets are separate and untouched. */
export async function deleteCircle(id: string): Promise<void> {
  const supabase = await createClientAction();
  const { error } = await supabase.from('circle').delete().eq('id', id);
  if (error) throw error;
}

/** Rotate the invite code (M1-5). */
export async function rotateInviteCode(id: string): Promise<string> {
  const supabase = await createClientAction();
  const code = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const { error } = await supabase
    .from('circle')
    .update({ invite_code: code })
    .eq('id', id);
  if (error) throw error;
  return code;
}

'use server';

import { createClientAction, createClient } from '@/lib/supabase/server';
import type { Homework, LogType } from '@/types';

export type NewHomework = {
  membershipId: string;
  type: LogType;
  deadline?: string | null;
  page_start: number;
  page_end: number;
  surah?: number | null;
  ayah_start?: number | null;
  ayah_end?: number | null;
  instructions?: string | null;
};

/** Teacher prescribes homework for one student (D6/D9). prescribed_by defaults auth.uid(). */
export async function prescribeHomework(hw: NewHomework): Promise<Homework> {
  const supabase = await createClientAction();
  const { membershipId, ...rest } = hw;
  const { data, error } = await supabase
    .from('homework')
    .insert({ membership_id: membershipId, ...rest })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Homework rows for a membership (teacher or owning student per RLS). */
export async function listHomework(membershipId: string): Promise<Homework[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('homework')
    .select('*')
    .eq('membership_id', membershipId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Teacher edits a homework deadline — including reopening a missed one (D10/E5). */
export async function editDeadline(
  homeworkId: string,
  deadline: string | null,
): Promise<void> {
  const supabase = await createClientAction();
  const { error } = await supabase
    .from('homework')
    .update({ deadline })
    .eq('id', homeworkId);
  if (error) throw error;
}

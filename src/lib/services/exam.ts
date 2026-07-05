'use server';

import { createClient, createClientAction } from '@/lib/supabase/server';
import type { Exam, ExamStatus } from '@/types';

import { getPageForAyah, juzPageBounds } from '@/lib/quran';
import { wholeSurahPages } from '@/lib/homework';
import type { SurahEntry } from '@/lib/services/homework';

export async function getExamsForMembership(membershipId: string): Promise<Exam[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('exam')
    .select('*')
    .eq('membership_id', membershipId)
    .order('scheduled_date', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function scheduleExam(
  membershipId: string,
  scheduledDate: string,
  entries: SurahEntry[]
): Promise<Exam> {
  let minPage = 604, maxPage = 1;
  let surah = null, ayahStart = null, ayahEnd = null;

  for (const entry of entries) {
    let ps, pe;
    if (entry.kind === 'juz') {
      [ps, pe] = juzPageBounds(entry.juz);
    } else {
      const [wps, wpe] = wholeSurahPages(entry.surah);
      ps = entry.ayah_start ? getPageForAyah(entry.surah, entry.ayah_start) : wps;
      pe = entry.ayah_end ? getPageForAyah(entry.surah, entry.ayah_end) : wpe;
    }
    minPage = Math.min(minPage, ps);
    maxPage = Math.max(maxPage, pe);
  }

  if (entries.length === 1 && entries[0].kind === 'surah') {
    surah = entries[0].surah;
    ayahStart = entries[0].ayah_start;
    ayahEnd = entries[0].ayah_end;
  }

  const supabase = await createClientAction();
  const { data, error } = await supabase
    .from('exam')
    .insert({
      membership_id: membershipId,
      scheduled_date: scheduledDate,
      page_start: minPage,
      page_end: maxPage,
      surah,
      ayah_start: ayahStart,
      ayah_end: ayahEnd,
      entries,
      status: 'scheduled',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function gradeExam(
  examId: string,
  status: ExamStatus,
  notes: string | null
): Promise<Exam> {
  const supabase = await createClientAction();
  const { data, error } = await supabase
    .from('exam')
    .update({
      status,
      teacher_notes: notes,
    })
    .eq('id', examId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteExam(examId: string): Promise<void> {
  const supabase = await createClientAction();
  const { error } = await supabase.from('exam').delete().eq('id', examId);
  if (error) throw error;
}

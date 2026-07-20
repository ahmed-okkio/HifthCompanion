'use server';

import { createClientAction, createClient } from '@/lib/supabase/server';
import type { Homework, LogType } from '@/types';
import { wholeSurahPages } from '@/lib/homework';
import { getPageForAyah, juzPageBounds } from '@/lib/quran';
import { notifyHomework } from '@/lib/email/notify';

/**
 * One entry in a prescription: a surah (whole → null ayahs, or a narrowed range)
 * or a whole juz (stored surah-less as a page range, like a legacy page-only row).
 */
export type SurahEntry =
  | { kind: 'surah'; surah: number; ayah_start: number | null; ayah_end: number | null }
  | { kind: 'juz'; juz: number };

export type NewHomework = {
  membershipId: string;
  type: LogType;
  deadline?: string | null;
  instructions?: string | null;
  entries: SurahEntry[];
};

/**
 * Teacher prescribes Quran-aware homework for one student (issue 4, H2). Writes
 * N rows (one per surah) sharing a generated group_id, same type/deadline. Page
 * bounds are derived best-effort (whole surah → SURAH_FIRST_PAGES bounds; narrowed
 * → the pages of the first/last ayah) for reader-linking only.
 */
export async function prescribeHomework(hw: NewHomework): Promise<Homework[]> {
  const supabase = await createClientAction();
  const groupId = crypto.randomUUID();
  const rows = hw.entries.map((e) => {
    const base = {
      membership_id: hw.membershipId,
      group_id: groupId,
      type: hw.type,
      deadline: hw.deadline ?? null,
      instructions: hw.instructions ?? null,
    };
    if (e.kind === 'juz') {
      const [ps, pe] = juzPageBounds(e.juz);
      return { ...base, surah: null, ayah_start: null, ayah_end: null, page_start: ps, page_end: pe };
    }
    const [ps, pe] = wholeSurahPages(e.surah);
    return {
      ...base,
      surah: e.surah,
      ayah_start: e.ayah_start,
      ayah_end: e.ayah_end,
      page_start: e.ayah_start ? getPageForAyah(e.surah, e.ayah_start) : ps,
      page_end: e.ayah_end ? getPageForAyah(e.surah, e.ayah_end) : pe,
    };
  });
  const { data, error } = await supabase.from('homework').insert(rows).select();
  if (error) throw error;

  try {
    const pages = (data ?? []).flatMap((r: Homework) => [r.page_start, r.page_end]).filter(Boolean) as number[];
    const range = pages.length ? `pages ${Math.min(...pages)}-${Math.max(...pages)}` : hw.type;
    await notifyHomework(hw.membershipId, range, hw.deadline ?? null);
  } catch (err) {
    console.warn('[email] homework notify failed', (err as Error).message);
  }

  return data ?? [];
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

/** Teacher deletes a whole prescription group (all rows sharing group_id). RLS
    restricts this to the owning teacher; linked progress_logs have their
    homework_id nulled by the FK, so the student's submissions survive. */
export async function deleteHomework(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = await createClientAction();
  const { error } = await supabase.from('homework').delete().in('id', ids);
  if (error) throw error;
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

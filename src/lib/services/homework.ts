'use server';

import { after } from 'next/server';

import { createClientAction, createClient } from '@/lib/supabase/server';
import type { Homework, LogType, StatusConfig } from '@/types';
import { homeworkTarget, wholeSurahPages } from '@/lib/homework';
import { getPageForAyah, getSurahName, juzPageBounds } from '@/lib/quran';
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

  // Notification range reads like the card label ("Memorize Al-Baqara 1-20"),
  // not a page span — a whole surah says so instead of expanding to its ayahs.
  // ponytail: English only, like the page-range string it replaces; the Arabic
  // push still carries it verbatim.
  const range = notificationRange(hw.type, data ?? []);
  const actor = (await supabase.auth.getUser()).data.user?.id ?? null;
  after(() => notifyHomework(hw.membershipId, range, hw.deadline ?? null, actor));

  return data ?? [];
}

/** Readable "verb + target" for the homework notification (email + push). */
function notificationRange(type: LogType, rows: Homework[]): string {
  if (rows.length === 0) return type;
  const verb = type === 'memorization' ? 'Memorize' : 'Review';
  const whole = rows.length === 1 && rows[0].surah && rows[0].ayah_start == null
    ? `${getSurahName(rows[0].surah, 'en')} (whole)`
    : null;
  return `${verb} ${whole ?? homeworkTarget(rows, 'en', 'Juz')}`;
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

/**
 * One homework row plus what the reader's task banner needs to mark it: the circle's
 * grade vocabulary and whether a submission already exists. The banner otherwise reads
 * everything from the URL, but marking writes a progress_log against the prescription's
 * own scope — that scope lives on the row, so this one fetch is unavoidable.
 *
 * RLS decides visibility: the owning student, their teacher, and a covering substitute
 * see the row; anyone else gets null and the banner shows no control. `statuses` comes
 * back empty when the circle isn't readable, which downgrades the teacher's grade chips
 * to a plain mark rather than failing.
 */
export async function getHomeworkForBanner(id: string): Promise<
  { homework: Homework; statuses: StatusConfig[]; submitted: boolean } | null
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('homework')
    .select('*, membership:membership_id(circle:circle_id(teacher_statuses))')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;

  // supabase types the embedded relations as arrays; narrow to the single row.
  const { membership, ...homework } = data as Homework & {
    membership: { circle: { teacher_statuses: StatusConfig[] } | { teacher_statuses: StatusConfig[] }[] } | null;
  };
  const circle = Array.isArray(membership?.circle) ? membership?.circle[0] : membership?.circle;

  const { count } = await supabase
    .from('progress_log')
    .select('id', { count: 'exact', head: true })
    .eq('homework_id', id);

  return { homework, statuses: circle?.teacher_statuses ?? [], submitted: (count ?? 0) > 0 };
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

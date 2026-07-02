import type { Homework } from '@/types';

// Pure homework logic — no supabase import so B4 unit tests can import it freely.

export type HomeworkStatus = 'open' | 'completed' | 'missed';

/**
 * Derived homework status (D10). Status is never stored — computed from the
 * deadline and how many progress_log rows link to the prescription:
 *   - no deadline, or deadline today/future → 'open' (still submittable)
 *   - deadline past & ≥1 linked log            → 'completed'
 *   - deadline past & 0 linked logs            → 'missed'
 * `today` is a date-only "YYYY-MM-DD"; homework.deadline is the same shape.
 */
export function homeworkStatus(
  homework: Pick<Homework, 'deadline'>,
  linkedLogCount: number,
  today: string,
): HomeworkStatus {
  if (!homework.deadline || homework.deadline >= today) return 'open';
  return linkedLogCount >= 1 ? 'completed' : 'missed';
}

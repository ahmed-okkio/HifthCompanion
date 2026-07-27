import type { AgendaTask, AttendanceStatus, Exam, Homework, ProgressLog, Session } from '@/types';
import { homeworkStatus } from '@/lib/homework';

/** Half-width of the live window around a session's scheduled time, in minutes (D1). */
export const LIVE_WINDOW_MINUTES = 60;
/** An open item older than this reads as stale (E7). */
export const STALE_DAYS = 14;
/** Done items older than this drop out of the agenda listing (C1). */
export const DONE_RETENTION_DAYS = 30;

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/**
 * A session instant is live when `now` sits within ±60 minutes of it, inclusive
 * of both boundaries (D1, D2). Canceled sessions are never live (D3).
 * Pure: `now` is always passed in, like `sectionSessions` (D4).
 */
export function isLive(scheduledAt: string | Date, now: Date, canceled: boolean): boolean {
  if (canceled) return false;
  const at = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  return Math.abs(now.getTime() - at.getTime()) <= LIVE_WINDOW_MINUTES * MINUTE;
}

/** True once an item has been open for more than 14 days (E7). */
export function isStale(createdAt: string | Date, now: Date): boolean {
  const at = createdAt instanceof Date ? createdAt : new Date(createdAt);
  return now.getTime() - at.getTime() > STALE_DAYS * DAY;
}

/** Trimmed body, or null when there is nothing to save (C3). */
export function normalizeBody(body: string): string | null {
  const trimmed = body.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Open items oldest-first, then done items (last 30 days) newest-done-first
 * (C1, C2). Pure so the ordering is testable without a database.
 */
export function sectionAgenda(rows: AgendaTask[], now: Date): AgendaTask[] {
  const cutoff = now.getTime() - DONE_RETENTION_DAYS * DAY;
  const open = rows.filter((r) => r.done_at === null);
  const done = rows.filter((r) => r.done_at !== null && new Date(r.done_at).getTime() >= cutoff);
  open.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  done.sort((a, b) => new Date(b.done_at!).getTime() - new Date(a.done_at!).getTime());
  return [...open, ...done];
}

/** How far ahead an exam still counts as "coming up" (F4). */
export const EXAM_HORIZON_DAYS = 14;

/** The four derived parts of the waiting-on-you block (F1–F4). */
export interface WaitingOnYou {
  /** Homework due today or earlier with no linked submission (F1). */
  dueHomework: Homework[];
  /** Submissions not yet graded (F2). */
  ungraded: ProgressLog[];
  /** Most recent past session ONLY when its attendance is still unmarked (F3). */
  attendance: { session: Session } | null;
  /** Nearest scheduled exam within 14 days, else null (F4). */
  exam: Exam | null;
}

/**
 * Everything the teacher still owes before this session, derived from props the
 * page already loaded — no query of its own (F7). Returns null when all four
 * parts are empty so the caller renders nothing at all (F6).
 *
 * Deliberately does not touch `weakestSurahs` (F5). `now` is a parameter, never
 * the clock, same convention as `isLive` / `sectionSessions`.
 */
export function waitingOnYou(
  input: { homework: Homework[]; logs: ProgressLog[]; sessions: Session[]; exams: Exam[] },
  now: Date,
): WaitingOnYou | null {
  const today = now.toISOString().slice(0, 10);

  // Same linked-log tally the homework panel uses — homeworkStatus owns the rules.
  const linked = new Map<string, number>();
  for (const l of input.logs) if (l.homework_id) linked.set(l.homework_id, (linked.get(l.homework_id) ?? 0) + 1);

  const dueHomework = input.homework.filter((h) => {
    const count = linked.get(h.id) ?? 0;
    if (count > 0 || !h.deadline) return false;
    // 'missed' covers deadlines strictly in the past; due-today is still 'open'
    // to homeworkStatus but is "on or before today" here (F1).
    return homeworkStatus(h, count, today) === 'missed' || h.deadline === today;
  });

  const ungraded = input.logs.filter((l) => l.reviewed_at === null);

  const past = input.sessions
    .filter((s) => !s.canceled && new Date(s.scheduled_at).getTime() <= now.getTime())
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
  // Only an UNMARKED session is waiting on the teacher — present/late/absent/
  // excused are all settled, and surfacing them made the block nag about work
  // that was already done (F3, amended after PRD 0014 shipped).
  const attendance = past.length > 0 && past[0].attendance_status === null ? { session: past[0] } : null;

  const horizon = new Date(now.getTime() + EXAM_HORIZON_DAYS * DAY).toISOString().slice(0, 10);
  const exam = input.exams
    .filter((e) => e.status === 'scheduled' && e.scheduled_date <= horizon)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))[0] ?? null;

  if (dueHomework.length === 0 && ungraded.length === 0 && !attendance && !exam) return null;
  return { dueHomework, ungraded, attendance, exam };
}

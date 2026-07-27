import { describe, it, expect } from 'vitest';
import { isLive, isStale, normalizeBody, sectionAgenda, waitingOnYou } from '../lib/agenda';
import type { AgendaTask, Exam, Homework, ProgressLog, Session } from '../types';

const NOW = new Date('2026-07-24T12:00:00.000Z');
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000).toISOString();
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

function task(p: Partial<AgendaTask>): AgendaTask {
  return {
    id: Math.random().toString(36).slice(2),
    membership_id: 'm1',
    author_id: 't1',
    body: 'do the thing',
    done_at: null,
    created_at: days(0),
    updated_at: days(0),
    ...p,
  };
}

describe('isLive (D1-D3)', () => {
  it('is live at the scheduled instant', () => {
    expect(isLive(minutes(0), NOW, false)).toBe(true);
  });

  it('is live exactly 60 minutes before and after (inclusive boundaries)', () => {
    expect(isLive(minutes(60), NOW, false)).toBe(true); // starts in 60 min
    expect(isLive(minutes(-60), NOW, false)).toBe(true); // started 60 min ago
  });

  it('is not live 61 minutes either side', () => {
    expect(isLive(minutes(61), NOW, false)).toBe(false);
    expect(isLive(minutes(-61), NOW, false)).toBe(false);
  });

  it('is never live when canceled, even inside the window', () => {
    expect(isLive(minutes(0), NOW, true)).toBe(false);
    expect(isLive(minutes(-30), NOW, true)).toBe(false);
  });
});

describe('isStale (E7)', () => {
  it('is false at exactly 14 days and true past it', () => {
    expect(isStale(days(-14), NOW)).toBe(false);
    expect(isStale(days(-15), NOW)).toBe(true);
    expect(isStale(days(-1), NOW)).toBe(false);
  });
});

describe('normalizeBody (C3)', () => {
  it('trims and rejects empty or whitespace-only bodies', () => {
    expect(normalizeBody('  hello  ')).toBe('hello');
    expect(normalizeBody('')).toBeNull();
    expect(normalizeBody('   \n\t ')).toBeNull();
  });
});

describe('sectionAgenda (C1, C2)', () => {
  it('returns open items oldest-first ahead of done items newest-done-first', () => {
    const rows = [
      task({ id: 'open-new', created_at: days(-1) }),
      task({ id: 'done-old', created_at: days(-40), done_at: days(-20) }),
      task({ id: 'open-old', created_at: days(-10) }),
      task({ id: 'done-new', created_at: days(-40), done_at: days(-2) }),
    ];
    expect(sectionAgenda(rows, NOW).map((r) => r.id)).toEqual([
      'open-old',
      'open-new',
      'done-new',
      'done-old',
    ]);
  });

  it('drops done items older than 30 days but keeps open items of any age', () => {
    const rows = [
      task({ id: 'ancient-open', created_at: days(-400) }),
      task({ id: 'just-inside', done_at: days(-29) }),
      task({ id: 'just-outside', done_at: days(-31) }),
    ];
    expect(sectionAgenda(rows, NOW).map((r) => r.id)).toEqual(['ancient-open', 'just-inside']);
  });
});

// ---- F1-F7: waiting-on-you derivation -------------------------------------

const TODAY = NOW.toISOString().slice(0, 10);
const date = (n: number) => days(n).slice(0, 10);

function hw(p: Partial<Homework>): Homework {
  return {
    id: Math.random().toString(36).slice(2),
    membership_id: 'm1', prescribed_by: 't1', group_id: null, type: 'memorization',
    deadline: TODAY, page_start: 1, page_end: 1, surah: null, ayah_start: null, ayah_end: null,
    instructions: null, created_at: days(-5), ...p,
  };
}

function log(p: Partial<ProgressLog>): ProgressLog {
  return {
    id: Math.random().toString(36).slice(2),
    membership_id: 'm1', homework_id: null, log_date: TODAY, log_type: 'memorization',
    page_start: 1, page_end: 1, surah: null, ayah_start: null, ayah_end: null,
    student_status: null, student_notes: null, teacher_status: null, teacher_comment: null,
    reviewed_at: null, created_at: days(0), updated_at: days(0), ...p,
  };
}

function session(p: Partial<Session>): Session {
  return {
    id: Math.random().toString(36).slice(2),
    membership_id: 'm1', scheduled_at: days(-1), is_adhoc: false, canceled: false,
    attendance_status: null, moved_from: null, created_at: days(-10), ...p,
  };
}

function exam(p: Partial<Exam>): Exam {
  return {
    id: Math.random().toString(36).slice(2),
    membership_id: 'm1', scheduled_date: date(3), page_start: 1, page_end: 1,
    surah: null, ayah_start: null, ayah_end: null, entries: [], status: 'scheduled',
    teacher_notes: null, created_at: days(-1), ...p,
  };
}

const EMPTY = { homework: [], logs: [], sessions: [], exams: [] };

describe('waitingOnYou (F1-F7)', () => {
  it('F6: renders nothing when every part is empty', () => {
    expect(waitingOnYou(EMPTY, NOW)).toBeNull();
  });

  it('F1: homework due today with no submission counts; due tomorrow does not', () => {
    const dueToday = hw({ deadline: TODAY });
    const dueTomorrow = hw({ deadline: date(1) });
    const w = waitingOnYou({ ...EMPTY, homework: [dueToday, dueTomorrow] }, NOW)!;
    expect(w.dueHomework.map((h) => h.id)).toEqual([dueToday.id]);
  });

  it('F1: overdue homework counts, and a linked submission clears it', () => {
    const overdue = hw({ deadline: date(-3) });
    const submitted = hw({ deadline: date(-3) });
    const w = waitingOnYou(
      { ...EMPTY, homework: [overdue, submitted], logs: [log({ homework_id: submitted.id, reviewed_at: days(0) })] },
      NOW,
    )!;
    expect(w.dueHomework.map((h) => h.id)).toEqual([overdue.id]);
  });

  it('F1: homework with no deadline is never listed', () => {
    expect(waitingOnYou({ ...EMPTY, homework: [hw({ deadline: null })] }, NOW)).toBeNull();
  });

  it('F2: only ungraded submissions are listed', () => {
    const pending = log({ reviewed_at: null });
    const graded = log({ reviewed_at: days(0) });
    const w = waitingOnYou({ ...EMPTY, logs: [pending, graded] }, NOW)!;
    expect(w.ungraded.map((l) => l.id)).toEqual([pending.id]);
  });

  it('F3: reports the most recent past session, ignoring future and canceled ones', () => {
    const recent = session({ scheduled_at: days(-1), attendance_status: null });
    const older = session({ scheduled_at: days(-9), attendance_status: null });
    const future = session({ scheduled_at: days(2) });
    const canceled = session({ scheduled_at: days(-0.5), canceled: true });
    const w = waitingOnYou({ ...EMPTY, sessions: [older, future, canceled, recent] }, NOW)!;
    expect(w.attendance?.session.id).toBe(recent.id);
  });

  it('F3: an unmarked past session surfaces', () => {
    const w = waitingOnYou({ ...EMPTY, sessions: [session({ attendance_status: null })] }, NOW)!;
    expect(w.attendance).not.toBeNull();
  });

  // Amended after PRD 0014 shipped: a marked session is settled, so nothing is
  // waiting on the teacher — excused/present/late/absent all produce no row.
  it('F3: a marked past session produces no row, whatever the status', () => {
    for (const status of ['present', 'late', 'absent', 'excused'] as const) {
      expect(waitingOnYou({ ...EMPTY, sessions: [session({ attendance_status: status })] }, NOW)).toBeNull();
    }
  });

  it('F3: a marked recent session hides an older unmarked one', () => {
    const recent = session({ scheduled_at: days(-1), attendance_status: 'excused' });
    const older = session({ scheduled_at: days(-9), attendance_status: null });
    expect(waitingOnYou({ ...EMPTY, sessions: [older, recent] }, NOW)).toBeNull();
  });

  it('F4: an exam exactly 14 days out is shown; 15 days out is not', () => {
    expect(waitingOnYou({ ...EMPTY, exams: [exam({ scheduled_date: date(14) })] }, NOW)?.exam).toBeTruthy();
    expect(waitingOnYou({ ...EMPTY, exams: [exam({ scheduled_date: date(15) })] }, NOW)).toBeNull();
  });

  it('F4: a graded exam inside the window produces no row', () => {
    expect(waitingOnYou({ ...EMPTY, exams: [exam({ scheduled_date: date(2), status: 'passed' })] }, NOW)).toBeNull();
  });

  it('F4: the nearest scheduled exam wins', () => {
    const near = exam({ scheduled_date: date(2) });
    const w = waitingOnYou({ ...EMPTY, exams: [exam({ scheduled_date: date(10) }), near] }, NOW)!;
    expect(w.exam?.id).toBe(near.id);
  });
});

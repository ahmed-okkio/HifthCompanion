'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { useI18n } from '@/components/I18nProvider';
import { ActionButton, Icon } from '@/components/tracker/ui';
import { gradeExam } from '@/lib/services/exam';
import { getHomeworkForBanner } from '@/lib/services/homework';
import { createLog, logAndReview } from '@/lib/services/progressLog';
import type { ExamStatus, StatusConfig } from '@/types';

type HomeworkTask = Awaited<ReturnType<typeof getHomeworkForBanner>>;

/**
 * "Why you're here" strip above the mushaf, shown when the reader was opened
 * from a homework or exam card (`?task=exam&id=…&t=<label>`, built by MushafLink).
 * The label rides in the URL because the card that linked here already rendered
 * it — the reader needs no fetch to SAY what the task is.
 *
 * `g=1` (a teacher's or substitute's link) adds the marking control: pass/fail for
 * an exam, and for homework a graded submission against the prescription. RLS is
 * the real gate, so a hand-edited flag only buys a rejected write.
 *
 * Marking homework is the one thing that does fetch: the log copies the
 * prescription's scope (type, pages, surah/ayah), which lives on the row.
 */
export default function ReaderTaskBanner() {
  const params = useSearchParams();
  const { t } = useI18n();
  const [graded, setGraded] = useState<ExamStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState('');
  const [task, setTask] = useState<HomeworkTask>(null);
  const [marked, setMarked] = useState(false);

  const kind = params.get('task');
  const id = params.get('id');
  const label = params.get('t') ?? '';
  const canGrade = params.get('g') === '1';

  useEffect(() => {
    if (kind !== 'homework' || !id) return;
    let live = true;
    getHomeworkForBanner(id).then(r => { if (live) setTask(r); }).catch(() => {});
    return () => { live = false; };
  }, [kind, id]);

  if ((kind !== 'exam' && kind !== 'homework') || !id) return null;

  async function run(write: () => Promise<unknown>, done: () => void) {
    if (busy) return;
    setBusy(true);
    setFailed('');
    try {
      await write();
      done();
    } catch (e) {
      // The deadline hard-lock speaks for itself; anything else falls back to the generic copy.
      setFailed(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  }

  const grade = (status: ExamStatus) =>
    run(() => gradeExam(id!, status), () => setGraded(status));

  /** `status` null = the student's own plain submission; set = the teacher's graded one. */
  const mark = (status: string | null) => {
    const h = task?.homework;
    if (!h) return;
    const log = {
      membership_id: h.membership_id, homework_id: h.id, log_type: h.type,
      page_start: h.page_start, page_end: h.page_end,
      surah: h.surah, ayah_start: h.ayah_start, ayah_end: h.ayah_end,
    };
    return run(
      () => (status ? logAndReview({ ...log, teacher_status: status }) : createLog(log)),
      () => setMarked(true),
    );
  };

  const chip = (key: string, onClick: () => void, active: boolean, text: string) => (
    <ActionButton key={key} onClick={onClick} disabled={busy}
                  className={active ? 'btn btn-primary' : 'btn btn-outline'}
                  style={{ minHeight: 34, fontSize: 13 }}>
      {text}
    </ActionButton>
  );

  const controls = kind === 'exam'
    ? canGrade && (
        <>
          {chip('passed', () => grade('passed'), graded === 'passed', t('exam.statusPassed'))}
          {chip('failed', () => grade('failed'), graded === 'failed', t('exam.statusFailed'))}
        </>
      )
    // Already submitted (by either side) → say so instead of offering to submit again.
    : marked || task?.submitted
      ? <span className="badge" style={{ fontSize: 11 }}>{t('homework.statusCompleted')}</span>
      // A teacher with no configured statuses falls back to the plain mark.
      : task && (canGrade && task.statuses.length
          ? task.statuses.map((s: StatusConfig) => chip(s.label, () => mark(s.label), false, s.label))
          : chip('done', () => mark(null), false, t('homework.markDone')));

  return (
    <div className="card flex flex-wrap items-center gap-x-3 gap-y-2" style={{ padding: '10px 14px' }}>
      <span style={{ color: 'var(--text-accent)' }}><Icon name={kind === 'exam' ? 'cap' : 'book'} size={16} /></span>
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {t(kind === 'exam' ? 'exam.title' : 'homework.title')}
      </span>
      <span className="text-sm font-medium min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>{label}</span>

      {controls && (
        <span className="flex flex-wrap items-center gap-2" style={{ marginInlineStart: 'auto' }}>
          {failed && <span className="text-xs" style={{ color: 'var(--danger)' }}>{failed}</span>}
          {controls}
        </span>
      )}
    </div>
  );
}

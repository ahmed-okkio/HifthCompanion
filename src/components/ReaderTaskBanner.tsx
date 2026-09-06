'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { useI18n } from '@/components/I18nProvider';
import { ActionButton, Icon } from '@/components/tracker/ui';
import { gradeExam } from '@/lib/services/exam';
import type { ExamStatus } from '@/types';

/**
 * "Why you're here" strip above the mushaf, shown when the reader was opened
 * from a homework or exam card (`?task=exam&id=…&t=<label>`, built by MushafLink).
 * The label rides in the URL because the card that linked here already rendered
 * it — the reader needs no fetch of its own.
 *
 * `g=1` (a teacher's link) adds the pass/fail control. RLS is the real gate, so
 * a hand-edited flag only buys a rejected update.
 */
export default function ReaderTaskBanner() {
  const params = useSearchParams();
  const { t } = useI18n();
  const [graded, setGraded] = useState<ExamStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const kind = params.get('task');
  const id = params.get('id');
  const label = params.get('t') ?? '';
  if ((kind !== 'exam' && kind !== 'homework') || !id) return null;
  const canGrade = kind === 'exam' && params.get('g') === '1';

  async function grade(status: ExamStatus) {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await gradeExam(id!, status);
      setGraded(status);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex flex-wrap items-center gap-x-3 gap-y-2" style={{ padding: '10px 14px' }}>
      <span style={{ color: 'var(--text-accent)' }}><Icon name={kind === 'exam' ? 'cap' : 'book'} size={16} /></span>
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {t(kind === 'exam' ? 'exam.title' : 'homework.title')}
      </span>
      <span className="text-sm font-medium min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>{label}</span>

      {canGrade && (
        <span className="flex items-center gap-2" style={{ marginInlineStart: 'auto' }}>
          {failed && <span className="text-xs" style={{ color: 'var(--danger)' }}>{t('common.failed')}</span>}
          <ActionButton onClick={() => grade('passed')} disabled={busy}
                        className={graded === 'passed' ? 'btn btn-primary' : 'btn btn-outline'}
                        style={{ minHeight: 34, fontSize: 13 }}>
            {t('exam.statusPassed')}
          </ActionButton>
          <ActionButton onClick={() => grade('failed')} disabled={busy}
                        className={graded === 'failed' ? 'btn btn-primary' : 'btn btn-outline'}
                        style={{ minHeight: 34, fontSize: 13 }}>
            {t('exam.statusFailed')}
          </ActionButton>
        </span>
      )}
    </div>
  );
}

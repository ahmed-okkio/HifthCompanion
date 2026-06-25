'use client';

import { useMemo, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import type { AnnotationSet, Halaqah, Membership, ProgressLog } from '@/types';
import { setSharedSet } from '@/lib/services/membership';
import { createLog, deleteLog } from '@/lib/services/progressLog';
import { computeStreak } from '@/lib/streak';

const today = () => new Date().toISOString().slice(0, 10);

export default function StudentHalaqah({
  halaqah,
  membership,
  initialLogs,
  sets,
}: {
  halaqah: Halaqah;
  membership: Membership;
  initialLogs: ProgressLog[];
  sets: AnnotationSet[];
}) {
  const { t } = useI18n();
  const [logs, setLogs] = useState(initialLogs);
  const [sharedSetId, setSharedSetId] = useState(membership.shared_set_id);
  const [busy, setBusy] = useState(false);

  // Log form state.
  const [logType, setLogType] = useState(halaqah.log_types[0]?.label ?? '');
  const [pageStart, setPageStart] = useState(1);
  const [pageEnd, setPageEnd] = useState(1);
  const [status, setStatus] = useState(halaqah.student_statuses[0]?.label ?? '');
  const [note, setNote] = useState('');
  const [logDate, setLogDate] = useState(today());

  const streak = useMemo(() => computeStreak(logs), [logs]);

  async function handleShare(id: string) {
    const next = id || null;
    setSharedSetId(next);
    await setSharedSet(membership.id, next);
  }

  async function handleSubmit() {
    if (busy || pageEnd < pageStart) return;
    setBusy(true);
    try {
      const log = await createLog({
        membership_id: membership.id,
        log_date: logDate,
        log_type: logType,
        page_start: pageStart,
        page_end: pageEnd,
        student_status: status,
        student_notes: note || null,
      });
      setLogs((prev) => [log, ...prev]);
      setNote('');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteLog(id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Streak + shared set */}
      <div className="flex items-center justify-between gap-3">
        <div className="badge">{streak} {t('log.streak')}</div>
        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('log.sharedSet')}
          <select value={sharedSetId ?? ''} onChange={(e) => handleShare(e.target.value)}
                  className="input input-sm" style={{ minHeight: 40 }}>
            <option value="">—</option>
            {sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>

      {/* Log form */}
      <div className="card flex flex-col gap-3" style={{ padding: '16px 18px' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('log.new')}</h2>

        <ChipRow label={t('log.type')} options={halaqah.log_types.map((l) => l.label)} value={logType} onChange={setLogType} />

        <div className="flex items-end gap-2">
          <NumberField label={t('log.from')} value={pageStart} min={1} max={604} onChange={setPageStart} />
          <NumberField label={t('log.to')} value={pageEnd} min={1} max={604} onChange={setPageEnd} />
          <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {t('log.date')}
            <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)}
                   className="input input-sm" style={{ minHeight: 40 }} />
          </label>
        </div>

        <ChipRow label={t('log.selfStatus')} options={halaqah.student_statuses.map((s) => s.label)} value={status} onChange={setStatus} />

        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('log.note')}
               className="input" />

        <button onClick={handleSubmit} disabled={busy || pageEnd < pageStart}
                className="btn btn-primary" style={{ minHeight: 44 }}>
          {t('log.submit')}
        </button>
      </div>

      {/* My logs */}
      <div className="flex flex-col gap-2">
        {logs.map((l) => (
          <div key={l.id} className="card" style={{ padding: '12px 16px' }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {l.log_type} · p{l.page_start}–{l.page_end}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{l.log_date}</span>
            </div>
            {l.student_status && <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{l.student_status}</div>}
            {l.reviewed_at ? (
              <div className="text-xs mt-1" style={{ color: 'var(--text-accent)' }}>
                {t('grade.reviewed')}{l.teacher_status ? `: ${l.teacher_status}` : ''}
                {l.teacher_comment ? ` — ${l.teacher_comment}` : ''}
              </div>
            ) : (
              <div className="flex gap-2 mt-2">
                <button onClick={() => handleDelete(l.id)} className="btn btn-danger-ghost" style={{ minHeight: 36, fontSize: 13 }}>
                  {t('common.delete')}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChipRow({
  label, options, value, onChange,
}: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o} onClick={() => onChange(o)}
                  className="badge" style={{
                    cursor: 'pointer',
                    background: value === o ? 'var(--accent)' : undefined,
                    color: value === o ? '#fff' : undefined,
                  }}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function NumberField({
  label, value, min, max, onChange,
}: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
      {label}
      <input type="number" value={value} min={min} max={max}
             onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
             className="input input-sm" style={{ minHeight: 40, width: 80 }} />
    </label>
  );
}

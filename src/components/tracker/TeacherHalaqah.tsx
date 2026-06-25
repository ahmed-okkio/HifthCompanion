'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/I18nProvider';
import type { Halaqah, Membership, ProgressLog } from '@/types';
import { rotateInviteCode } from '@/lib/services/halaqah';
import { inviteByEmail, setMembershipStatus } from '@/lib/services/membership';
import { gradeLog } from '@/lib/services/progressLog';

export default function TeacherHalaqah({
  halaqah,
  initialMembers,
  initialFeed,
}: {
  halaqah: Halaqah;
  initialMembers: Membership[];
  initialFeed: ProgressLog[];
}) {
  const { t } = useI18n();
  const [code, setCode] = useState(halaqah.invite_code);
  const [members, setMembers] = useState(initialMembers);
  const [feed, setFeed] = useState(initialFeed);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  );

  async function handleRotate() {
    setCode(await rotateInviteCode(halaqah.id));
  }

  async function handleInvite() {
    if (!email.trim()) return;
    setError(null);
    try {
      const m = await inviteByEmail(halaqah.id, email);
      setMembers((prev) => [...prev, m]);
      setEmail('');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleStatus(id: string, status: Membership['status']) {
    await setMembershipStatus(id, status);
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
  }

  function patchLog(updated: ProgressLog) {
    setFeed((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="card" style={{ padding: '10px 14px', color: 'var(--danger, #dc2626)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Invite */}
      <div className="card flex flex-col gap-3" style={{ padding: '16px 18px' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('tracker.inviteCode')}</span>
            <code className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{code}</code>
          </div>
          <button onClick={handleRotate} className="btn btn-ghost" style={{ minHeight: 40, fontSize: 13 }}>
            {t('tracker.rotateCode')}
          </button>
        </div>
        <div className="flex gap-2 items-center">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
                 placeholder={t('tracker.inviteByEmail')} className="input" style={{ flex: 1, minWidth: 0 }} />
          <button onClick={handleInvite} disabled={!email.trim()} className="btn btn-ghost" style={{ minHeight: 44 }}>
            {t('tracker.inviteByEmail')}
          </button>
        </div>
      </div>

      {/* Roster */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {t('tracker.roster')}
        </h2>
        {members.length === 0 && (
          <div className="card text-center" style={{ padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>
            {t('tracker.noStudents')}
          </div>
        )}
        {members.map((m) => (
          <div key={m.id} className="card flex items-center justify-between gap-3" style={{ padding: '12px 16px' }}>
            <Link href={`/tracker/${halaqah.id}/student/${m.id}`}
                  className="text-sm" style={{ color: 'var(--text-primary)', opacity: m.status === 'active' ? 1 : 0.5 }}>
              {m.user_id.slice(0, 8)} · <span className="badge">{m.status}</span>
            </Link>
            <div className="flex gap-1">
              {m.status === 'active' ? (
                <>
                  <button onClick={() => handleStatus(m.id, 'inactive')} className="btn btn-ghost" style={{ minHeight: 36, fontSize: 12 }}>
                    {t('tracker.archive')}
                  </button>
                  <button onClick={() => handleStatus(m.id, 'blocked')} className="btn btn-danger-ghost" style={{ minHeight: 36, fontSize: 12 }}>
                    {t('tracker.block')}
                  </button>
                </>
              ) : (
                <button onClick={() => handleStatus(m.id, 'active')} className="btn btn-ghost" style={{ minHeight: 36, fontSize: 12 }}>
                  {t('tracker.reactivate')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Daily feed */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {t('grade.title')}
        </h2>
        {feed.map((log) => (
          <FeedRow
            key={log.id}
            log={log}
            statuses={halaqah.teacher_statuses.map((s) => s.label)}
            sharedSetId={memberById.get(log.membership_id)?.shared_set_id ?? null}
            onGraded={patchLog}
          />
        ))}
      </div>
    </div>
  );
}

function FeedRow({
  log, statuses, sharedSetId, onGraded,
}: {
  log: ProgressLog;
  statuses: string[];
  sharedSetId: string | null;
  onGraded: (l: ProgressLog) => void;
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState(log.teacher_status ?? statuses[0] ?? '');
  const [comment, setComment] = useState(log.teacher_comment ?? '');
  const [busy, setBusy] = useState(false);

  async function handleGrade() {
    setBusy(true);
    try {
      await gradeLog(log.id, { teacher_status: status, teacher_comment: comment || null });
      onGraded({ ...log, teacher_status: status, teacher_comment: comment || null, reviewed_at: new Date().toISOString() });
    } finally {
      setBusy(false);
    }
  }

  const readerHref = sharedSetId
    ? `/reader/${log.page_start}?set=${sharedSetId}`
    : `/reader/${log.page_start}`;

  return (
    <div className="card flex flex-col gap-2" style={{ padding: '12px 16px' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {log.log_type} · p{log.page_start}–{log.page_end}
        </span>
        <a href={readerHref} className="btn btn-ghost" style={{ minHeight: 32, fontSize: 12 }}>
          {t('log.attachPage')}
        </a>
      </div>
      {log.student_notes && <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{log.student_notes}</div>}

      {log.reviewed_at ? (
        <div className="text-xs" style={{ color: 'var(--text-accent)' }}>
          {t('grade.reviewed')}{log.teacher_status ? `: ${log.teacher_status}` : ''}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input input-sm" style={{ minHeight: 36 }}>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('grade.comment')}
                 className="input input-sm" style={{ flex: 1, minWidth: 100 }} />
          <button onClick={handleGrade} disabled={busy} className="btn btn-primary" style={{ minHeight: 36, fontSize: 13 }}>
            {t('grade.markReviewed')}
          </button>
        </div>
      )}
    </div>
  );
}

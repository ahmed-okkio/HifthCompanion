'use client';

/**
 * ManageList — the /wird/manage rows: edit, delete, and per-wird history of the
 * current pass with an Undo on each logged day. Undo hard-deletes the entry
 * (position derives from what's left, so the day re-opens). The daily card is
 * never touched here, so it keeps its single Done control (H10).
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';
import {
  deleteWird,
  deleteWirdEntry,
  listCycleEntries,
  type WirdEntryRow,
} from '@/lib/services/wird';
import WirdForm, { type WirdEdit } from './WirdForm';
import WirdHeatmap from './WirdHeatmap';
import type { WirdScopeSource } from '@/types';
import { localDate } from '@/lib/localDate';

export interface ManageRow extends WirdEdit {
  scope_source: WirdScopeSource;
  /** Every date this wird was completed, for the consistency heatmap. */
  doneDates: string[];
}

const todayISO = () => localDate();

export default function ManageList({ rows, memorizedPages }: { rows: ManageRow[]; memorizedPages: number[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [editing, setEditing] = useState<WirdEdit | null>(null);

  return (
    <main className="w-full" style={{ maxWidth: 560, margin: '0 auto', padding: 'var(--space-20) var(--space-16) var(--space-32)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-20)' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--type-heading-m-size)', fontWeight: 700, color: 'var(--text-primary)' }}>
          {t('wird.manageTitle')}
        </h1>
        <Link href="/wird" className="btn btn-ghost" style={{ minHeight: 40 }}>
          {t('wird.back')}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--type-small-size)' }}>{t('wird.manageEmpty')}</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-12)' }}>
          {rows.map((r) => (
            <Row key={r.id} row={r} onEdit={() => setEditing(r)} onChanged={() => router.refresh()} />
          ))}
        </ul>
      )}

      {editing && (
        <WirdForm
          key={editing.id}
          open
          wird={editing}
          onClose={() => setEditing(null)}
          onCreated={() => { setEditing(null); router.refresh(); }}
          canUseMemorized={memorizedPages.length > 0}
          memorizedPages={memorizedPages}
        />
      )}
    </main>
  );
}

function Row({ row, onEdit, onChanged }: { row: ManageRow; onEdit: () => void; onChanged: () => void }) {
  const { t, fmtNum, locale } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<WirdEntryRow[] | null>(null);

  const scopeText =
    row.scope_source === 'memorized'
      ? t('wird.scopeMemorized')
      : t('wird.scopePages', { range: `${fmtNum(row.page_start)}–${fmtNum(row.page_end)}` });
  const rateText = `${fmtNum(row.pages_per_period)} ${t('wird.ratePages')} · ${t(`wird.period${row.period_days}` as 'wird.period1')}`;

  async function loadHistory() {
    setEntries(await listCycleEntries(row.id));
  }

  async function toggleHistory() {
    const next = !open;
    setOpen(next);
    if (next && entries === null) {
      try { await loadHistory(); } catch { setError(t('wird.undoFailed')); }
    }
  }

  async function onDelete() {
    if (!window.confirm(t('wird.deleteConfirm', { name: row.name }))) return;
    setBusy(true); setError('');
    try { await deleteWird(row.id); onChanged(); }
    catch { setError(t('wird.deleteFailed')); setBusy(false); }
  }

  async function onUndo(e: WirdEntryRow) {
    if (!window.confirm(t('wird.undoConfirm'))) return;
    setBusy(true); setError('');
    try {
      await deleteWirdEntry(e.id);
      await loadHistory();
      router.refresh(); // reflect the re-opened day on /wird
    } catch { setError(t('wird.undoFailed')); }
    finally { setBusy(false); }
  }

  const fmtDate = (iso: string) =>
    iso === todayISO()
      ? t('wird.entryToday')
      : new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar' : 'en', { month: 'short', day: 'numeric' });

  return (
    <li style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-16)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.name}
          </div>
          <div style={{ marginTop: 'var(--space-4)', fontSize: 'var(--type-small-size)', color: 'var(--text-muted)' }}>
            {scopeText} · {rateText}
          </div>
        </div>
        <button type="button" className="btn btn-ghost" style={{ minHeight: 40 }} onClick={onEdit}>{t('wird.editAction')}</button>
        <button type="button" className="btn btn-ghost" style={{ minHeight: 40, color: 'var(--danger)' }} disabled={busy} onClick={onDelete}>
          {t('wird.deleteAction')}
        </button>
      </div>

      <div style={{ marginTop: 'var(--space-12)' }}>
        <WirdHeatmap doneDates={row.doneDates} />
      </div>

      <button
        type="button"
        onClick={toggleHistory}
        aria-expanded={open}
        style={{ marginTop: 'var(--space-8)', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, fontSize: 'var(--type-small-size)', fontWeight: 600, color: 'var(--text-secondary)' }}
      >
        {open ? '▾ ' : '▸ '}{t('wird.history')}
      </button>

      {error && <p role="alert" className="text-sm" style={{ color: 'var(--danger)', marginTop: 'var(--space-8)' }}>{error}</p>}

      {open && (
        entries === null ? (
          <p style={{ marginTop: 'var(--space-8)', fontSize: 'var(--type-small-size)', color: 'var(--text-muted)' }}>{t('common.loading')}</p>
        ) : entries.length === 0 ? (
          <p style={{ marginTop: 'var(--space-8)', fontSize: 'var(--type-small-size)', color: 'var(--text-muted)' }}>{t('wird.historyEmpty')}</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 'var(--space-8) 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {entries.map((e) => (
              <li key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)', padding: 'var(--space-8) 0', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ flex: '0 0 auto', fontSize: 'var(--type-small-size)', fontWeight: 600, color: 'var(--text-secondary)', minWidth: 56 }}>{fmtDate(e.entry_date)}</span>
                <span style={{ flex: '1 1 0', fontSize: 'var(--type-small-size)', color: 'var(--text-muted)' }}>
                  {t('wird.scopePages', { range: e.page_start === e.page_end ? `${fmtNum(e.page_start)}` : `${fmtNum(e.page_start)}–${fmtNum(e.page_end)}` })}
                </span>
                <button type="button" className="btn btn-ghost" style={{ minHeight: 36, color: 'var(--danger)' }} disabled={busy} onClick={() => onUndo(e)}>
                  {t('wird.undo')}
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </li>
  );
}

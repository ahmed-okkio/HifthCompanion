'use client';

/**
 * ManageList — the /wird/manage rows: edit, delete, and per-wird history of the
 * current pass with an Undo on each logged day. Undo hard-deletes the entry
 * (position derives from what's left, so the day re-opens). "Add a day" logs a
 * day the user read but forgot to mark, through the past-day PortionSheet.
 */

import { useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query/keys';
import { useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/I18nProvider';
import {
  completeWird,
  deleteWird,
  deleteWirdEntry,
  listCycleEntries,
  type WirdEntryRow,
} from '@/lib/services/wird';
import WirdForm, { type WirdEdit } from './WirdForm';
import WirdHeatmap from './WirdHeatmap';
import PortionSheet, { type PortionChoice, type PortionEdit } from './PortionSheet';
import type { WirdScopeSource } from '@/types';
import { localDate } from '@/lib/localDate';

export interface ManageRow extends WirdEdit {
  scope_source: WirdScopeSource;
  /** Every date this wird was completed, for the consistency heatmap. */
  doneDates: string[];
  /** The past-day editor's inputs. */
  edit: PortionEdit;
}

const todayISO = () => localDate();

export default function ManageList({ rows, memorizedPages }: { rows: ManageRow[]; memorizedPages: number[] }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<WirdEdit | null>(null);

  return (
    <main className="w-full max-w-140 mx-auto pt-5 px-4 pb-8">
      <div className="flex items-center justify-between mb-5">
        <h1 className="m-0 text-heading-m font-bold text-primary">
          {t('wird.manageTitle')}
        </h1>
        <Link href="/wird" className="btn btn-ghost">
          {t('wird.back')}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted text-small">{t('wird.manageEmpty')}</p>
      ) : (
        <ul className="list-none m-0 p-0 flex flex-col gap-3">
          {rows.map((r) => (
            <Row key={r.id} row={r} onEdit={() => setEditing(r)} onChanged={() => void qc.invalidateQueries({ queryKey: qk.wird })} />
          ))}
        </ul>
      )}

      {editing && (
        <WirdForm
          key={editing.id}
          open
          wird={editing}
          onClose={() => setEditing(null)}
          onCreated={() => { setEditing(null); void qc.invalidateQueries({ queryKey: qk.wird }); }}
          canUseMemorized={memorizedPages.length > 0}
          memorizedPages={memorizedPages}
        />
      )}
    </main>
  );
}

function Row({ row, onEdit, onChanged }: { row: ManageRow; onEdit: () => void; onChanged: () => void }) {
  const { t, fmtNum, locale } = useI18n();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<WirdEntryRow[] | null>(null);
  const [adding, setAdding] = useState(false);
  // A just-added day, shown at once (optimistic) and dropped if the write fails.
  const [added, setAdded] = useState<PortionChoice | null>(null);

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
      void qc.invalidateQueries({ queryKey: qk.wird }); // reflect the re-opened day on /wird
    } catch { setError(t('wird.undoFailed')); }
    finally { setBusy(false); }
  }

  function onAdd(c: PortionChoice) {
    setAdding(false);
    setError('');
    setAdded(c);
    completeWird(row.id, { date: c.date, start: c.start, count: c.count }).then(
      async () => {
        if (open) await loadHistory().catch(() => {});
        await qc.invalidateQueries({ queryKey: qk.wird });
        setAdded(null);
      },
      () => { setAdded(null); setError(t('wird.edit.logFailed')); },
    );
  }

  const fmtDate = (iso: string) =>
    iso === todayISO()
      ? t('wird.entryToday')
      : new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar' : 'en', { month: 'short', day: 'numeric' });

  return (
    <li className="card p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-body font-bold text-primary truncate">
            {row.name}
          </div>
          <div className="mt-1 text-small text-muted">
            {scopeText} · {rateText}
          </div>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onEdit}>{t('wird.editAction')}</button>
        <button type="button" className="btn btn-danger-ghost" disabled={busy} onClick={onDelete}>
          {t('wird.deleteAction')}
        </button>
      </div>

      <div className="mt-3">
        <WirdHeatmap doneDates={added ? [...row.doneDates, added.date] : row.doneDates} />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={toggleHistory}
          aria-expanded={open}
          className="border-none bg-transparent cursor-pointer p-0 text-small font-semibold text-secondary"
        >
          {open ? '▾ ' : '▸ '}{t('wird.history')}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={added !== null} onClick={() => setAdding(true)}>
          {t('wird.addDay')}
        </button>
      </div>

      {added && (
        <p role="status" className="mt-2 text-small font-semibold text-accent">
          {t('wird.dayLogged', {
            date: fmtDate(added.date),
            range: added.first === added.last ? fmtNum(added.first) : `${fmtNum(added.first)}–${fmtNum(added.last)}`,
          })}
        </p>
      )}
      {error && <p role="alert" className="text-sm text-danger mt-2">{error}</p>}
      {adding && <PortionSheet edit={row.edit} past onSave={onAdd} onClose={() => setAdding(false)} />}

      {open && (
        entries === null ? (
          <p className="mt-2 text-small text-muted">{t('common.loading')}</p>
        ) : entries.length === 0 ? (
          <p className="mt-2 text-small text-muted">{t('wird.historyEmpty')}</p>
        ) : (
          <ul className="list-none mt-2 mb-0 mx-0 p-0 flex flex-col gap-1">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2 border-t border-subtle">
                <span className="flex-none text-small font-semibold text-secondary min-w-14">{fmtDate(e.entry_date)}</span>
                <span className="flex-1 text-small text-muted">
                  {t('wird.scopePages', { range: e.page_start === e.page_end ? `${fmtNum(e.page_start)}` : `${fmtNum(e.page_start)}–${fmtNum(e.page_end)}` })}
                </span>
                <button type="button" className="btn btn-danger-ghost btn-sm" disabled={busy} onClick={() => onUndo(e)}>
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

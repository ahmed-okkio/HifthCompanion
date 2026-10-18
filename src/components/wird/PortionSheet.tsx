'use client';

/**
 * PortionSheet — the pen editor (ReminderSheet idiom). Sets which day is being
 * logged (today, yesterday, or a picked past day the user forgot), the page
 * they started from and the page they read to. A read past the pass end spills
 * into the next pass (the service writes two entries); the live line turns
 * amber to say so. Saving hands the choice back to the card, which writes it
 * optimistically — this sheet never waits on the server.
 */

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { openingRef, closingRef } from './ref';

export interface PortionEdit {
  passPages: number[];
  nextPassPages: number[];
  /** Today's portion as indices into passPages. */
  startIdx: number;
  planned: number;
  loggedDates: string[];
  today: string;
}

export interface PortionChoice {
  date: string;
  start: number;
  count: number;
  /** First and last page read, for the optimistic note ("pages 42–51"). */
  first: number;
  last: number;
  /** Where the portion after this read begins. */
  next: number;
}

const shiftDay = (iso: string, days: number) =>
  new Date(Date.parse(iso) + days * 86_400_000).toISOString().slice(0, 10);

export default function PortionSheet({
  edit,
  onSave,
  onClose,
}: {
  edit: PortionEdit;
  onSave: (c: PortionChoice) => void;
  onClose: () => void;
}) {
  const { t, locale, fmtNum } = useI18n();
  const yesterday = shiftDay(edit.today, -1);
  const [mode, setMode] = useState<'today' | 'yesterday' | 'pick'>('today');
  const [picked, setPicked] = useState(shiftDay(edit.today, -2));
  const [from, setFrom] = useState(edit.startIdx);
  const [to, setTo] = useState(edit.startIdx + edit.planned - 1);
  const saveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    saveRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pages = [...edit.passPages, ...edit.nextPassPages];
  const passLen = edit.passPages.length;
  const date = mode === 'today' ? edit.today : mode === 'yesterday' ? yesterday : picked;
  const logged = edit.loggedDates.includes(date);
  const badDate = !date || date > edit.today;
  const count = to - from + 1;
  const spill = Math.max(0, to - passLen + 1);
  const diff = count - edit.planned;

  // From moves To with it, keeping the read's length; To never goes before From.
  const moveFrom = (i: number) => {
    const next = Math.max(0, Math.min(passLen - 1, i));
    setTo((v) => Math.min(pages.length - 1, Math.max(next, v + next - from)));
    setFrom(next);
  };
  const moveTo = (i: number) => setTo(Math.max(from, Math.min(pages.length - 1, i)));

  const live = spill > 0
    ? t('wird.edit.spill', { n: count, end: fmtNum(edit.passPages[passLen - 1]), k: spill })
    : t(diff > 0 ? 'wird.edit.more' : diff < 0 ? 'wird.edit.fewer' : 'wird.edit.planned', { n: count, d: Math.abs(diff) });

  function save() {
    onSave({ date, start: pages[from], count, first: pages[from], last: pages[to], next: pages[to + 1] ?? edit.nextPassPages[0] });
  }

  const stepper = (label: string, idx: number, move: (i: number) => void, min: number, max: number, ref: string, note?: string) => (
    <div className="flex flex-col gap-1">
      <span className="text-caption font-semibold uppercase tracking-label text-muted">{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-outline btn-icon text-heading-m" aria-label={t('wird.edit.less', { what: label })} disabled={idx <= min} onClick={() => move(idx - 1)}>−</button>
        <div className="flex-1 min-w-0 text-center">
          <div className="text-heading-m font-extrabold">{t('wird.edit.page', { p: fmtNum(pages[idx]) })}</div>
          <div className="text-small font-medium text-secondary truncate">{ref}{note ? ` · ${note}` : ''}</div>
        </div>
        <button type="button" className="btn btn-outline btn-icon text-heading-m" aria-label={t('wird.edit.more1', { what: label })} disabled={idx >= max} onClick={() => move(idx + 1)}>+</button>
      </div>
    </div>
  );

  return (
    <div
      onClick={onClose}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-(--z-overlay) bg-overlay flex items-end justify-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="portion-sheet-title"
        data-testid="portion-sheet"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-120 bg-surface-main rounded-t-xl shadow-e3 pt-2 px-6 pb-[calc(24px+env(safe-area-inset-bottom))] flex flex-col gap-4"
      >
        <span aria-hidden className="w-9 h-1 rounded-full bg-neutral-300 self-center" />
        <h2 id="portion-sheet-title" className="m-0 text-heading-m font-bold text-primary">{t('wird.edit.title')}</h2>

        <SegmentedControl
          value={mode}
          onChange={(k) => setMode(k as typeof mode)}
          options={[
            { key: 'today', label: t('wird.edit.today') },
            { key: 'yesterday', label: t('wird.edit.yesterday') },
            { key: 'pick', label: t('wird.edit.pick') },
          ]}
        />
        {mode === 'pick' && (
          <input
            type="date"
            className="input min-h-11"
            aria-label={t('wird.edit.pick')}
            value={picked}
            max={yesterday}
            onChange={(e) => setPicked(e.target.value)}
          />
        )}
        {logged && <span role="alert" className="-mt-2 text-small font-semibold text-danger">{t('wird.edit.logged')}</span>}

        {stepper(t('wird.edit.from'), from, moveFrom, 0, passLen - 1, openingRef(pages[from], locale).label)}
        {stepper(t('wird.edit.to'), to, moveTo, from, pages.length - 1, closingRef(pages[to], locale).label, to >= passLen ? t('wird.edit.nextPass') : undefined)}

        <p
          aria-live="polite"
          className={`m-0 py-2 px-3 rounded-md text-small font-semibold text-center ${spill > 0 ? 'bg-warning-muted text-warning-strong' : 'bg-surface-app text-secondary'}`}
        >
          {live}
        </p>

        <button ref={saveRef} type="button" className="btn btn-primary btn-tall" disabled={logged || badDate} onClick={save}>
          {t('wird.edit.save', { range: from === to ? fmtNum(pages[from]) : `${fmtNum(pages[from])}–${fmtNum(pages[to])}` })}
        </button>
      </div>
    </div>
  );
}

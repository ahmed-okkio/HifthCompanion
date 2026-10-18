'use client';

/**
 * WirdCard — one wird, one card (H7). The 72px Done disc is the primary control
 * (H8/H10); a small pen beside "Start at" opens PortionSheet to log a different
 * range (read more, started elsewhere) or a past day the user forgot. The card
 * has two layouts:
 *   - outstanding: name, scope, the portion's opening ref as the largest
 *     element, its closing ref, the portion page range, the progress bar,
 *     "N pages to go", and the disc resting unfilled (H9).
 *   - done-today (I2): the completed state — filled disc, not re-tappable. The
 *     service advances position to the *next* portion once done, so a done card
 *     never renders those next-portion values as an outstanding task (I2 note).
 *
 * Completing calls the M3 server action then refreshes the route: the refreshed
 * data carries done_today, which clears any stale marker in the same
 * interaction (I6) and advances the position. A failed save shows what happened
 * and how to retry, and never advances (I11). Motion (the disc squash, the card
 * exit) is M6 — this milestone only changes state.
 */

import { useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query/keys';
import { useRef, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { completeWird } from '@/lib/services/wird';
import Progress from './Progress';
import { openingRef, closingRef } from './ref';
import PortionSheet, { shiftDay, type PortionChoice } from './PortionSheet';
import type { WirdCardData } from './WirdPager';

// Amber derived from --warning via color-mix — no new colour token (M5/I4).
export const AMBER = 'bg-warning-muted text-warning-strong';

function CheckGlyph() {
  return (
    <svg className="wird-tick" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// onExit lets WirdPager orchestrate the M6 card exit (J2–J7): WirdCard owns the
// server write and the disc bounce, then hands off so the pager can slide the
// slide out, close the gap, and refresh once travel ends.
export default function WirdCard({ card, onExit }: { card: WirdCardData; onExit?: (id: string, nextRef?: string) => void }) {
  const { t, fmtNum, locale } = useI18n();
  const qc = useQueryClient();
  const [error, setError] = useState(false);
  const [bouncing, setBouncing] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nextRef, setNextRef] = useState<string>();
  // "I read it" on the waiting bar logs missed days oldest-first. Shown at once
  // (optimistic) until the refetch carries them; dropped with an error on failure.
  const [caught, setCaught] = useState<string[]>([]);
  const [logError, setLogError] = useState(false);
  // Writes run in order: each default portion starts where the previous ended.
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const write = (opts?: Parameters<typeof completeWird>[1]) =>
    (chain.current = chain.current.catch(() => {}).then(() => completeWird(card.id, opts)));

  const scopeText = card.scope.memorized
    ? t('wird.scopeMemorized')
    : t('wird.scopePages', { range: card.scope.range });

  const done = card.doneToday || justDone;

  function onDone(opts?: { start: number; count: number }) {
    if (done) return;
    // Optimistic: flip the disc and fire the server write now — no spinner, no
    // await. The card exit is handed to the pager only once the disc bounce has
    // played (onAnimationEnd below), so the nice tap animation isn't cut off by
    // the slide. On failure we refetch to restore the true state (I11).
    setBouncing(true); // J1: disc squash-and-stretch on the tap
    setError(false);
    setJustDone(true);
    // Sync once the write lands (the pager's post-slide refetch may beat it).
    write(opts).then(() => qc.invalidateQueries({ queryKey: qk.wird }), () => {
      setJustDone(false);
      setError(true);
      void qc.invalidateQueries({ queryKey: qk.wird });
    });
  }

  function onSave(c: PortionChoice) {
    setEditing(false);
    setNextRef(openingRef(c.next, locale).label);
    onDone({ start: c.start, count: c.count });
  }

  // Days missed, not days since the last Done: done yesterday means today's
  // portion is simply due, not waiting. Done 2 days ago = yesterday was missed.
  // Days caught up but not yet in the fetched data count as logged.
  const pending = caught.filter((d) => !card.edit.loggedDates.includes(d)).length;
  const missed = (card.daysSinceLastDone == null ? 0 : card.daysSinceLastDone - 1) - pending;
  const stale = !card.doneToday && missed >= 1;
  const staleText =
    missed === 1 ? t('wird.staleYesterday') : t('wird.staleDays', { n: missed });

  function onReadIt() {
    const date = shiftDay(card.edit.today, -missed); // the oldest day still waiting
    setLogError(false);
    setCaught((c) => [...c, date]);
    write({ date }).then(() => qc.invalidateQueries({ queryKey: qk.wird }), () => {
      setCaught((c) => c.filter((d) => d !== date));
      setLogError(true);
      void qc.invalidateQueries({ queryKey: qk.wird });
    });
  }

  // The portion as shown: the fetched one, or moved on by the caught-up days.
  const view = pending === 0 ? card : advance(card, pending, locale);

  return (
    <div
      className="wird-card h-full flex flex-col bg-surface-main border border-subtle rounded-xl shadow-e2 overflow-hidden"
    >
      {/* I4/I5: amber stale bar across the top — informational, never blocks the disc. */}
      {stale && (
        <div className={`flex-none flex items-center justify-center gap-3 py-1.5 px-5 text-caption font-semibold ${AMBER}`}>
          {staleText}
          <button type="button" className="btn btn-xs btn-outline" onClick={onReadIt}>
            {t('wird.edit.iReadIt')}
          </button>
        </div>
      )}

      <div className="wird-fit-body flex-1 min-h-0 flex flex-col">
        {/* Header: name + scope */}
        <div className="flex-none">
          <div className="wird-fit-name font-bold truncate max-w-full">{card.name}</div>
          <div className="mt-1 text-small font-medium text-muted truncate max-w-full">
            {scopeText}
          </div>
        </div>

        {card.doneToday ? (
          /* I2: completed state. No next-portion task shown. */
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4">
            <span className="wird-fit-done font-extrabold text-accent text-center">
              {t('wird.doneToday')}
            </span>
          </div>
        ) : (
          // Re-keyed per caught-up day so the next portion slides in.
          <div key={pending} className={`flex-1 min-h-0 flex flex-col items-center justify-center text-center${caught.length ? ' wird-alldone-enter' : ''}`}>
            <span className="flex items-center gap-1 text-caption font-semibold uppercase tracking-label text-muted">
              {t('wird.startAt')}
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm text-accent"
                aria-label={t('wird.edit.open')}
                disabled={pending > 0}
                onClick={() => setEditing(true)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
            </span>
            {/* Opening reference — the largest element (H7). */}
            <span className="wird-fit-hero block font-extrabold leading-none mt-1 truncate max-w-full">
              {fmtNum(view.opening)}
            </span>
            <span className="block mt-1 text-small font-semibold text-secondary truncate max-w-full">
              {t('wird.readTo', { ref: view.closing })}
            </span>
            <span className="block mt-1 text-caption font-medium text-muted truncate max-w-full">
              {view.portionSinglePage
                ? t('wird.pageRangeOne', { range: view.portionRange })
                : t('wird.pageRange', { range: view.portionRange })}
            </span>
          </div>
        )}

        {/* Footer: progress + pages-to-go, then the disc in the thumb zone (H7/I8). */}
        <div className="wird-fit-footer flex-none flex flex-col">
          {!card.doneToday && (
            <>
              <Progress pct={view.pct} label={t('wird.progressLabel')} />
              <span className="text-small font-bold text-secondary text-center">
                {view.pagesToGo === 1 ? t('wird.pagesToGoOne') : t('wird.pagesToGo', { n: view.pagesToGo })}
              </span>
            </>
          )}

          {logError && (
            <div role="alert" className="bg-danger-muted text-danger rounded-md py-2 px-3 text-small font-semibold leading-snug text-center">
              {t('wird.edit.logFailed')}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="bg-danger-muted text-danger rounded-md py-2 px-3 text-small font-semibold leading-snug text-center"
            >
              {t('wird.completeFailed')}
            </div>
          )}

          <div className="flex justify-center">
            <div className="relative inline-flex">
            {/* Radial burst lines, mounted only during the tap bounce so the
                animation replays on every completion. */}
            {bouncing && (
              <span className="wird-rays" aria-hidden>
                {Array.from({ length: 8 }, (_, i) => (
                  // eslint-disable-next-line shadcn/no-inline-styles -- per-ray angle
                  <span key={i} style={{ ['--a' as string]: `${i * 45}deg` }} />
                ))}
              </span>
            )}
            <button
              type="button"
              className={`btn btn-circle${bouncing ? ' wird-bounce' : ''}`}
              aria-label={t('wird.done')}
              data-done={done ? 'true' : undefined}
              disabled={done}
              onClick={() => onDone()}
              onAnimationEnd={(e) => {
                if (e.animationName === 'wird-disc-bounce') {
                  setBouncing(false);
                  // Bounce done — now hand the exit to the pager so the card
                  // slides away after the tap animation has played (J1→J2).
                  if (onExit) onExit(card.id, nextRef);
                }
              }}
            >
              <CheckGlyph />
            </button>
            </div>
          </div>
        </div>
      </div>
      {editing && <PortionSheet edit={card.edit} onSave={onSave} onClose={() => setEditing(false)} />}
    </div>
  );
}

/**
 * The card moved on by `n` caught-up days, before the refetch lands: each day
 * takes a planned-size portion, spilling into the next pass at the end. An
 * estimate (portion sizes can vary by a page); the refetch replaces it.
 */
function advance(card: WirdCardData, n: number, locale: 'en' | 'ar') {
  const { passPages, nextPassPages, startIdx, planned } = card.edit;
  const all = [...passPages, ...nextPassPages];
  const s = Math.min(startIdx + n * planned, all.length - 1);
  const e = Math.min(s + planned - 1, all.length - 1);
  const inNext = s >= passPages.length;
  const len = inNext ? nextPassPages.length : passPages.length;
  const pagesToGo = inNext ? all.length - s : passPages.length - s;
  return {
    opening: openingRef(all[s], locale).label,
    closing: closingRef(all[e], locale).label,
    portionRange: s === e ? `${all[s]}` : `${all[s]}–${all[e]}`,
    portionSinglePage: s === e,
    pagesToGo,
    pct: len > 0 ? Math.round(((len - pagesToGo) / len) * 100) : 0,
  };
}

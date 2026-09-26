'use client';

/**
 * WirdCard — one wird, one card (H7). Exactly one interactive control: the 72px
 * Done disc (H8/H10) — no end-page control, stepper or sheet. The card has two
 * layouts:
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

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';
import { completeWird } from '@/lib/services/wird';
import Progress from './Progress';
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
export default function WirdCard({ card, onExit }: { card: WirdCardData; onExit?: (id: string) => void }) {
  const { t, fmtNum } = useI18n();
  const router = useRouter();
  const [error, setError] = useState(false);
  const [bouncing, setBouncing] = useState(false);
  const [justDone, setJustDone] = useState(false);

  const scopeText = card.scope.memorized
    ? t('wird.scopeMemorized')
    : t('wird.scopePages', { range: card.scope.range });

  const done = card.doneToday || justDone;

  function onDone() {
    if (done) return;
    // Optimistic: flip the disc and fire the server write now — no spinner, no
    // await. The card exit is handed to the pager only once the disc bounce has
    // played (onAnimationEnd below), so the nice tap animation isn't cut off by
    // the slide. On failure we refresh to restore the true state (I11).
    setBouncing(true); // J1: disc squash-and-stretch on the tap
    setError(false);
    setJustDone(true);
    completeWird(card.id).catch(() => {
      setJustDone(false);
      setError(true);
      router.refresh();
    });
  }

  // Days missed, not days since the last Done: done yesterday means today's
  // portion is simply due, not waiting. Done 2 days ago = yesterday was missed.
  const missed = card.daysSinceLastDone == null ? 0 : card.daysSinceLastDone - 1;
  const stale = !card.doneToday && missed >= 1;
  const staleText =
    missed === 1 ? t('wird.staleYesterday') : t('wird.staleDays', { n: missed });

  return (
    <div
      className="wird-card h-full flex flex-col bg-surface-main border border-subtle rounded-xl shadow-e2 overflow-hidden"
    >
      {/* I4/I5: amber stale bar across the top — informational, never blocks the disc. */}
      {stale && (
        <div className={`flex-none py-2 px-5 text-caption font-semibold text-center ${AMBER}`}>
          {staleText}
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
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center">
            <span className="text-caption font-semibold uppercase tracking-label text-muted">
              {t('wird.startAt')}
            </span>
            {/* Opening reference — the largest element (H7). */}
            <span className="wird-fit-hero block font-extrabold leading-none mt-1 truncate max-w-full">
              {fmtNum(card.opening)}
            </span>
            <span className="block mt-1 text-small font-semibold text-secondary truncate max-w-full">
              {t('wird.readTo', { ref: card.closing })}
            </span>
            <span className="block mt-1 text-caption font-medium text-muted truncate max-w-full">
              {card.portionSinglePage
                ? t('wird.pageRangeOne', { range: card.portionRange })
                : t('wird.pageRange', { range: card.portionRange })}
            </span>
          </div>
        )}

        {/* Footer: progress + pages-to-go, then the disc in the thumb zone (H7/I8). */}
        <div className="wird-fit-footer flex-none flex flex-col">
          {!card.doneToday && (
            <>
              <Progress pct={card.pct} label={t('wird.progressLabel')} />
              <span className="text-small font-bold text-secondary text-center">
                {card.pagesToGo === 1 ? t('wird.pagesToGoOne') : t('wird.pagesToGo', { n: card.pagesToGo })}
              </span>
            </>
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
              onClick={onDone}
              onAnimationEnd={(e) => {
                if (e.animationName === 'wird-disc-bounce') {
                  setBouncing(false);
                  // Bounce done — now hand the exit to the pager so the card
                  // slides away after the tap animation has played (J1→J2).
                  if (onExit) onExit(card.id);
                }
              }}
            >
              <CheckGlyph />
            </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

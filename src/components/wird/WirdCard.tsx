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
export const AMBER_BG = 'color-mix(in srgb, var(--warning) 16%, var(--surface-main))';
export const AMBER_FG = 'color-mix(in srgb, var(--warning) 72%, var(--text-primary))';

const ellipsis: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
};

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
      className="wird-card"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-e2)',
        overflow: 'hidden',
      }}
    >
      {/* I4/I5: amber stale bar across the top — informational, never blocks the disc. */}
      {stale && (
        <div
          style={{
            flex: '0 0 auto',
            padding: '8px var(--space-20)',
            background: AMBER_BG,
            color: AMBER_FG,
            fontSize: 'var(--type-caption-size)',
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          {staleText}
        </div>
      )}

      <div className="wird-fit-body" style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Header: name + scope */}
        <div style={{ flex: '0 0 auto' }}>
          <div className="wird-fit-name" style={{ fontWeight: 700, ...ellipsis }}>{card.name}</div>
          <div style={{ marginTop: 'var(--space-4)', fontSize: 'var(--type-small-size)', fontWeight: 500, color: 'var(--text-muted)', ...ellipsis }}>
            {scopeText}
          </div>
        </div>

        {card.doneToday ? (
          /* I2: completed state. No next-portion task shown. */
          <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-16)' }}>
            <span className="wird-fit-done" style={{ fontWeight: 800, color: 'var(--text-accent)', textAlign: 'center' }}>
              {t('wird.doneToday')}
            </span>
          </div>
        ) : (
          <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <span style={{ fontSize: 'var(--type-caption-size)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)' }}>
              {t('wird.startAt')}
            </span>
            {/* Opening reference — the largest element (H7). */}
            <span className="wird-fit-hero" style={{ display: 'block', fontWeight: 800, lineHeight: 1.1, marginTop: 'var(--space-4)', ...ellipsis }}>
              {fmtNum(card.opening)}
            </span>
            <span style={{ display: 'block', marginTop: 'var(--space-4)', fontSize: 'var(--type-small-size)', fontWeight: 600, color: 'var(--text-secondary)', ...ellipsis }}>
              {t('wird.readTo', { ref: card.closing })}
            </span>
            <span style={{ display: 'block', marginTop: 2, fontSize: 'var(--type-caption-size)', fontWeight: 500, color: 'var(--text-muted)', ...ellipsis }}>
              {card.portionSinglePage
                ? t('wird.pageRangeOne', { range: card.portionRange })
                : t('wird.pageRange', { range: card.portionRange })}
            </span>
          </div>
        )}

        {/* Footer: progress + pages-to-go, then the disc in the thumb zone (H7/I8). */}
        <div className="wird-fit-footer" style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column' }}>
          {!card.doneToday && (
            <>
              <Progress pct={card.pct} label={t('wird.progressLabel')} />
              <span style={{ fontSize: 'var(--type-small-size)', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>
                {card.pagesToGo === 1 ? t('wird.pagesToGoOne') : t('wird.pagesToGo', { n: card.pagesToGo })}
              </span>
            </>
          )}

          {error && (
            <div
              role="alert"
              style={{
                background: 'var(--danger-muted)',
                color: 'var(--danger)',
                borderRadius: 'var(--radius-md)',
                padding: '10px var(--space-12)',
                fontSize: 'var(--type-small-size)',
                fontWeight: 600,
                lineHeight: 1.35,
                textAlign: 'center',
              }}
            >
              {t('wird.completeFailed')}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-flex' }}>
            {/* Radial burst lines, mounted only during the tap bounce so the
                animation replays on every completion. */}
            {bouncing && (
              <span className="wird-rays" aria-hidden>
                {Array.from({ length: 8 }, (_, i) => (
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

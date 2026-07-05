'use client';

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import type { MemorizedRange } from '@/types';
import { AYAH_COUNTS, TOTAL_JUZ, TOTAL_SURAHS, getSurahName } from '@/lib/quran';
import { juzToRanges, normalize, subtractRanges } from '@/lib/memorization';
import { SectionTitle, SurahCombobox, NumberStepper } from '@/components/tracker/ui';

/**
 * Three-step memorization editor (PRD 0008, revised UX).
 *  Step 1: tap the juz you've memorized *completely* (lit/unlit grid).
 *  Step 2: add any extra surahs + ayah ranges (partials outside a full juz).
 *  Step 3: mark your weakest surahs (from the ones you just declared memorized).
 *  Saved ranges = union(selected juz) + the added ranges; weakest = a subset of
 *  those surahs. Pure editor — parents mount it and supply saveLabel + onSave.
 */

const juzUnion = (juz: Set<number>): MemorizedRange[] =>
  normalize([...juz].flatMap((j) => juzToRanges(j)));

/** Juz whose every ayah is present in `ranges` (for /profile prefill). */
const fullyMemorizedJuz = (ranges: MemorizedRange[]): Set<number> => {
  const base = normalize(ranges);
  const sel = new Set<number>();
  for (let j = 1; j <= TOTAL_JUZ; j++) {
    if (subtractRanges(juzToRanges(j), base).length === 0) sel.add(j);
  }
  return sel;
};

export default function MemorizationEditor({
  initialRanges,
  initialWeakest = [],
  onSave,
  saveLabel,
  savedLabel,
}: {
  initialRanges: MemorizedRange[];
  initialWeakest?: number[];
  onSave: (ranges: MemorizedRange[], weakest: number[]) => void | Promise<void>;
  saveLabel: string;
  /** When set, the save button flashes this (with a check) for ~2s after a
   *  successful save, then animates back to `saveLabel`. */
  savedLabel?: string;
}) {
  const { t, locale } = useI18n();
  const rtl = locale === 'ar';

  const LAST_STEP = 2;
  const [step, setStep] = useState(0);
  // Prefill: full juz from the saved ranges; extras = whatever's left over.
  const [selected, setSelected] = useState<Set<number>>(() => fullyMemorizedJuz(initialRanges));
  const [extras, setExtras] = useState<MemorizedRange[]>(() =>
    subtractRanges(normalize(initialRanges), juzUnion(fullyMemorizedJuz(initialRanges)))
  );
  const [weakest, setWeakest] = useState<Set<number>>(() => new Set(initialWeakest));

  const [surah, setSurah] = useState(0);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState('');

  const max = surah ? AYAH_COUNTS[surah] : 1;

  // Surahs the user has declared memorized — the pool step 3 picks weakest from.
  const memorizedSurahs = [
    ...new Set(normalize([...juzUnion(selected), ...extras]).map((r) => r.surah)),
  ].sort((a, b) => a - b);

  // Step-3 dropdown: only offer memorized surahs not already marked weak.
  const weakOptions = memorizedSurahs.filter((s) => !weakest.has(s));

  // Step-2 dropdown: hide surahs already added as extras.
  const extraOptions = Array.from({ length: TOTAL_SURAHS }, (_, i) => i + 1).filter(
    (s) => !extras.some((r) => r.surah === s),
  );

  const addWeak = (s: number) => setWeakest((prev) => new Set(prev).add(s));
  const removeWeak = (s: number) =>
    setWeakest((prev) => {
      const next = new Set(prev);
      next.delete(s);
      return next;
    });

  const toggleJuz = (j: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(j)) next.delete(j);
      else next.add(j);
      return next;
    });

  const pickSurah = (s: number) => {
    setSurah(s);
    setFrom(1);
    setTo(AYAH_COUNTS[s]);
  };

  const addExtra = () => {
    if (!surah) return;
    const lo = Math.max(1, Math.min(from, max));
    const hi = Math.max(lo, Math.min(to, max));
    setExtras((prev) => normalize([...prev, { surah, from: lo, to: hi }]));
  };

  const removeExtra = (i: number) => setExtras((prev) => prev.filter((_, idx) => idx !== i));

  const extraLabel = (r: MemorizedRange) => {
    const name = getSurahName(r.surah, locale);
    return r.from === 1 && r.to === AYAH_COUNTS[r.surah]
      ? name
      : t('memorization.partial', { name, from: r.from, to: r.to });
  };

  const save = async () => {
    setSaving(true);
    try {
      const ranges = normalize([...juzUnion(selected), ...extras]);
      const memSet = new Set(ranges.map((r) => r.surah));
      const weak = [...weakest].filter((s) => memSet.has(s));
      await onSave(ranges, weak);
      if (savedLabel) {
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  const shift = (rtl ? step : -step) * 100;

  return (
    <div className="flex flex-col gap-5">
      {/* Clip the sliding panes horizontally, but leave the bottom open so an
          open combobox dropdown can overflow downward instead of being cut. */}
      <div style={{ clipPath: 'inset(0 0 -1000px 0)' }}>
        <div
          className="flex"
          style={{
            transform: `translateX(${shift}%)`,
            transition: 'transform var(--duration-med, 260ms) var(--ease-out)',
          }}
        >
          {/* ── Step 1: fully-memorized juz ──────────────────────────────── */}
          <div style={{ flex: '0 0 100%', minWidth: 0 }} aria-hidden={step !== 0}>
            <div className="flex flex-col gap-2">
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                {t('memorization.step1Title')}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('memorization.step1Hint')}
              </p>
              <div
                className="grid gap-1.5 mt-1"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 1fr))' }}
              >
                {Array.from({ length: TOTAL_JUZ }, (_, i) => i + 1).map((j) => {
                  const on = selected.has(j);
                  return (
                    <button
                      key={j}
                      type="button"
                      onClick={() => toggleJuz(j)}
                      aria-pressed={on}
                      tabIndex={step === 0 ? 0 : -1}
                      className="flex items-center justify-center"
                      style={{
                        aspectRatio: '1 / 1',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 15,
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: on ? '1px solid var(--accent)' : '1px solid var(--border-default)',
                        background: on ? 'var(--accent)' : 'var(--bg-surface)',
                        color: on ? 'var(--accent-contrast, #fff)' : 'var(--text-muted)',
                        transition: 'all var(--duration-fast) var(--ease-out)',
                      }}
                    >
                      {j}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Step 2: add extra surah/ayah ranges ──────────────────────── */}
          <div style={{ flex: '0 0 100%', minWidth: 0 }} aria-hidden={step !== 1}>
            <div className="flex flex-col gap-2">
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                {t('memorization.step2Title')}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('memorization.step2Hint')}
              </p>
              <div className="flex flex-wrap items-end gap-2 mt-1">
                <SurahCombobox
                  value={surah}
                  onChange={pickSurah}
                  locale={locale}
                  placeholder={t('homework.searchSurah')}
                  surahs={extraOptions}
                />
                <NumberStepper label={t('log.from')} value={from} min={1} max={max} onChange={setFrom} />
                <NumberStepper label={t('log.to')} value={to} min={1} max={max} onChange={setTo} />
                <button
                  type="button"
                  onClick={addExtra}
                  disabled={!surah}
                  tabIndex={step === 1 ? 0 : -1}
                  className="btn btn-primary"
                  style={{ minHeight: 40, opacity: surah ? 1 : 0.5 }}
                >
                  {t('memorization.add')}
                </button>
              </div>

              {extras.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {extras.map((r, i) => (
                    <span
                      key={`${r.surah}-${r.from}-${r.to}`}
                      className="flex items-center gap-2"
                      style={{
                        padding: '6px 8px 6px 12px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--accent-muted)',
                        color: 'var(--text-accent)',
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      {extraLabel(r)}
                      <button
                        type="button"
                        aria-label={t('memorization.remove')}
                        onClick={() => removeExtra(i)}
                        className="flex items-center justify-center"
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-muted)',
                          fontSize: 12,
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Step 3: weakest surahs ───────────────────────────────────── */}
          <div style={{ flex: '0 0 100%', minWidth: 0 }} aria-hidden={step !== 2}>
            <div className="flex flex-col gap-2">
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                {t('memorization.step3Title')}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('memorization.step3Hint')}
              </p>
              {memorizedSurahs.length === 0 ? (
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  {t('memorization.step3Empty')}
                </p>
              ) : (
                <>
                  <div className="mt-1" style={{ maxWidth: 240 }}>
                    <SurahCombobox
                      value={0}
                      onChange={(s) => s && addWeak(s)}
                      locale={locale}
                      placeholder={t('homework.searchSurah')}
                      surahs={weakOptions}
                    />
                  </div>

                  {weakest.size > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {[...weakest].sort((a, b) => a - b).map((s) => (
                        <span
                          key={s}
                          className="flex items-center gap-2"
                          style={{
                            padding: '6px 8px 6px 12px',
                            borderRadius: 'var(--radius-full)',
                            background: 'var(--danger-muted)',
                            color: 'var(--danger)',
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                        >
                          {getSurahName(s, locale)}
                          <button
                            type="button"
                            aria-label={t('memorization.remove')}
                            onClick={() => removeWeak(s)}
                            className="flex items-center justify-center"
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 'var(--radius-full)',
                              background: 'var(--bg-surface)',
                              color: 'var(--text-muted)',
                              fontSize: 12,
                              lineHeight: 1,
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nav — Back leading, Next/Save trailing (right). */}
      <div className="flex items-center justify-between">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="btn btn-ghost"
            style={{ minHeight: 44 }}
          >
            {t('memorization.back')}
          </button>
        ) : (
          <span />
        )}

        {step < LAST_STEP ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="btn btn-primary"
            style={{ minHeight: 44, marginInlineStart: 'auto' }}
          >
            {t('memorization.next')}
          </button>
        ) : (
          <button
            type="button"
            onClick={save}
            disabled={saving || justSaved}
            className="btn btn-primary"
            style={{
              minHeight: 44,
              marginInlineStart: 'auto',
              opacity: saving ? 0.6 : 1,
              background: justSaved ? 'var(--success)' : undefined,
              borderColor: justSaved ? 'var(--success)' : undefined,
              transition: 'background var(--duration-normal) var(--ease-out), border-color var(--duration-normal) var(--ease-out)',
            }}
          >
            {saving ? (
              t('common.loading')
            ) : justSaved ? (
              <span className="flex items-center gap-1.5 animate-fade-in-scale">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {savedLabel}
              </span>
            ) : (
              saveLabel
            )}
          </button>
        )}
      </div>
    </div>
  );
}

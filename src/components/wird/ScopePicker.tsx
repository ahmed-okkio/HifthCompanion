'use client';

/**
 * ScopePicker — the scope half of the wird form (K2–K6).
 *
 * A SegmentedControl of four presets (whole mushaf / juz range / one sūra /
 * what I've memorized). Each preset FILLS page_start/page_end (K2); the two
 * page NumberSteppers below stay editable, and editing either clears the active
 * preset (K3). 'memorized' hides the page steppers, sets scope_source
 * 'memorized' and shows the D8/K5 note; every other preset is 'pages' (K6).
 *
 * All page maths comes from @/lib/quran — nothing is reinvented here. The sūra
 * end page is the next sūra's first page − 1, and 604 for An-Nās, the last sūra
 * (K4 — there is no "next sūra").
 */

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { SegmentedControl, NumberStepper } from '@/components/ui';
import { SurahCombobox } from '@/components/tracker/ui';
import {
  juzPageBounds,
  SURAH_FIRST_PAGES,
  TOTAL_JUZ,
  TOTAL_SURAHS,
  TOTAL_PAGES,
} from '@/lib/quran';
import type { WirdScopeSource } from '@/types';

export type Preset = 'whole' | 'juz' | 'surah' | 'memorized' | '';

export interface ScopeValue {
  scope_source: WirdScopeSource;
  page_start: number;
  page_end: number;
}

/** K4: a sūra's last page = next sūra's first page − 1, or 604 for An-Nās. */
export function surahEndPage(surah: number): number {
  return surah >= TOTAL_SURAHS ? TOTAL_PAGES : SURAH_FIRST_PAGES[surah + 1] - 1;
}

export function ScopePicker({
  preset,
  setPreset,
  value,
  setValue,
  canUseMemorized,
}: {
  preset: Preset;
  setPreset: (p: Preset) => void;
  value: ScopeValue;
  setValue: (v: ScopeValue) => void;
  canUseMemorized: boolean;
}) {
  const { t, locale } = useI18n();
  // Juz-range picker state; only meaningful while preset === 'juz'.
  const [juzFrom, setJuzFrom] = useState(1);
  const [juzTo, setJuzTo] = useState(1);
  const [surah, setSurah] = useState(0);

  const pickPreset = (key: string) => {
    const p = key as Preset;
    if (p === 'whole') {
      setPreset(p);
      setValue({ scope_source: 'pages', page_start: 1, page_end: TOTAL_PAGES });
    } else if (p === 'juz') {
      setPreset(p);
      fillJuz(juzFrom, juzTo);
    } else if (p === 'surah') {
      setPreset(p);
      if (surah) fillSurah(surah);
    } else if (p === 'memorized') {
      if (!canUseMemorized) return;
      setPreset(p);
      // Bounds are derived server-side from user_hifth (D7); the stored values
      // are ignored for 'memorized', so leave the page fields as-is.
      setValue({ ...value, scope_source: 'memorized' });
    }
  };

  const fillJuz = (from: number, to: number) => {
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    setValue({
      scope_source: 'pages',
      page_start: juzPageBounds(lo)[0],
      page_end: juzPageBounds(hi)[1],
    });
  };

  const fillSurah = (s: number) => {
    setValue({
      scope_source: 'pages',
      page_start: SURAH_FIRST_PAGES[s],
      page_end: surahEndPage(s),
    });
  };

  // K3: hand-editing either page number drops the preset (now a custom range).
  const editStart = (page_start: number) => {
    setPreset('');
    setValue({ scope_source: 'pages', page_start, page_end: value.page_end });
  };
  const editEnd = (page_end: number) => {
    setPreset('');
    setValue({ scope_source: 'pages', page_start: value.page_start, page_end });
  };

  const presets = [
    { key: 'whole', label: t('wird.presetWhole') },
    { key: 'juz', label: t('wird.presetJuz') },
    { key: 'surah', label: t('wird.presetSurah') },
    { key: 'memorized', label: t('wird.presetMemorized') },
  ];

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
        {t('wird.formScope')}
      </span>
      <SegmentedControl options={presets} value={preset} onChange={pickPreset} />

      {preset === 'juz' && (
        <div className="flex flex-wrap items-end gap-2">
          <NumberStepper
            label={t('wird.juzFrom')}
            value={juzFrom}
            min={1}
            max={TOTAL_JUZ}
            onChange={(v) => { setJuzFrom(v); fillJuz(v, juzTo); }}
          />
          <NumberStepper
            label={t('wird.juzTo')}
            value={juzTo}
            min={1}
            max={TOTAL_JUZ}
            onChange={(v) => { setJuzTo(v); fillJuz(juzFrom, v); }}
          />
        </div>
      )}

      {preset === 'surah' && (
        <SurahCombobox
          value={surah}
          onChange={(s) => { setSurah(s); if (s) fillSurah(s); }}
          locale={locale}
          placeholder={t('homework.searchSurah')}
        />
      )}

      {preset === 'memorized' ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          {t('wird.memorizedNote')}
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <NumberStepper
            label={t('wird.pageStart')}
            value={value.page_start}
            min={1}
            max={TOTAL_PAGES}
            onChange={editStart}
          />
          <NumberStepper
            label={t('wird.pageEnd')}
            value={value.page_end}
            min={1}
            max={TOTAL_PAGES}
            onChange={editEnd}
          />
        </div>
      )}

      {!canUseMemorized && preset !== 'memorized' && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('wird.memorizedUnavailable')}
        </p>
      )}
    </div>
  );
}

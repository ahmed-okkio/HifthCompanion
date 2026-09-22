'use client';

/**
 * WirdForm — create a wird (M7, contract §K). A modal over /wird, matching the
 * shipped LegendModal dialog pattern (overlay + Escape + click-out close).
 *
 * Captures name, scope (via ScopePicker) and rate, and states the projected
 * finish before saving (K1). Rate is a page count + a period of 1/7/14/30 days;
 * the daily portion is derived through C2 (wirdRate.portionSizes), never
 * floor(pages/days) (K7). An end page before the start is rejected with a fix
 * message (K8); an empty name and a 'memorized' wird with no ranges are rejected
 * by the service (D10/F2) and surfaced here. A legal but slow rate saves, and
 * the same projected-finish line states how long the pass takes (K9).
 */

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { NumberStepper } from '@/components/ui';
import { createWird, updateWird } from '@/lib/services/wird';
import { dailyRate, portionSizes, projectedFinishDays } from '@/lib/wirdRate';
import { TOTAL_PAGES } from '@/lib/quran';
import { ScopePicker, type Preset, type ScopeValue } from './ScopePicker';

const PERIODS = [1, 7, 14, 30] as const;

/** An existing wird to edit; omit to create. */
export interface WirdEdit {
  id: string;
  name: string;
  scope_source: ScopeValue['scope_source'];
  page_start: number;
  page_end: number;
  pages_per_period: number;
  period_days: number;
}

export default function WirdForm({
  open,
  onClose,
  onCreated,
  canUseMemorized,
  memorizedPages,
  wird,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  canUseMemorized: boolean;
  /** Page span of the caller's memorized scope, for the memorized projection (0 if none). */
  memorizedPages: number;
  wird?: WirdEdit;
}) {
  const { t, locale, fmtNum } = useI18n();
  const editing = wird != null;

  const [name, setName] = useState(wird?.name ?? '');
  const [preset, setPreset] = useState<Preset>(
    wird ? (wird.scope_source === 'memorized' ? 'memorized' : '') : 'whole',
  );
  const [scope, setScope] = useState<ScopeValue>(
    wird
      ? { scope_source: wird.scope_source, page_start: wird.page_start, page_end: wird.page_end }
      : { scope_source: 'pages', page_start: 1, page_end: TOTAL_PAGES },
  );
  const [pagesPerPeriod, setPagesPerPeriod] = useState(wird?.pages_per_period ?? 1);
  const [periodDays, setPeriodDays] = useState<number>(wird?.period_days ?? 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const rate = dailyRate(pagesPerPeriod, periodDays);
  // C2 portion sizes across the period — the display never uses floor(pages/days).
  const sizes = portionSizes(periodDays, rate);
  const minSize = Math.min(...sizes);
  const maxSize = Math.max(...sizes);
  const dailyLabel =
    minSize === maxSize
      ? t('wird.dailyPortion', { n: minSize })
      : t('wird.dailyPortionRange', { min: minSize, max: maxSize });

  // Pages in one pass. For 'memorized' the range is server-derived, so use the
  // caller's memorized span for the projection.
  const passPages =
    scope.scope_source === 'memorized' ? memorizedPages : scope.page_end - scope.page_start + 1;
  const endBeforeStart = scope.scope_source === 'pages' && scope.page_end < scope.page_start;

  const finishDays = passPages > 0 ? projectedFinishDays(passPages, rate) : 0;
  const finishDate = new Date(Date.now() + finishDays * 86_400_000).toLocaleDateString(
    locale === 'ar' ? 'ar' : 'en',
    { year: 'numeric', month: 'long', day: 'numeric' },
  );
  const projectionLabel =
    finishDays > 0 ? t('wird.projectedFinish', { days: finishDays, date: finishDate }) : '';

  const submit = async () => {
    if (name.trim() === '') { setError(t('wird.errorName')); return; }
    if (endBeforeStart) { setError(t('wird.errorEndBeforeStart')); return; }
    setSaving(true);
    setError('');
    const payload = {
      name,
      scope_source: scope.scope_source,
      page_start: scope.scope_source === 'pages' ? scope.page_start : undefined,
      page_end: scope.scope_source === 'pages' ? scope.page_end : undefined,
      pages_per_period: pagesPerPeriod,
      period_days: periodDays,
    };
    try {
      if (editing) await updateWird(wird.id, payload);
      else await createWird(payload);
      onCreated();
    } catch {
      // Service rejects empty name / no-ranges memorized (D10) server-side too.
      setError(t(editing ? 'wird.updateFailed' : 'wird.createFailed'));
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(editing ? 'wird.editWird' : 'wird.newWird')}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-16)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-main)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-e3)',
          width: 'min(480px, 100%)',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-20) var(--space-24) var(--space-12)', flexShrink: 0 }}>
          <h2 style={{ fontSize: 'var(--type-heading-m-size)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {t(editing ? 'wird.editWird' : 'wird.newWird')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('wird.cancel')}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, lineHeight: 0 }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="thin-scroll" style={{ overflowY: 'auto', padding: '0 var(--space-24) var(--space-24)', display: 'flex', flexDirection: 'column', gap: 'var(--space-20)' }}>
          {/* Name */}
          <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {t('wird.formName')}
            <input
              className="input"
              value={name}
              placeholder={t('wird.formNamePlaceholder')}
              onChange={(e) => setName(e.target.value)}
              style={{ fontWeight: 400 }}
            />
          </label>

          {/* Scope (K2–K6) */}
          <ScopePicker
            preset={preset}
            setPreset={setPreset}
            value={scope}
            setValue={setScope}
            canUseMemorized={canUseMemorized}
          />

          {/* Rate (K7) */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {t('wird.formRate')}
            </span>
            <div className="flex flex-wrap items-end gap-3">
              <NumberStepper
                label={t('wird.ratePages')}
                value={pagesPerPeriod}
                // At least one whole page per day (min = the period's day count):
                // a lower rate would size some days at 0 pages and split the
                // portion across empty Done taps.
                min={periodDays}
                max={TOTAL_PAGES}
                onChange={setPagesPerPeriod}
              />
              <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {t('wird.ratePeriod')}
                <select
                  className="input"
                  value={periodDays}
                  onChange={(e) => {
                    const d = Number(e.target.value);
                    setPeriodDays(d);
                    // keep rate ≥ 1 page/day (never a 0-page portion)
                    if (pagesPerPeriod < d) setPagesPerPeriod(d);
                  }}
                  style={{ height: 40, width: 'auto' }}
                >
                  {PERIODS.map((p) => (
                    <option key={p} value={p}>{t(`wird.period${p}`)}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{dailyLabel}</p>
          </div>

          {/* Projected finish + slow-rate consequence (K1/K9) */}
          {projectionLabel && (
            <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              {projectionLabel}
            </p>
          )}

          {error && (
            <p className="text-sm" role="alert" style={{ color: 'var(--danger)', lineHeight: 1.45 }}>
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ minHeight: 44 }}>
              {t('wird.cancel')}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving || endBeforeStart}
              className="btn btn-primary"
              style={{ minHeight: 44, opacity: saving || endBeforeStart ? 0.6 : 1 }}
            >
              {saving ? t('common.loading') : t(editing ? 'wird.saveChanges' : 'wird.create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

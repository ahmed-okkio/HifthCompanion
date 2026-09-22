'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useI18n } from '@/components/I18nProvider';

/** Labeled −/+ stepper for bounded numbers (page ranges). Replaces bare
 *  type="number" inputs whose native spinners look nothing like the app. */
export function NumberStepper({
  label,
  value,
  min,
  max,
  values,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Allowed values, ascending (e.g. memorized pages). −/+ step through them
      and a typed value snaps to the next allowed one. Omit for every integer. */
  values?: number[];
  onChange: (v: number) => void;
}) {
  const { t } = useI18n();
  const clamp = (v: number) => {
    const n = Math.max(min, Math.min(max, Number.isNaN(v) ? min : v));
    return values ? values.find((x) => x >= n) ?? values[values.length - 1] : n;
  };
  // Draft mirrors the field while typing so intermediate states ("", "6" on the
  // way to "60") aren't clamped mid-keystroke; commit on blur.
  const [draft, setDraft] = useState<string | null>(null);
  const step = (delta: number) => {
    setDraft(null);
    if (!values) { onChange(clamp(value + delta)); return; }
    const i = values.indexOf(clamp(value)) + delta;
    onChange(values[Math.max(0, Math.min(values.length - 1, i))]);
  };
  const btn: CSSProperties = {
    width: 34,
    alignSelf: 'stretch',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-muted)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'all var(--duration-fast) var(--ease-out)',
  };
  return (
    <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
      {label}
      <span
        className="flex items-center"
        style={{
          height: 40,
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-input)',
          overflow: 'hidden',
        }}
      >
        <button type="button" aria-label={t('common.decrement')} tabIndex={-1} style={btn}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => step(-1)}>
          −
        </button>
        <input
          type="number"
          aria-label={label}
          inputMode="numeric"
          value={draft ?? value}
          min={min}
          max={max}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value !== '' && n >= min && n <= max && (!values || values.includes(n))) onChange(n);
          }}
          onBlur={() => {
            onChange(clamp(Number(draft ?? value)));
            setDraft(null);
          }}
          onFocus={(e) => e.target.select()}
          style={{
            width: 46,
            textAlign: 'center',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        />
        <button type="button" aria-label={t('common.increment')} tabIndex={-1} style={btn}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => step(1)}>
          +
        </button>
      </span>
    </label>
  );
}

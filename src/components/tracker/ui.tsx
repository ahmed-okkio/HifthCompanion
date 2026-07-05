'use client';

/**
 * Shared presentational primitives for the tracker module. Logic-free — these
 * exist purely to give the tracker pages the same calm, card-driven hierarchy
 * as the reader (design tokens only, no bare hex/px palette values).
 */

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { HomeworkStatus } from '@/lib/homework';
import { TOTAL_SURAHS, getSurahName } from '@/lib/quran';

/** Badge palette per homework status — open/completed/missed at a glance. */
export const HOMEWORK_STATUS_STYLE: Record<HomeworkStatus, CSSProperties> = {
  open: { background: 'var(--accent-muted)', color: 'var(--text-accent)' },
  completed: { background: 'rgba(16,185,129,0.12)', color: 'var(--success)' },
  missed: { background: 'var(--danger-muted)', color: 'var(--danger)' },
};

/** Page hero: large title + optional subtitle, the same altitude the reader
 *  uses for section intros. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1
          className="font-bold tracking-tight"
          style={{ color: 'var(--text-primary)', fontSize: 'var(--type-heading-l-size)' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

/** Uppercase section label, optionally trailed by a count pill or other node. */
export function SectionTitle({
  children,
  trailing,
}: {
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <h2
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
      >
        {children}
      </h2>
      {trailing}
    </div>
  );
}

/** Dashed, centered placeholder shown when a list is empty. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center gap-1"
      style={{
        padding: '28px 20px',
        border: '1px dashed var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        color: 'var(--text-muted)',
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

/** Deterministic initial/colour avatar derived from an id or name. Gives the
 *  roster real visual identity without inventing profile data. */
export function Avatar({ seed, size = 36 }: { seed: string; size?: number }) {
  const hues = [160, 200, 260, 320, 20, 95];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = hues[h % hues.length];
  const initial = (seed.trim()[0] ?? '?').toUpperCase();
  return (
    <span
      aria-hidden
      className="flex items-center justify-center font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--radius-full)',
        fontSize: size * 0.4,
        color: `hsl(${hue} 55% 32%)`,
        background: `hsl(${hue} 70% 92%)`,
      }}
    >
      {initial}
    </span>
  );
}

/** KPI tile: icon chip + big value over a small label. */
export function StatCard({
  value,
  label,
  icon,
}: {
  value: ReactNode;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <div className="card flex items-center gap-3" style={{ padding: '14px 16px' }}>
      {icon && (
        <span
          aria-hidden
          className="flex items-center justify-center shrink-0"
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-md)',
            background: 'var(--accent-muted)',
            fontSize: 18,
          }}
        >
          {icon}
        </span>
      )}
      <div className="flex flex-col min-w-0">
        <span
          className="font-bold leading-tight truncate"
          style={{ color: 'var(--text-primary)', fontSize: 22 }}
        >
          {value}
        </span>
        <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
      </div>
    </div>
  );
}

/** Calendar-style date block for agenda rows: weekday over day-of-month. */
export function DateChip({ iso, locale }: { iso: string; locale: string }) {
  const d = new Date(iso);
  return (
    <span
      aria-hidden
      className="flex flex-col items-center justify-center shrink-0"
      style={{
        width: 46,
        height: 46,
        borderRadius: 'var(--radius-md)',
        background: 'var(--accent-muted)',
        color: 'var(--text-accent)',
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', lineHeight: 1.4 }}>
        {d.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })}
      </span>
      <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.1 }}>{d.getUTCDate()}</span>
    </span>
  );
}

/** Labeled −/+ stepper for bounded numbers (page ranges). Replaces bare
 *  type="number" inputs whose native spinners look nothing like the app. */
export function NumberStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, Number.isNaN(v) ? min : v));
  // Draft mirrors the field while typing so intermediate states ("", "6" on the
  // way to "60") aren't clamped mid-keystroke; commit on blur.
  const [draft, setDraft] = useState<string | null>(null);
  const step = (delta: number) => {
    setDraft(null);
    onChange(clamp(value + delta));
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
        <button type="button" aria-label="−" tabIndex={-1} style={btn}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => step(-1)}>
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={draft ?? value}
          min={min}
          max={max}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value !== '' && n >= min && n <= max) onChange(n);
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
        <button type="button" aria-label="+" tabIndex={-1} style={btn}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => step(1)}>
          +
        </button>
      </span>
    </label>
  );
}

/** Searchable surah picker: styled text input filtering the 114 surahs by
 *  number or name (en/ar), with a styled dropdown listbox. Reusable — click or
 *  Enter selects, Escape / click-outside closes. Written for the prescribe
 *  picker; drops in anywhere a full-surah selection is needed. */
export function SurahCombobox({
  value,
  onChange,
  locale,
  placeholder,
  surahs,
  fluid,
}: {
  value: number;
  onChange: (surah: number) => void;
  locale: 'en' | 'ar';
  placeholder?: string;
  /** Restrict the list to these surah numbers (default: all 114). */
  surahs?: number[];
  /** Stretch to fill the container instead of the default 200px field width. */
  fluid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const all = surahs ?? Array.from({ length: TOTAL_SURAHS }, (_, i) => i + 1);
  const q = query.trim().toLowerCase();
  const matches = q
    ? all.filter(
        (s) =>
          String(s).startsWith(q) ||
          getSurahName(s, 'en').toLowerCase().includes(q) ||
          getSurahName(s, 'ar').includes(query.trim()),
      )
    : all;

  const select = (s: number) => {
    onChange(s);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={wrap} style={{ position: 'relative', width: fluid ? '100%' : 200, maxWidth: '100%' }}>
      <input
        className="input input-sm"
        style={{ minHeight: 40, width: '100%', paddingInlineEnd: 32 }}
        value={open ? query : value ? `${value}. ${getSurahName(value, locale)}` : ''}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        // Reopen when the input is clicked while already focused (after a pick,
        // focus stays put so onFocus won't refire).
        onClick={() => {
          setOpen(true);
          setQuery('');
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && matches.length > 0) {
            e.preventDefault();
            select(matches[0]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          insetInlineEnd: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          display: 'flex',
        }}
      >
        <Chevron open={open} />
      </span>
      {open && matches.length > 0 && (
        <ul
          role="listbox"
          className="card"
          style={{
            position: 'absolute',
            zIndex: 20,
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: 240,
            overflowY: 'auto',
            padding: 4,
            margin: 0,
            listStyle: 'none',
          }}
        >
          {matches.map((s) => (
            <li key={s}>
              <button
                type="button"
                role="option"
                aria-selected={s === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(s)}
                className="btn btn-ghost"
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  textAlign: 'start',
                  minHeight: 34,
                  padding: '6px 10px',
                  fontSize: 13,
                  fontWeight: s === value ? 600 : 400,
                  color: s === value ? 'var(--text-accent)' : 'var(--text-primary)',
                }}
              >
                {s}. {getSurahName(s, locale)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Renders the first `pageSize` items with a "Load more" button that reveals
 *  the next page. Keeps long lists (homework, logs, notes) from burying the
 *  page. `render` supplies the key; `loadMoreLabel` is passed in so this stays
 *  i18n-agnostic. */
export function PagedList<T>({
  items,
  render,
  loadMoreLabel,
  pageSize = 8,
}: {
  items: T[];
  render: (item: T) => ReactNode;
  loadMoreLabel: string;
  pageSize?: number;
}) {
  const [shown, setShown] = useState(pageSize);
  return (
    <>
      {items.slice(0, shown).map(render)}
      {items.length > shown && (
        <button
          onClick={() => setShown((n) => n + pageSize)}
          className="btn btn-ghost self-center"
          style={{ minHeight: 40, fontSize: 13 }}
        >
          {loadMoreLabel}
        </button>
      )}
    </>
  );
}

/** Small status dot (active/pending/…). */
export function StatusDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="shrink-0"
      style={{ width: 8, height: 8, borderRadius: 'var(--radius-full)', background: color }}
    />
  );
}

/** Right-pointing chevron used to mark a row as navigable. Flips under RTL.
 *  Pass `open` to rotate it down as a collapse/expand affordance. */
export function Chevron({ open }: { open?: boolean } = {}) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 rtl:-scale-x-100"
      style={{
        color: 'var(--text-muted)',
        transform: open ? 'rotate(90deg)' : undefined,
        transition: 'transform var(--duration-fast) var(--ease-out)',
      }}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/** Inline stroke icons (feather/lucide geometry) replacing emoji so glyphs stay
 *  on-brand, currentColor-tinted, and consistent across platforms. */
const ICON_PATHS: Record<string, ReactNode> = {
  sparkles: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />,
  'circle-people': (
    <>
      <circle cx="19" cy="12" r="2.1" />
      <circle cx="15.5" cy="5.94" r="2.1" />
      <circle cx="8.5" cy="5.94" r="2.1" />
      <circle cx="5" cy="12" r="2.1" />
      <circle cx="8.5" cy="18.06" r="2.1" />
      <circle cx="15.5" cy="18.06" r="2.1" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="m10.7 12.3 9.3-9.3M15.5 7.5l3 3 3-3-3-3" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  flame: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
  book: (
    <>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  trending: <path d="M22 7 13.5 15.5 8.5 10.5 2 17M16 7h6v6" />,
  hourglass: <path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.41L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.41L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2" />,
  alert: (
    <>
      <path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  'arrow-left': <path d="M19 12H5m7 7-7-7 7-7" />,
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  folder: <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />,
};

export function Icon({ name, size = 18 }: { name: keyof typeof ICON_PATHS; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

/** Wide segmented control: equal segments in a rounded frame, divided by thin
 *  separators. The active segment fills with the accent (fades, no slide).
 *  Used for status pickers and mode toggles. RTL-safe. */
export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string; icon?: ReactNode }[];
  value: string;
  onChange: (key: string) => void;
}) {
  const n = options.length;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${n}, 1fr)`,
        background: 'var(--bg-input)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      {options.map((o, i) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={on}
            style={{
              minHeight: 44,
              padding: '0 12px',
              border: 'none',
              borderInlineStart: i > 0 ? '1px solid var(--border-default)' : 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              background: on ? 'var(--accent)' : 'transparent',
              color: on ? 'var(--accent-contrast, #fff)' : 'var(--text-secondary)',
              transition: 'background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)',
            }}
          >
            <span className="flex items-center justify-center gap-2">
              {o.icon}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Tab bar for switching between views. Minimal — just a row of buttons. */
export function TabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex gap-0 overflow-x-auto overflow-y-hidden" role="tablist" style={{ borderBottom: '2px solid var(--border-subtle)' }}>
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(t.key)}
            className="btn btn-ghost shrink-0"
            style={{
              minHeight: 42,
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--text-accent)' : 'var(--text-muted)',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -2,
              borderRadius: 0,
              padding: '8px 20px',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Short, friendly label for a member that has no profile name yet. */
export function shortId(id: string) {
  return id.slice(0, 6);
}

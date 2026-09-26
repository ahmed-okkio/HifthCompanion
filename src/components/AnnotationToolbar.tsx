'use client';
import { useRef } from 'react';
import { type Tool, ALL_TOOLS, TOOL_ICONS, PRESET_COLORS } from '@/lib/canvasTools';
import { useI18n } from '@/components/I18nProvider';
import type { MessageKey } from '@/lib/i18n/dictionaries';

interface Props {
  activeTool: Tool;
  activeColor: string;
  canUndo: boolean;
  canRedo: boolean;
  /** Canvas has something to clear. Spread mode passes "either page has marks". */
  canClear: boolean;
  saving: boolean;
  onToolClick: (t: Tool) => void;
  onColorChange: (c: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onHoverEnter: (t: Tool, pos: { top: number; left: number }) => void;
  onHoverLeave: () => void;
  // Desktop Move/pan tool: when active, dragging pans the (zoomed) page instead of drawing.
  moveActive: boolean;
  onMoveToggle: () => void;
}

// Vertical divider between groups in the horizontal bar.
function Divider() {
  return (
    <div
      aria-hidden
      className="mx-2 h-10 w-px self-center bg-subtle"
    />
  );
}

export default function AnnotationToolbar({
  activeTool, activeColor, canUndo, canRedo, canClear,
  onToolClick, onColorChange, onUndo, onRedo, onClear,
  onHoverEnter, onHoverLeave, moveActive, onMoveToggle,
}: Props) {
  const { t } = useI18n();
  // Tool/color names are English module constants (TOOL_LABELS/PRESET_COLORS);
  // resolve display text through the dictionary here where the hook is available.
  const toolLabel = (tool: Tool) => t(`tool.${tool}` as MessageKey);
  const colorLabel = (name: string) => t(`color.${name}` as MessageKey);
  const buttonRefs = useRef<Record<Tool, HTMLButtonElement | null>>({} as Record<Tool, HTMLButtonElement | null>);

  // Horizontal bar: popover drops BELOW the hovered tool button. Clamp horizontally to viewport.
  const handleMouseEnter = (t: Tool) => {
    const el = buttonRefs.current[t];
    if (!el) { onHoverEnter(t, { top: 0, left: 0 }); return; }
    const rect = el.getBoundingClientRect();
    const popWidth = 260;
    const vw = window.innerWidth || 1024;
    let leftPos = rect.left + rect.width / 2 - popWidth / 2;
    leftPos = Math.max(8, leftPos);
    leftPos = Math.min(leftPos, Math.max(8, vw - popWidth - 8));
    onHoverEnter(t, { left: leftPos, top: rect.bottom + 10 });
  };

  // Single white horizontal <aside> bar (no collapse — always open on desktop). The desktop E2E
  // selectors scope to `aside` (aside.sticky + aside button[title=...]), so this stays one aside.
  // Every tool/action button is flex:1 and stretches to the full bar height, so they read as a
  // uniform row of equal-sized cells that fills the bar (no clustered groups with empty gaps).
  // Never shrink below a usable touch target; cells grow equally to fill the bar.
  const cellBase = 'flex min-w-11 flex-1 flex-col items-center justify-center gap-1 self-stretch rounded-md transition-colors duration-(--duration-fast) ease-out';
  const cellDisabled = 'pointer-events-none cursor-not-allowed text-muted opacity-45';
  const labelCls = 'text-meta leading-none';
  const iconBox = 'flex h-6 w-6 items-center justify-center';

  return (
    <aside
      /* Shadow lives on the outer (unclipped) element — clip-path on the inner
         wrapper would otherwise cut the box-shadow off at the border box. */
      className="sticky top-24 z-10 flex min-h-22 w-full items-center rounded-lg shadow-e2"
    >
      {/* Rounded wrapper clips the scroll edge — a reserved (classic) scrollbar's
          corner is NOT clipped by plain overflow:hidden on Windows, so we use
          clip-path (geometry-based, platform-independent) to hard-clip the box,
          scrollbar included, to the rounded rect. */}
      <div
        className="relative min-h-22 w-full overflow-hidden rounded-lg border border-subtle bg-surface-main [clip-path:inset(0_round_var(--radius-lg))]"
      >
      <div
        className="relative flex min-h-22 w-full items-stretch gap-2 overflow-x-auto p-3"
      >
        {/* Move/pan tool — left of the drawing tools. Active = drag pans the zoomed page. */}
        <button
          type="button"
          onClick={onMoveToggle}
          title={t('annot.move')}
          className={`${cellBase} ${moveActive ? 'bg-accent-muted text-green-600' : 'text-muted hover:bg-neutral-100'}`}
        >
          <span className={iconBox}>
            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
            </svg>
          </span>
          <span className={labelCls}>{t('annot.move')}</span>
        </button>

        {/* Tools — equal-width cells filling the bar height */}
        {ALL_TOOLS.map(t => (
          <button
            key={t}
            ref={el => { buttonRefs.current[t] = el; }}
            onClick={() => onToolClick(t)}
            title={toolLabel(t)}
            className={`${cellBase} ${(activeTool === t && !moveActive) ? 'bg-accent-muted text-green-600' : 'text-muted hover:bg-neutral-100'}`}
            onMouseEnter={() => handleMouseEnter(t)}
            onMouseLeave={onHoverLeave}
          >
            <span className={iconBox}>
              {TOOL_ICONS[t]}
            </span>
            <span className={labelCls}>
              {toolLabel(t)}
            </span>
          </button>
        ))}

        <Divider />

        {/* Undo / Redo / Clear — equal-width cells, same height fill */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          suppressHydrationWarning
          title={t('annot.undo')}
          aria-disabled={!canUndo}
          className={`${cellBase} [&>svg]:h-6 [&>svg]:w-6 hover:bg-neutral-100 ${!canUndo ? cellDisabled : 'text-secondary'}`}
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          <span className={labelCls}>{t('annot.undo')}</span>
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          suppressHydrationWarning
          title={t('annot.redo')}
          aria-disabled={!canRedo}
          className={`${cellBase} [&>svg]:h-6 [&>svg]:w-6 hover:bg-neutral-100 ${!canRedo ? cellDisabled : 'text-secondary'}`}
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
          <span className={labelCls}>{t('annot.redo')}</span>
        </button>

        <button
          onClick={onClear}
          disabled={!canClear}
          title={t('annot.clearAll')}
          aria-label={t('annot.clearAll')}
          aria-disabled={!canClear}
          // Same disabled treatment as undo/redo above, but keeps the danger hue when live.
          className={`${cellBase} [&>svg]:h-6 [&>svg]:w-6 hover:bg-neutral-100 ${!canClear ? cellDisabled : 'text-danger'}`}
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className={labelCls}>{t('annot.clear')}</span>
        </button>

        <Divider />

        {/* Color swatches — small circles, fixed group at the right (not stretched). */}
        <div className="flex flex-shrink-0 items-center gap-3 px-2">
          {PRESET_COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => onColorChange(c.value)}
              title={colorLabel(c.name)}
              className={`h-5 w-5 flex-shrink-0 rounded-full border-2 outline-offset-2 transition-shadow duration-(--duration-fast) ease-out ${activeColor === c.value ? 'border-primary outline-2 outline-primary' : 'border-transparent'}`}
              // eslint-disable-next-line shadcn/no-inline-styles -- preset swatch colour (+ its tinted ring) from data
              style={{ backgroundColor: c.value, boxShadow: activeColor === c.value ? `0 0 0 2px ${c.value}40` : 'none' }}
            />
          ))}
        </div>
      </div>
      </div>
    </aside>
  );
}

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
      style={{ width: '1px', height: '40px', alignSelf: 'center', background: 'var(--border-subtle)', margin: '0 var(--space-8, 8px)' }}
    />
  );
}

export default function AnnotationToolbar({
  activeTool, activeColor, canUndo, canRedo,
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
  const cellBase: React.CSSProperties = {
    flex: '1 1 0',
    // Never shrink below a usable touch target; cells grow equally to fill the bar at real
    // desktop widths, and the bar scrolls only if the column is extremely narrow.
    minWidth: '44px',
    alignSelf: 'stretch',
    borderRadius: 'var(--radius-btn-px)',
    transition: 'background var(--duration-fast, 120ms) var(--ease-out, ease)',
  };

  return (
    <aside
      className="sticky top-24 z-10 flex w-full items-center"
      style={{
        minHeight: '88px',
        /* Shadow lives on the outer (unclipped) element — clip-path on the inner
           wrapper would otherwise cut the box-shadow off at the border box. */
        borderRadius: 'var(--radius-lg-px)',
        boxShadow: 'var(--shadow-e2)',
      }}
    >
      {/* Rounded wrapper clips the scroll edge — a reserved (classic) scrollbar's
          corner is NOT clipped by plain overflow:hidden on Windows, so we use
          clip-path (geometry-based, platform-independent) to hard-clip the box,
          scrollbar included, to the rounded rect. */}
      <div
        className="relative w-full"
        style={{
          minHeight: '88px',
          background: 'var(--surface-main)',
          borderRadius: 'var(--radius-lg-px)',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          clipPath: 'inset(0 round var(--radius-lg-px))',
        }}
      >
      <div
        className="relative flex w-full items-stretch gap-2 overflow-x-auto p-3"
        style={{ minHeight: '88px' }}
      >
        {/* Move/pan tool — left of the drawing tools. Active = drag pans the zoomed page. */}
        <button
          type="button"
          onClick={onMoveToggle}
          title={t('annot.move')}
          className="flex flex-col items-center justify-center gap-1"
          style={{
            ...cellBase,
            background: moveActive ? 'var(--green-soft)' : 'transparent',
            color: moveActive ? 'var(--text-accent)' : 'var(--text-muted)',
          }}
          onMouseEnter={e => { if (!moveActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--neutral-100)'; }}
          onMouseLeave={e => { if (!moveActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}>
            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
            </svg>
          </span>
          <span style={{ fontSize: 'var(--type-meta-size)', fontWeight: 'var(--type-meta-weight)', lineHeight: 1 }}>{t('annot.move')}</span>
        </button>

        {/* Tools — equal-width cells filling the bar height */}
        {ALL_TOOLS.map(t => (
          <button
            key={t}
            ref={el => { buttonRefs.current[t] = el; }}
            onClick={() => onToolClick(t)}
            title={toolLabel(t)}
            className="flex flex-col items-center justify-center gap-1"
            style={{
              ...cellBase,
              background: (activeTool === t && !moveActive) ? 'var(--green-soft)' : 'transparent',
              color: (activeTool === t && !moveActive) ? 'var(--text-accent)' : 'var(--text-muted)',
            }}
            onMouseEnter={e => {
              if (!(activeTool === t && !moveActive)) (e.currentTarget as HTMLButtonElement).style.background = 'var(--neutral-100)';
              handleMouseEnter(t);
            }}
            onMouseLeave={e => {
              if (!(activeTool === t && !moveActive)) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              onHoverLeave();
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}>
              {TOOL_ICONS[t]}
            </span>
            <span style={{ fontSize: 'var(--type-meta-size)', fontWeight: 'var(--type-meta-weight)', lineHeight: 1 }}>
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
          className="flex flex-col items-center justify-center gap-1 [&>svg]:h-6 [&>svg]:w-6"
          style={{
            ...cellBase,
            background: 'transparent',
            ...(!canUndo ? { opacity: 0.45, cursor: 'not-allowed', color: 'var(--text-muted)', pointerEvents: 'none' } : { color: 'var(--text-secondary)' }),
          }}
          onMouseEnter={e => { if (canUndo) (e.currentTarget as HTMLButtonElement).style.background = 'var(--neutral-100)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          <span style={{ fontSize: 'var(--type-meta-size)', fontWeight: 'var(--type-meta-weight)', lineHeight: 1 }}>{t('annot.undo')}</span>
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          suppressHydrationWarning
          title={t('annot.redo')}
          aria-disabled={!canRedo}
          className="flex flex-col items-center justify-center gap-1 [&>svg]:h-6 [&>svg]:w-6"
          style={{
            ...cellBase,
            background: 'transparent',
            ...(!canRedo ? { opacity: 0.45, cursor: 'not-allowed', color: 'var(--text-muted)', pointerEvents: 'none' } : { color: 'var(--text-secondary)' }),
          }}
          onMouseEnter={e => { if (canRedo) (e.currentTarget as HTMLButtonElement).style.background = 'var(--neutral-100)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
          <span style={{ fontSize: 'var(--type-meta-size)', fontWeight: 'var(--type-meta-weight)', lineHeight: 1 }}>{t('annot.redo')}</span>
        </button>

        <button
          onClick={onClear}
          title={t('annot.clearAll')}
          aria-label={t('annot.clearAll')}
          className="flex flex-col items-center justify-center gap-1 [&>svg]:h-6 [&>svg]:w-6"
          style={{
            ...cellBase,
            background: 'transparent',
            color: 'var(--danger-500)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--neutral-100)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span style={{ fontSize: 'var(--type-meta-size)', fontWeight: 'var(--type-meta-weight)', lineHeight: 1 }}>{t('annot.clear')}</span>
        </button>

        <Divider />

        {/* Color swatches — small circles, fixed group at the right (not stretched). */}
        <div className="flex flex-shrink-0 items-center gap-3 px-2">
          {PRESET_COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => onColorChange(c.value)}
              title={colorLabel(c.name)}
              className="flex-shrink-0 rounded-full"
              style={{
                width: '20px',
                height: '20px',
                backgroundColor: c.value,
                border: activeColor === c.value ? '2px solid var(--text-primary)' : '2px solid transparent',
                boxShadow: activeColor === c.value ? `0 0 0 2px ${c.value}40` : 'none',
                outline: activeColor === c.value ? '2px solid var(--text-primary)' : 'none',
                outlineOffset: '2px',
                transition: 'box-shadow var(--duration-fast, 120ms) var(--ease-out, ease)',
              }}
            />
          ))}
        </div>
      </div>
      </div>
    </aside>
  );
}

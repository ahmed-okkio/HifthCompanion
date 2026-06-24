'use client';
import { useState } from 'react';
import { type Tool, ALL_TOOLS, TOOL_ICONS, TOOL_LABELS, PRESET_COLORS } from '@/lib/canvasTools';

interface Props {
  activeTool: Tool;
  activeColor: string;
  canUndo: boolean;
  canRedo: boolean;
  saving: boolean;
  mode: 'move' | 'draw';
  onModeChange: (m: 'move' | 'draw') => void;
  onToolClick: (t: Tool) => void;
  onColorChange: (c: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

type Popover = 'tools' | 'colors' | 'more' | null;

const cardStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 'calc(100% + 8px)',
  background: 'var(--bg-glass)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-max)',  /* 20px — token cap */
  boxShadow: 'var(--shadow-e3)',
  padding: 'var(--space-8)',
  zIndex: 2,
};

const triggerStyle: React.CSSProperties = {
  width: 46,
  height: 46,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 'var(--radius-md-px)',  /* 14px */
  flexShrink: 0,
  transition: 'background var(--duration-fast) var(--ease-out)',
};

export default function MobileAnnotationBar({
  activeTool, activeColor, canUndo, canRedo, saving,
  mode, onModeChange, onToolClick, onColorChange, onUndo, onRedo, onClear,
}: Props) {
  const drawing = mode === 'draw';
  const [open, setOpen] = useState<Popover>(null);
  const toggle = (p: Popover) => setOpen(cur => (cur === p ? null : p));
  const close = () => setOpen(null);

  return (
    <div
      data-testid="mobile-annotation-bar"
      className="lg:hidden"
      style={{
        position: 'fixed',
        /* Floating: lifted off the bottom edge and inset from the sides so all four rounded
           corners are visible (a hovering pill, not a flush-to-edge bar). */
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        left: 14,
        right: 14,
        zIndex: 45,
        /* V3 Story 16 — glass bar: white-tinted glass + 16px backdrop blur. Lifted off the
           bottom with a deep shadow so it clearly hovers above the page. */
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(16px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-max)',
        boxShadow: '0 14px 36px rgba(15, 23, 42, 0.22)',
      }}
    >
      {saving && (
        <span
          aria-hidden
          style={{ position: 'absolute', top: 6, right: 8, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-solid)', zIndex: 3 }}
        />
      )}

      {/* Outside-tap backdrop — covers the page (within this fixed bar's stacking context) so
          a tap anywhere off the popover closes it. Popovers sit above it via z-index. */}
      {open && (
        <div
          aria-hidden
          onClick={close}
          style={{ position: 'fixed', inset: 0, zIndex: 1, background: 'transparent' }}
        />
      )}

      {/* Tool grid popover */}
      {open === 'tools' && (
        <div role="menu" aria-label="Tools" style={{ ...cardStyle, left: 8, display: 'flex', gap: 4 }}>
          {ALL_TOOLS.map(t => (
            <button
              key={t}
              onClick={() => { onToolClick(t); close(); }}
              title={TOOL_LABELS[t]}
              aria-label={TOOL_LABELS[t]}
              className="[&>svg]:h-5 [&>svg]:w-5"
              style={{
                width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 'var(--radius-btn-px)',  /* 12px */
                ...(activeTool === t
                  ? { background: 'var(--accent-muted)', color: 'var(--text-accent)' }
                  : { color: 'var(--text-muted)' }),
              }}
            >
              {TOOL_ICONS[t]}
              <span className="sr-only">{TOOL_LABELS[t]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Color palette popover */}
      {open === 'colors' && (
        <div role="menu" aria-label="Colors" style={{ ...cardStyle, left: 62, display: 'flex', gap: 8, alignItems: 'center' }}>
          {PRESET_COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => { onColorChange(c.value); close(); }}
              title={c.name}
              aria-label={c.name}
              style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                backgroundColor: c.value,
                border: activeColor === c.value ? '2px solid var(--text-primary)' : '2px solid transparent',
                boxShadow: activeColor === c.value ? '0 0 0 2px var(--bg-base)' : 'none',
              }}
            >
              <span className="sr-only">{c.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Overflow menu popover */}
      {open === 'more' && (
        <div role="menu" aria-label="More actions" style={{ ...cardStyle, right: 8, minWidth: 160 }}>
          <button
            onClick={() => { onClear(); close(); }}
            title="Clear all drawings"
            aria-label="Clear all drawings"
            className="btn btn-danger-ghost"
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-btn-px)', justifyContent: 'flex-start' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Clear page</span>
          </button>
        </div>
      )}

      {/* The bar row — five evenly-spaced controls, always fits (no horizontal scroll). */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '5px 8px', gap: 4 }}>
        {/* Move / Draw toggle — default Move lets a finger scroll the page; tap to draw. */}
        <button
          onClick={() => onModeChange(drawing ? 'move' : 'draw')}
          title={drawing ? 'Drawing — tap to scroll' : 'Scrolling — tap to draw'}
          aria-label={drawing ? 'Drawing mode, tap to switch to scroll' : 'Scroll mode, tap to switch to draw'}
          aria-pressed={drawing}
          className="[&>svg]:h-5 [&>svg]:w-5"
          style={{
            ...triggerStyle,
            width: 'auto',
            paddingInline: 10,
            gap: 4,
            fontSize: 13,
            fontWeight: 700,
            ...(drawing
              ? { background: 'var(--accent-solid)', color: '#fff' }
              : { background: 'transparent', color: 'var(--text-muted)', boxShadow: 'inset 0 0 0 1px var(--border-subtle)' }),
          }}
        >
          {drawing ? (
            // pencil
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
          ) : (
            // hand / move
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
              <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
              <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
            </svg>
          )}
          <span>{drawing ? 'Draw' : 'Move'}</span>
        </button>

        {/* Tool selector — shows active tool + chevron */}
        <button
          onClick={() => toggle('tools')}
          title="Tools"
          aria-label="Tools"
          aria-expanded={open === 'tools'}
          className="[&>svg]:h-5 [&>svg]:w-5"
          style={{ ...triggerStyle, gap: 2, width: 'auto', paddingInline: 8, color: 'var(--text-accent)', background: open === 'tools' ? 'var(--accent-muted)' : 'transparent' }}
        >
          {TOOL_ICONS[activeTool]}
          <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 8l5 5 5-5" />
          </svg>
          <span className="sr-only">Tools</span>
        </button>

        {/* Color selector — shows current color dot */}
        <button
          onClick={() => toggle('colors')}
          title="Color"
          aria-label="Color"
          aria-expanded={open === 'colors'}
          style={{ ...triggerStyle, background: open === 'colors' ? 'var(--accent-muted)' : 'transparent' }}
        >
          <span style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: activeColor, boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.15)' }} />
          <span className="sr-only">Color</span>
        </button>

        <button
          onClick={onUndo}
          disabled={!canUndo}
          suppressHydrationWarning
          title="Undo"
          aria-disabled={!canUndo}
          style={{ ...triggerStyle, color: 'var(--text-muted)', ...(!canUndo ? { opacity: 0.4, pointerEvents: 'none' } : {}) }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          <span className="sr-only">Undo</span>
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          suppressHydrationWarning
          title="Redo"
          aria-disabled={!canRedo}
          style={{ ...triggerStyle, color: 'var(--text-muted)', ...(!canRedo ? { opacity: 0.4, pointerEvents: 'none' } : {}) }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
          <span className="sr-only">Redo</span>
        </button>

        <button
          onClick={() => toggle('more')}
          title="More"
          aria-label="More actions"
          aria-expanded={open === 'more'}
          style={{ ...triggerStyle, color: 'var(--text-muted)', background: open === 'more' ? 'var(--accent-muted)' : 'transparent' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 12h.01M12 12h.01M19 12h.01" />
          </svg>
          <span className="sr-only">More actions</span>
        </button>
      </div>
    </div>
  );
}

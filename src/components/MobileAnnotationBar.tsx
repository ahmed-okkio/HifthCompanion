'use client';
import { useState } from 'react';
import { type Tool, ALL_TOOLS, TOOL_ICONS, TOOL_LABELS, PRESET_COLORS } from '@/lib/canvasTools';

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
}

type Popover = 'tools' | 'colors' | 'more' | null;

const cardStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 'calc(100% + 8px)',
  background: 'var(--bg-glass)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 16,
  boxShadow: '0 12px 32px rgba(2, 6, 23, 0.18)',
  padding: 8,
  zIndex: 2,
};

const triggerStyle: React.CSSProperties = {
  width: 46,
  height: 46,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 14,
  flexShrink: 0,
  transition: 'background var(--duration-fast) var(--ease-out)',
};

export default function MobileAnnotationBar({
  activeTool, activeColor, canUndo, canRedo, saving,
  onToolClick, onColorChange, onUndo, onRedo, onClear,
}: Props) {
  const [open, setOpen] = useState<Popover>(null);
  const toggle = (p: Popover) => setOpen(cur => (cur === p ? null : p));
  const close = () => setOpen(null);

  return (
    <div
      data-testid="mobile-annotation-bar"
      className="lg:hidden"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 45,
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--border-subtle)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
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
                borderRadius: 12,
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
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, justifyContent: 'flex-start' }}
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

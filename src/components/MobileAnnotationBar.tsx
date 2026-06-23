'use client';
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

export default function MobileAnnotationBar({
  activeTool, activeColor, canUndo, canRedo, saving,
  onToolClick, onColorChange, onUndo, onRedo, onClear,
}: Props) {
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
          style={{
            position: 'absolute',
            top: 6,
            right: 8,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--accent-solid)',
          }}
        />
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '6px 10px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
        className="[&::-webkit-scrollbar]:hidden"
      >
        {ALL_TOOLS.map(t => (
          <button
            key={t}
            onClick={() => onToolClick(t)}
            title={TOOL_LABELS[t]}
            className="flex-shrink-0 flex items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5"
            style={{
              width: 44,
              height: 44,
              transition: 'all var(--duration-fast) var(--ease-out)',
              ...(activeTool === t
                ? { background: 'var(--accent-muted)', color: 'var(--text-accent)' }
                : { color: 'var(--text-muted)' }),
            }}
          >
            {TOOL_ICONS[t]}
            <span className="sr-only">{TOOL_LABELS[t]}</span>
          </button>
        ))}

        <div
          aria-hidden
          style={{
            flexShrink: 0,
            width: 1,
            height: 28,
            background: 'var(--border-subtle)',
            margin: '0 6px',
          }}
        />

        {PRESET_COLORS.map(c => (
          <button
            key={c.value}
            onClick={() => onColorChange(c.value)}
            title={c.name}
            className="flex-shrink-0 rounded-full"
            style={{
              width: 24,
              height: 24,
              backgroundColor: c.value,
              border: activeColor === c.value
                ? '2px solid var(--text-primary)'
                : '2px solid transparent',
              boxShadow: activeColor === c.value ? `0 0 0 2px var(--bg-base)` : 'none',
              margin: '0 3px',
              transition: 'border var(--duration-fast) var(--ease-out)',
            }}
          >
            <span className="sr-only">{c.name}</span>
          </button>
        ))}

        <div
          aria-hidden
          style={{
            flexShrink: 0,
            width: 1,
            height: 28,
            background: 'var(--border-subtle)',
            margin: '0 6px',
          }}
        />

        <button
          onClick={onUndo}
          disabled={!canUndo}
          suppressHydrationWarning
          title="Undo"
          aria-disabled={!canUndo}
          className="flex-shrink-0 flex items-center justify-center rounded-xl btn btn-ghost"
          style={{
            width: 44,
            height: 44,
            border: '1px solid var(--border-subtle)',
            ...(!canUndo ? { opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none', background: 'transparent', boxShadow: 'none' } : {}),
          }}
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
          className="flex-shrink-0 flex items-center justify-center rounded-xl btn btn-ghost"
          style={{
            width: 44,
            height: 44,
            border: '1px solid var(--border-subtle)',
            ...(!canRedo ? { opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none', background: 'transparent', boxShadow: 'none' } : {}),
          }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
          <span className="sr-only">Redo</span>
        </button>

        <button
          onClick={onClear}
          title="Clear all drawings"
          aria-label="Clear all drawings"
          className="flex-shrink-0 flex items-center justify-center rounded-xl btn btn-danger-ghost"
          style={{
            width: 44,
            height: 44,
            border: '1px solid var(--border-subtle)',
          }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="sr-only">Clear</span>
        </button>
      </div>
    </div>
  );
}

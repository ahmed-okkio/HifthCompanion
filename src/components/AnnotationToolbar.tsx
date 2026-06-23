'use client';
import { useRef, useState, useEffect } from 'react';
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
  onHoverEnter: (t: Tool, pos: { top: number; left: number }) => void;
  onHoverLeave: () => void;
}

export default function AnnotationToolbar({
  activeTool, activeColor, canUndo, canRedo, saving,
  onToolClick, onColorChange, onUndo, onRedo, onClear,
  onHoverEnter, onHoverLeave,
}: Props) {
  const [toolbarOpen, setToolbarOpen] = useState(true);
  useEffect(() => {
    const stored = localStorage.getItem('hifth:toolbarOpen');
    if (stored !== null) setToolbarOpen(stored !== 'false');
  }, []);
  const setToolbarOpenPersisted = (val: boolean) => {
    localStorage.setItem('hifth:toolbarOpen', String(val));
    setToolbarOpen(val);
  };
  const buttonRefs = useRef<Record<Tool, HTMLButtonElement | null>>({} as Record<Tool, HTMLButtonElement | null>);

  const handleMouseEnter = (t: Tool) => {
    const el = buttonRefs.current[t];
    if (!el) { onHoverEnter(t, { top: 0, left: 0 }); return; }
    const rect = el.getBoundingClientRect();
    const popWidth = 260;
    const margin = 12;
    const vw = window.innerWidth || 1024;
    let leftPos = rect.left - popWidth - margin;
    leftPos = Math.max(8, leftPos);
    leftPos = Math.min(leftPos, Math.max(8, vw - popWidth - 8));
    onHoverEnter(t, { left: leftPos, top: rect.top + rect.height / 2 });
  };

  if (!toolbarOpen) {
    return (
      <aside className="sticky top-24 flex flex-col items-center gap-3 justify-self-start" style={{ width: '72px' }}>
        <div className="flex w-full flex-col items-center rounded-3xl bg-white/82 p-2 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl" style={{ border: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setToolbarOpenPersisted(true)}
            title="Show annotation tools"
            className="w-12 h-12 flex items-center justify-center rounded-2xl transition-colors hover:bg-black/5"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span className="sr-only">Show annotation tools</span>
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="sticky top-24 flex flex-col items-center gap-3 justify-self-start" style={{ width: '72px' }}>
      <div className="flex w-full flex-col items-center rounded-3xl bg-white/82 p-2 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl" style={{ border: '1px solid var(--border-subtle)' }}>
        <div className="w-full flex justify-center pt-1 pb-0.5">
          <button
            onClick={() => setToolbarOpenPersisted(false)}
            title="Hide toolbar"
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors hover:bg-black/5"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="sr-only">Hide toolbar</span>
          </button>
        </div>

        <div className="flex flex-col items-center gap-2 my-1 w-full">
          {ALL_TOOLS.map(t => (
            <button
              key={t}
              ref={el => { buttonRefs.current[t] = el; }}
              onClick={() => onToolClick(t)}
              onMouseEnter={() => handleMouseEnter(t)}
              onMouseLeave={onHoverLeave}
              title={TOOL_LABELS[t]}
              className="w-12 h-12 flex items-center justify-center rounded-2xl [&>svg]:h-5 [&>svg]:w-5"
              style={{
                transition: 'all var(--duration-fast) var(--ease-out)',
                ...(activeTool === t
                  ? { background: 'var(--accent-muted)', color: 'var(--text-accent)', boxShadow: '0 6px 18px var(--accent-glow)' }
                  : { color: 'var(--text-muted)' }),
              }}
            >
              {TOOL_ICONS[t]}
            </button>
          ))}

          <div className="flex flex-col items-center gap-2 my-2 w-full mt-3 rounded-2xl bg-slate-950/[0.025] py-2">
            {PRESET_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => onColorChange(c.value)}
                title={c.name}
                className="w-6 h-6 rounded-full"
                style={{
                  backgroundColor: c.value,
                  border: activeColor === c.value ? '2px solid var(--text-primary)' : '2px solid transparent',
                  boxShadow: activeColor === c.value ? `0 4px 12px ${c.value}30` : 'none',
                }}
              />
            ))}
          </div>
        </div>

        <hr style={{ width: '100%', borderColor: 'var(--border-subtle)' }} />

        <div className="mt-3 w-full flex flex-col items-center gap-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            suppressHydrationWarning
            title="Undo"
            aria-disabled={!canUndo}
            className="w-12 h-12 flex items-center justify-center rounded-full btn btn-ghost"
            style={{
              border: '1px solid var(--border-subtle)',
              ...(!canUndo ? { opacity: 0.45, cursor: 'not-allowed', color: 'var(--text-muted)', pointerEvents: 'none', background: 'transparent', boxShadow: 'none' } : {}),
            }}
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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
            className="w-12 h-12 flex items-center justify-center rounded-full btn btn-ghost"
            style={{
              border: '1px solid var(--border-subtle)',
              ...(!canRedo ? { opacity: 0.45, cursor: 'not-allowed', color: 'var(--text-muted)', pointerEvents: 'none', background: 'transparent', boxShadow: 'none' } : {}),
            }}
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
            </svg>
            <span className="sr-only">Redo</span>
          </button>

          <button
            onClick={onClear}
            title="Clear all drawings"
            aria-label="Clear all drawings"
            className="w-12 h-12 flex items-center justify-center rounded-full btn btn-danger-ghost"
            style={{ border: '1px solid var(--border-subtle)' }}
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="sr-only">Clear</span>
          </button>
        </div>

        {saving && <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />}
      </div>
    </aside>
  );
}

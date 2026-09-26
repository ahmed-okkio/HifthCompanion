'use client';
import { useState } from 'react';
import { type Tool, ALL_TOOLS, TOOL_ICONS, PRESET_COLORS } from '@/lib/canvasTools';
import { useI18n } from '@/components/I18nProvider';
import type { MessageKey } from '@/lib/i18n/dictionaries';

interface Props {
  activeTool: Tool;
  activeColor: string;
  canUndo: boolean;
  canRedo: boolean;
  /** Canvas has something to clear. */
  canClear: boolean;
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

const cardCls = 'absolute bottom-[calc(100%+8px)] z-2 rounded-xl border border-subtle bg-glass p-2 shadow-e3 backdrop-blur-lg';

const triggerCls = 'flex h-11.5 items-center justify-center rounded-md transition-colors duration-(--duration-fast) ease-out';
const disabledCls = 'pointer-events-none opacity-40';

export default function MobileAnnotationBar({
  activeTool, activeColor, canUndo, canRedo, canClear, saving,
  mode, onModeChange, onToolClick, onColorChange, onUndo, onRedo, onClear,
}: Props) {
  const { t } = useI18n();
  const toolLabel = (tool: Tool) => t(`tool.${tool}` as MessageKey);
  const colorLabel = (name: string) => t(`color.${name}` as MessageKey);
  const drawing = mode === 'draw';
  const [open, setOpen] = useState<Popover>(null);
  const toggle = (p: Popover) => setOpen(cur => (cur === p ? null : p));
  const close = () => setOpen(null);

  return (
    <div
      data-testid="mobile-annotation-bar"
      /* Floating: lifted off the bottom edge and inset from the sides so all four rounded
         corners are visible. iOS Safari bug: position:fixed + backdrop-filter on the SAME
         element drops the fixed behaviour on scroll — keep this fixed layer plain; any
         surface/blur lives on the inner wrapper. */
      className="fixed inset-x-3.5 bottom-[calc(env(safe-area-inset-bottom,0px)+16px)] z-45 lg:hidden"
    >
      {/* Opaque surface: translucent glass let page content (e.g. the Sets card) read through the controls. */}
      <div className="relative rounded-xl border border-subtle bg-surface-main shadow-float">
      {saving && (
        <span
          aria-hidden
          className="absolute right-2 top-1.5 z-3 h-1.5 w-1.5 rounded-full bg-green-600"
        />
      )}

      {/* Outside-tap backdrop — covers the page (within this fixed bar's stacking context) so
          a tap anywhere off the popover closes it. Popovers sit above it via z-index. */}
      {open && (
        <div
          aria-hidden
          onClick={close}
          className="fixed inset-0 z-1 bg-transparent"
        />
      )}

      {/* Tool grid popover */}
      {open === 'tools' && (
        <div role="menu" aria-label={t('annot.tools')} className={`${cardCls} left-2 flex gap-1`}>
          {ALL_TOOLS.map(t => (
            <button
              key={t}
              onClick={() => { onToolClick(t); close(); }}
              title={toolLabel(t)}
              aria-label={toolLabel(t)}
              className={`flex h-11.5 w-11.5 items-center justify-center rounded-md [&>svg]:h-5 [&>svg]:w-5 ${activeTool === t ? 'bg-accent-muted text-green-600' : 'text-muted'}`}
            >
              {TOOL_ICONS[t]}
              <span className="sr-only">{toolLabel(t)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Color palette popover */}
      {open === 'colors' && (
        <div role="menu" aria-label={t('annot.colors')} className={`${cardCls} left-15.5 flex items-center gap-2`}>
          {PRESET_COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => { onColorChange(c.value); close(); }}
              title={colorLabel(c.name)}
              aria-label={colorLabel(c.name)}
              className={`h-8.5 w-8.5 shrink-0 rounded-full border-2 ${activeColor === c.value ? 'border-primary ring-2 ring-surface-app' : 'border-transparent'}`}
              // eslint-disable-next-line shadcn/no-inline-styles -- preset swatch colour from data
              style={{ backgroundColor: c.value }}
            >
              <span className="sr-only">{colorLabel(c.name)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Overflow menu popover */}
      {open === 'more' && (
        <div role="menu" aria-label={t('annot.moreActions')} className={`${cardCls} right-2 min-w-40`}>
          <button
            onClick={() => { onClear(); close(); }}
            disabled={!canClear}
            title={t('annot.clearAll')}
            aria-label={t('annot.clearAll')}
            aria-disabled={!canClear}
            className={`btn btn-danger-ghost w-full justify-start gap-2.5 rounded-md ${!canClear ? disabledCls : ''}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="text-body font-semibold">{t('annot.clearPage')}</span>
          </button>
        </div>
      )}

      {/* The bar row — five evenly-spaced controls, always fits (no horizontal scroll). */}
      <div data-testid="mobile-annotation-row" className="relative z-2 flex items-center justify-around gap-1 px-2 py-1.25">
        {/* Move / Draw toggle — default Move lets a finger scroll the page; tap to draw. */}
        <button
          onClick={() => onModeChange(drawing ? 'move' : 'draw')}
          title={drawing ? t('annot.drawingTapScroll') : t('annot.scrollingTapDraw')}
          aria-label={drawing ? t('annot.drawingModeAria') : t('annot.scrollModeAria')}
          aria-pressed={drawing}
          className={`${triggerCls} gap-1 px-2.5 text-small font-bold [&>svg]:h-5 [&>svg]:w-5 ${drawing ? 'bg-green-600 text-accent-contrast' : 'bg-transparent text-muted ring-1 ring-inset ring-subtle'}`}
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
          <span>{drawing ? t('annot.draw') : t('annot.move')}</span>
        </button>

        {/* Tool selector — shows active tool + chevron */}
        <button
          onClick={() => toggle('tools')}
          title={t('annot.tools')}
          aria-label={t('annot.tools')}
          aria-expanded={open === 'tools'}
          className={`${triggerCls} gap-0.5 px-2 text-green-600 [&>svg]:h-5 [&>svg]:w-5 ${open === 'tools' ? 'bg-accent-muted' : 'bg-transparent'}`}
        >
          {TOOL_ICONS[activeTool]}
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 8l5 5 5-5" />
          </svg>
          <span className="sr-only">{t('annot.tools')}</span>
        </button>

        {/* Color selector — shows current color dot */}
        <button
          onClick={() => toggle('colors')}
          title={t('annot.color')}
          aria-label={t('annot.color')}
          aria-expanded={open === 'colors'}
          className={`${triggerCls} w-11.5 ${open === 'colors' ? 'bg-accent-muted' : 'bg-transparent'}`}
        >
          <span
            className="h-5.5 w-5.5 rounded-full ring-1 ring-inset ring-default"
            // eslint-disable-next-line shadcn/no-inline-styles -- user-picked colour
            style={{ backgroundColor: activeColor }}
          />
          <span className="sr-only">{t('annot.color')}</span>
        </button>

        <button
          onClick={onUndo}
          disabled={!canUndo}
          suppressHydrationWarning
          title={t('annot.undo')}
          aria-disabled={!canUndo}
          className={`${triggerCls} w-11.5 text-muted ${!canUndo ? disabledCls : ''}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          <span className="sr-only">{t('annot.undo')}</span>
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          suppressHydrationWarning
          title={t('annot.redo')}
          aria-disabled={!canRedo}
          className={`${triggerCls} w-11.5 text-muted ${!canRedo ? disabledCls : ''}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
          <span className="sr-only">{t('annot.redo')}</span>
        </button>

        <button
          onClick={() => toggle('more')}
          title={t('annot.more')}
          aria-label={t('annot.moreActions')}
          aria-expanded={open === 'more'}
          className={`${triggerCls} w-11.5 text-muted ${open === 'more' ? 'bg-accent-muted' : 'bg-transparent'}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 12h.01M12 12h.01M19 12h.01" />
          </svg>
          <span className="sr-only">{t('annot.moreActions')}</span>
        </button>
      </div>
      </div>
    </div>
  );
}

'use client';
import { type Tool } from '@/lib/canvasTools';
import { useI18n } from '@/components/I18nProvider';

const POPOVER_TOOLS: Tool[] = ['pen', 'circle', 'underline', 'highlighter', 'eraser'];

interface Props {
  hoveredTool: Tool | null;
  hoverPos: { top: number; left: number } | null;
  penWidth: number;
  opacity: number;
  eraserSize: number;
  onPenWidthChange: (v: number) => void;
  onOpacityChange: (v: number) => void;
  onEraserSizeChange: (v: number) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export default function ToolHoverPopover({
  hoveredTool, hoverPos, penWidth, opacity, eraserSize,
  onPenWidthChange, onOpacityChange, onEraserSizeChange, onMouseEnter, onMouseLeave,
}: Props) {
  const { t } = useI18n();
  if (!hoveredTool || !hoverPos || !POPOVER_TOOLS.includes(hoveredTool)) return null;

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ position: 'fixed', left: hoverPos.left, top: hoverPos.top, width: 260, zIndex: 60 }}
      className="hidden lg:block"
    >
      <div
        style={{
          background: 'var(--surface-main)',
          border: '1px solid var(--neutral-200)',
          borderRadius: 'var(--radius-md-px)',
          boxShadow: 'var(--shadow-e3)',
          padding: 'var(--space-12) var(--space-16)',
        }}
      >
        {(hoveredTool === 'pen' || hoveredTool === 'circle' || hoveredTool === 'underline') && (
          <div className="flex items-center gap-3" style={{ minHeight: '28px' }}>
            <span style={{ fontSize: 'var(--type-small-size)', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('annot.size')}</span>
            <input
              type="range" min="1" max="40" step="1" value={penWidth}
              onChange={e => onPenWidthChange(Number(e.target.value))}
              className="w-full cursor-pointer accent-[var(--green-600)]"
              style={{ height: '4px' }}
            />
            <span style={{ minWidth: '36px', textAlign: 'right', fontSize: 'var(--type-small-size)', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{penWidth}</span>
          </div>
        )}
        {hoveredTool === 'eraser' && (
          <div className="flex items-center gap-3" style={{ minHeight: '28px' }}>
            <span style={{ fontSize: 'var(--type-small-size)', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('annot.size')}</span>
            <input
              type="range" min="8" max="60" step="1" value={eraserSize}
              onChange={e => onEraserSizeChange(Number(e.target.value))}
              className="w-full cursor-pointer accent-[var(--green-600)]"
              style={{ height: '4px' }}
            />
            <span style={{ minWidth: '36px', textAlign: 'right', fontSize: 'var(--type-small-size)', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{eraserSize}</span>
          </div>
        )}
        {hoveredTool === 'highlighter' && (
          <div className="flex items-center gap-3" style={{ minHeight: '28px' }}>
            <span style={{ fontSize: 'var(--type-small-size)', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('annot.opacity')}</span>
            <input
              type="range" min="0.1" max="0.9" step="0.05" value={opacity}
              onChange={e => onOpacityChange(parseFloat(e.target.value))}
              className="w-full cursor-pointer accent-[var(--green-600)]"
              style={{ height: '4px' }}
            />
            <span style={{ minWidth: '36px', textAlign: 'right', fontSize: 'var(--type-small-size)', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(opacity * 100)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

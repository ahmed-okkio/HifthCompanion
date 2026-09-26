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
      className="fixed z-60 hidden w-65 lg:block"
      // eslint-disable-next-line shadcn/no-inline-styles -- runtime anchor position
      style={{ left: hoverPos.left, top: hoverPos.top }}
    >
      <div className="rounded-md border border-neutral-200 bg-surface-main px-4 py-3 shadow-e2">
        {(hoveredTool === 'pen' || hoveredTool === 'circle' || hoveredTool === 'underline') && (
          <div className="flex min-h-7 items-center gap-3">
            <span className="text-small font-semibold text-secondary">{t('annot.size')}</span>
            <input
              type="range" min="1" max="40" step="1" value={penWidth}
              onChange={e => onPenWidthChange(Number(e.target.value))}
              className="h-1 w-full cursor-pointer accent-green-600"
            />
            <span className="min-w-9 text-right text-small font-semibold tabular-nums text-primary">{penWidth}</span>
          </div>
        )}
        {hoveredTool === 'eraser' && (
          <div className="flex min-h-7 items-center gap-3">
            <span className="text-small font-semibold text-secondary">{t('annot.size')}</span>
            <input
              type="range" min="8" max="60" step="1" value={eraserSize}
              onChange={e => onEraserSizeChange(Number(e.target.value))}
              className="h-1 w-full cursor-pointer accent-green-600"
            />
            <span className="min-w-9 text-right text-small font-semibold tabular-nums text-primary">{eraserSize}</span>
          </div>
        )}
        {hoveredTool === 'highlighter' && (
          <div className="flex min-h-7 items-center gap-3">
            <span className="text-small font-semibold text-secondary">{t('annot.opacity')}</span>
            <input
              type="range" min="0.1" max="0.9" step="0.05" value={opacity}
              onChange={e => onOpacityChange(parseFloat(e.target.value))}
              className="h-1 w-full cursor-pointer accent-green-600"
            />
            <span className="min-w-9 text-right text-small font-semibold tabular-nums text-primary">{Math.round(opacity * 100)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

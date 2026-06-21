'use client';
import { type Tool } from '@/lib/canvasTools';

const POPOVER_TOOLS: Tool[] = ['pen', 'circle', 'underline', 'highlighter'];

interface Props {
  hoveredTool: Tool | null;
  hoverPos: { top: number; left: number } | null;
  penWidth: number;
  opacity: number;
  onPenWidthChange: (v: number) => void;
  onOpacityChange: (v: number) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export default function ToolHoverPopover({
  hoveredTool, hoverPos, penWidth, opacity,
  onPenWidthChange, onOpacityChange, onMouseEnter, onMouseLeave,
}: Props) {
  if (!hoveredTool || !hoverPos || !POPOVER_TOOLS.includes(hoveredTool)) return null;

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ position: 'fixed', left: hoverPos.left, top: hoverPos.top, transform: 'translateY(-50%)', width: 260, zIndex: 60 }}
      className="hidden lg:block"
    >
      <div className="bg-[var(--bg-elevated)] rounded-md p-3 shadow-lg" style={{ border: '1px solid var(--border-subtle)' }}>
        {(hoveredTool === 'pen' || hoveredTool === 'circle' || hoveredTool === 'underline') && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Size</span>
            <input
              type="range" min="1" max="40" step="1" value={penWidth}
              onChange={e => onPenWidthChange(Number(e.target.value))}
              className="w-full h-1 rounded-lg cursor-pointer accent-emerald-500"
            />
            <span className="text-sm font-mono w-8">{penWidth}</span>
          </div>
        )}
        {hoveredTool === 'highlighter' && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Opacity</span>
            <input
              type="range" min="0.1" max="0.9" step="0.05" value={opacity}
              onChange={e => onOpacityChange(parseFloat(e.target.value))}
              className="w-full h-1 rounded-lg cursor-pointer accent-emerald-500"
            />
            <span className="text-sm font-mono w-8">{Math.round(opacity * 100)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

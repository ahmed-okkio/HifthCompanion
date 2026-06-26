import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AnnotationToolbar from '../components/AnnotationToolbar';
import { ALL_TOOLS, PRESET_COLORS, TOOL_LABELS } from '../lib/canvasTools';

const defaultProps = {
  activeTool: 'pen' as const,
  activeColor: '#ef4444',
  canUndo: false,
  canRedo: false,
  saving: false,
  onToolClick: vi.fn(),
  onColorChange: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onClear: vi.fn(),
  onHoverEnter: vi.fn(),
  onHoverLeave: vi.fn(),
  moveActive: false,
  onMoveToggle: vi.fn(),
};

describe('AnnotationToolbar', () => {
  it('renders a button for every tool', () => {
    render(<AnnotationToolbar {...defaultProps} />);
    for (const tool of ALL_TOOLS) {
      expect(screen.getByTitle(TOOL_LABELS[tool])).toBeInTheDocument();
    }
  });

  it('renders a color swatch for every preset color', () => {
    render(<AnnotationToolbar {...defaultProps} />);
    for (const color of PRESET_COLORS) {
      expect(screen.getByTitle(color.name)).toBeInTheDocument();
    }
  });

  it('calls onToolClick with tool name on button click', () => {
    const onToolClick = vi.fn();
    render(<AnnotationToolbar {...defaultProps} onToolClick={onToolClick} />);
    fireEvent.click(screen.getByTitle('Highlighter'));
    expect(onToolClick).toHaveBeenCalledWith('highlighter');
  });

  it('calls onColorChange with color value on swatch click', () => {
    const onColorChange = vi.fn();
    render(<AnnotationToolbar {...defaultProps} onColorChange={onColorChange} />);
    fireEvent.click(screen.getByTitle('Green'));
    expect(onColorChange).toHaveBeenCalledWith('#22c55e');
  });

  it('Undo button disabled when canUndo=false', () => {
    render(<AnnotationToolbar {...defaultProps} canUndo={false} />);
    expect(screen.getByTitle('Undo').closest('button')).toHaveAttribute('aria-disabled', 'true');
  });

  it('Undo button enabled when canUndo=true', () => {
    render(<AnnotationToolbar {...defaultProps} canUndo={true} />);
    expect(screen.getByTitle('Undo').closest('button')).not.toBeDisabled();
  });

  it('Redo button disabled when canRedo=false', () => {
    render(<AnnotationToolbar {...defaultProps} canRedo={false} />);
    expect(screen.getByTitle('Redo').closest('button')).toHaveAttribute('aria-disabled', 'true');
  });

  it('Redo button enabled when canRedo=true', () => {
    render(<AnnotationToolbar {...defaultProps} canRedo={true} />);
    expect(screen.getByTitle('Redo').closest('button')).not.toBeDisabled();
  });

  it('calls onUndo on Undo click', () => {
    const onUndo = vi.fn();
    render(<AnnotationToolbar {...defaultProps} canUndo={true} onUndo={onUndo} />);
    fireEvent.click(screen.getByTitle('Undo'));
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it('calls onRedo on Redo click', () => {
    const onRedo = vi.fn();
    render(<AnnotationToolbar {...defaultProps} canRedo={true} onRedo={onRedo} />);
    fireEvent.click(screen.getByTitle('Redo'));
    expect(onRedo).toHaveBeenCalledOnce();
  });

  it('calls onClear on clear button click', () => {
    const onClear = vi.fn();
    render(<AnnotationToolbar {...defaultProps} onClear={onClear} />);
    fireEvent.click(screen.getByTitle('Clear all drawings'));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('calls onHoverEnter on tool button mouseenter', () => {
    const onHoverEnter = vi.fn();
    render(<AnnotationToolbar {...defaultProps} onHoverEnter={onHoverEnter} />);
    fireEvent.mouseEnter(screen.getByTitle('Pen'));
    expect(onHoverEnter).toHaveBeenCalledWith('pen', expect.objectContaining({ top: expect.any(Number), left: expect.any(Number) }));
  });

  it('calls onHoverLeave on tool button mouseleave', () => {
    const onHoverLeave = vi.fn();
    render(<AnnotationToolbar {...defaultProps} onHoverLeave={onHoverLeave} />);
    fireEvent.mouseLeave(screen.getByTitle('Pen'));
    expect(onHoverLeave).toHaveBeenCalledOnce();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CanvasHistory } from '../lib/canvasHistory';

function makeMockCanvas(initialJson = '{"objects":[]}') {
  let currentJson = initialJson;
  return {
    toJSON: vi.fn(() => JSON.parse(currentJson)),
    loadFromJSON: vi.fn((json: any, cb: () => void) => {
      currentJson = JSON.stringify(json);
      cb();
    }),
    renderAll: vi.fn(),
    _currentJson: () => currentJson,
  };
}

describe('CanvasHistory', () => {
  let canvas: ReturnType<typeof makeMockCanvas>;
  let history: CanvasHistory;

  beforeEach(() => {
    canvas = makeMockCanvas();
    history = new CanvasHistory(canvas as any);
  });

  it('starts with no undo/redo available', () => {
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it('canUndo after 2 snapshots', () => {
    history.snapshot();
    history.snapshot();
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
  });

  it('undo restores previous snapshot', () => {
    canvas.toJSON.mockReturnValueOnce({ objects: ['a'] });
    history.snapshot();
    canvas.toJSON.mockReturnValueOnce({ objects: ['a', 'b'] });
    history.snapshot();

    const done = vi.fn();
    history.undo(done);

    expect(canvas.loadFromJSON).toHaveBeenCalledWith({ objects: ['a'] }, expect.any(Function));
    expect(done).toHaveBeenCalled();
    expect(history.canRedo()).toBe(true);
  });

  it('redo restores next snapshot after undo', () => {
    canvas.toJSON.mockReturnValueOnce({ objects: ['a'] });
    history.snapshot();
    canvas.toJSON.mockReturnValueOnce({ objects: ['a', 'b'] });
    history.snapshot();

    history.undo();
    history.redo();

    const calls = canvas.loadFromJSON.mock.calls;
    expect(calls[calls.length - 1][0]).toEqual({ objects: ['a', 'b'] });
  });

  it('snapshot after undo discards redo stack', () => {
    history.snapshot();
    history.snapshot();
    history.undo();
    history.snapshot();
    expect(history.canRedo()).toBe(false);
  });

  it('clear resets all history', () => {
    history.snapshot();
    history.snapshot();
    history.clear();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it('undo does nothing when at start of stack', () => {
    history.snapshot();
    history.undo();
    expect(canvas.loadFromJSON).not.toHaveBeenCalled();
  });
});

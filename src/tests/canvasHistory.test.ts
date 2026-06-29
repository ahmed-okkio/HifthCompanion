import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CanvasHistory } from '../lib/canvasHistory';

function makeMockCanvas(initialObjects: string[] = []) {
  let objects: string[] = [...initialObjects];
  let _renderOnAddRemove = true;
  return {
    toJSON: vi.fn(() => ({ objects: [...objects] })),
    getObjects: vi.fn(() => [...objects]),
    remove: vi.fn((o: string) => { objects = objects.filter(x => x !== o); }),
    add: vi.fn((o: string) => { objects.push(o); }),
    // Fabric 5's canvas.enlivenObjects — sync wrapper for tests
    enlivenObjects: vi.fn((objs: any[], cb: (enlivened: any[]) => void) => { cb([...objs]); }),
    renderAll: vi.fn(),
    getWidth: vi.fn(() => 800),
    getHeight: vi.fn(() => 600),
    get renderOnAddRemove() { return _renderOnAddRemove; },
    set renderOnAddRemove(v: boolean) { _renderOnAddRemove = v; },
    _objects: () => objects,
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

  it('undo removes current objects and enlivens snapshot objects', () => {
    canvas.add('a');
    history.snapshot();
    canvas.add('b');
    history.snapshot();

    const done = vi.fn();
    history.undo(done);

    // Should have removed current objects
    expect(canvas.remove).toHaveBeenCalled();
    // Should have enlivened the snapshot objects ['a']
    expect(canvas.enlivenObjects).toHaveBeenCalledWith(['a'], expect.any(Function));
    // renderOnAddRemove suppressed during swap
    expect(canvas.renderOnAddRemove).toBe(true); // restored after
    expect(canvas.renderAll).toHaveBeenCalled();
    expect(done).toHaveBeenCalled();
    expect(history.canRedo()).toBe(true);
  });

  it('redo restores next snapshot after undo', () => {
    canvas.add('a');
    history.snapshot();
    canvas.add('b');
    history.snapshot();

    history.undo();
    history.redo();

    // Last enlivenObjects call should be for ['a', 'b']
    const calls = canvas.enlivenObjects.mock.calls;
    expect(calls[calls.length - 1][0]).toEqual(['a', 'b']);
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
    expect(canvas.enlivenObjects).not.toHaveBeenCalled();
  });

  it('suppresses renderOnAddRemove during restore', () => {
    canvas.add('a');
    history.snapshot();
    canvas.add('b');
    history.snapshot();

    const flags: boolean[] = [];
    // Intercept the renderOnAddRemove setter to track values
    const desc = Object.getOwnPropertyDescriptor(canvas, 'renderOnAddRemove');
    let current = true;
    Object.defineProperty(canvas, 'renderOnAddRemove', {
      get: () => current,
      set: (v: boolean) => { current = v; flags.push(v); },
      configurable: true,
    });

    history.undo();

    // false during swap, true after
    expect(flags).toEqual([false, true]);
  });
});

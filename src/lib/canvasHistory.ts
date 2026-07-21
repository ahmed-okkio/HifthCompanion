import { fabric } from 'fabric';

/** Stamps a uuid on an object that has none and returns its id. Lazy by design: called only
 *  when a note is first bound, never on object:added — unnoted objects stay id-less. */
export function ensureObjectId(obj: fabric.Object): string {
  const o = obj as fabric.Object & { id?: string };
  return (o.id ??= crypto.randomUUID());
}

export class CanvasHistory {
  private stack: string[] = [];
  private ptr = -1;
  private canvas: fabric.Canvas;
  private frozen = false;

  constructor(canvas: fabric.Canvas) {
    this.canvas = canvas;
  }

  snapshot() {
    if (this.frozen) return;
    // 'id' is not a Fabric-native prop — without it here, undo/redo strips note bindings.
    const json = JSON.stringify(this.canvas.toJSON(['id'] as any));
    this.stack = this.stack.slice(0, this.ptr + 1);
    this.stack.push(json);
    this.ptr = this.stack.length - 1;
  }

  clear() {
    this.stack = [];
    this.ptr = -1;
  }

  undo(onDone?: () => void) {
    if (this.ptr <= 0) return;
    this.ptr--;
    this.restore(onDone);
  }

  redo(onDone?: () => void) {
    if (this.ptr >= this.stack.length - 1) return;
    this.ptr++;
    this.restore(onDone);
  }

  canUndo() { return this.ptr > 0; }
  canRedo() { return this.ptr < this.stack.length - 1; }

  /** True while an undo/redo is reloading the canvas. loadFromJSON re-adds the restored
   *  objects, firing fabric object:added/removed events; callers must ignore those so they
   *  don't register as new user actions (which would corrupt the snapshot stack AND the
   *  spread shell's cross-page undo ordering). */
  get restoring() { return this.frozen; }

  private restore(onDone?: () => void) {
    this.frozen = true;
    const snapshot = JSON.parse(this.stack[this.ptr]);
    // loadFromJSON internally calls clear() which nukes backgroundImage then restores it
    // from JSON — but Fabric 5's enlivenObjects is async, so between clear/add the canvas
    // paints an empty frame (the "undo flash"). Bypass it: swap objects manually with
    // renderOnAddRemove suppressed so the canvas never paints an intermediate state.
    this.canvas.renderOnAddRemove = false;
    const current = this.canvas.getObjects();
    current.forEach((o) => this.canvas.remove(o));
    // Fabric 5 Canvas has enlivenObjects on its prototype — use it so tests can mock via
    // the canvas instance rather than needing the full fabric namespace.
    const enliven: (objects: any[], cb: (enlivened: fabric.Object[]) => void) => void =
      (this.canvas as any).enlivenObjects?.bind(this.canvas) ?? fabric.util.enlivenObjects;
    enliven(snapshot.objects, (enlivened: fabric.Object[]) => {
      enlivened.forEach((o: fabric.Object) => this.canvas.add(o));
      this.canvas.renderOnAddRemove = true;
      this.canvas.renderAll();
      this.frozen = false;
      onDone?.();
    });
  }
}

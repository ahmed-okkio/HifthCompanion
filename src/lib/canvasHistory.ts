import { fabric } from 'fabric';

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
    const json = JSON.stringify(this.canvas.toJSON());
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

  private restore(onDone?: () => void) {
    this.frozen = true;
    const json = this.stack[this.ptr];
    this.canvas.loadFromJSON(JSON.parse(json), () => {
      this.canvas.renderAll();
      this.frozen = false;
      onDone?.();
    });
  }
}

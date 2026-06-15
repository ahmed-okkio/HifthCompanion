# Slice 6 — Shapes Tool (Circles & Underlines)

## Goal
Users can draw circles (ellipses) and underlines (horizontal lines) on a page. Both use the active colour from the toolbar.

---

## No new dependencies or DB changes
All shapes serialise into `canvas_json` via Fabric.js.

---

## Implementation

### Add tool types

Extend the `activeTool` state type in `AnnotationCanvas.tsx`:
```ts
const [activeTool, setActiveTool] = useState<'pen' | 'highlighter' | 'circle' | 'underline'>('pen');
```

### Circle tool

Uses the same mouse-event pattern as the highlighter, but draws a `fabric.Ellipse`:

```ts
function enableCircleMode(canvas: fabric.Canvas) {
  canvas.isDrawingMode = false;
  canvas.selection = false;

  let origin: { x: number; y: number } | null = null;
  let activeEllipse: fabric.Ellipse | null = null;

  canvas.on('mouse:down', (opt) => {
    const p = canvas.getPointer(opt.e);
    origin = { x: p.x, y: p.y };
    activeEllipse = new fabric.Ellipse({
      left: p.x,
      top: p.y,
      rx: 0,
      ry: 0,
      fill: 'transparent',
      stroke: activeColor,
      strokeWidth: 2,
      selectable: true,
    });
    canvas.add(activeEllipse);
  });

  canvas.on('mouse:move', (opt) => {
    if (!origin || !activeEllipse) return;
    const p = canvas.getPointer(opt.e);
    const rx = Math.abs(p.x - origin.x) / 2;
    const ry = Math.abs(p.y - origin.y) / 2;
    activeEllipse.set({
      left: Math.min(p.x, origin.x),
      top: Math.min(p.y, origin.y),
      rx,
      ry,
    });
    canvas.renderAll();
  });

  canvas.on('mouse:up', () => {
    origin = null;
    activeEllipse = null;
    scheduleSave();
  });
}
```

### Underline tool

Draws a `fabric.Line` constrained to horizontal:

```ts
function enableUnderlineMode(canvas: fabric.Canvas) {
  canvas.isDrawingMode = false;
  canvas.selection = false;

  let startX: number | null = null;
  let startY: number | null = null;
  let activeLine: fabric.Line | null = null;

  canvas.on('mouse:down', (opt) => {
    const p = canvas.getPointer(opt.e);
    startX = p.x;
    startY = p.y;
    activeLine = new fabric.Line([p.x, p.y, p.x, p.y], {
      stroke: activeColor,
      strokeWidth: 2,
      selectable: true,
    });
    canvas.add(activeLine);
  });

  canvas.on('mouse:move', (opt) => {
    if (startX === null || !activeLine) return;
    const p = canvas.getPointer(opt.e);
    // Lock to horizontal — keep Y fixed at startY
    activeLine.set({ x2: p.x, y2: startY! });
    canvas.renderAll();
  });

  canvas.on('mouse:up', () => {
    startX = null;
    startY = null;
    activeLine = null;
    scheduleSave();
  });
}
```

### Extend the tool switching effect

```tsx
useEffect(() => {
  const canvas = fabricRef.current;
  if (!canvas) return;

  // Always clean up listeners first
  canvas.off('mouse:down');
  canvas.off('mouse:move');
  canvas.off('mouse:up');
  canvas.isDrawingMode = false;
  canvas.selection = true;

  switch (activeTool) {
    case 'pen':
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = activeColor;
      canvas.freeDrawingBrush.width = 2;
      break;
    case 'highlighter':
      enableHighlighterMode(canvas);
      break;
    case 'circle':
      enableCircleMode(canvas);
      break;
    case 'underline':
      enableUnderlineMode(canvas);
      break;
  }
}, [activeTool, activeColor, highlightOpacity]);
```

> **Note:** Refactor the `off` cleanup into a single `disableCurrentTool()` helper to keep the effect clean. Each tool mode registers its own mouse:down/move/up listeners and they must be cleared before switching.

### Toolbar UI additions

```tsx
<button
  onClick={() => setActiveTool('circle')}
  className={`px-3 py-1 rounded text-sm ${activeTool === 'circle' ? 'bg-white text-black' : 'bg-stone-700 text-white'}`}
>
  ⭕ Circle
</button>
<button
  onClick={() => setActiveTool('underline')}
  className={`px-3 py-1 rounded text-sm ${activeTool === 'underline' ? 'bg-white text-black' : 'bg-stone-700 text-white'}`}
>
  _ Underline
</button>
```

---

## Done When
A user can switch to circle or underline mode, drag to draw the shape, and have it persist with the active colour. All shapes are selectable and moveable when no drawing tool is active.

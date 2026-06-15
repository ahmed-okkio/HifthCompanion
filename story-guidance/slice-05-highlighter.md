# Slice 5 — Highlighter Tool

## Goal
Users can drag to highlight rectangular regions on a page with a semi-transparent colour. Includes a colour picker with presets and opacity control.

---

## No new dependencies
Uses Fabric.js already installed in slice 4.

## No new DB changes
Highlights are stored as part of `canvas_json` in the existing `annotations` table.

---

## Implementation

### Toolbar state additions (in `AnnotationCanvas.tsx`)

Add to the component's state:
```ts
const [activeTool, setActiveTool] = useState<'pen' | 'highlighter'>('pen');
const [activeColor, setActiveColor] = useState('#ffff00');
const [highlightOpacity, setHighlightOpacity] = useState(0.35);
```

### Highlighter drawing mode

Fabric.js doesn't have a built-in rectangle-drag tool in drawing mode. Implement it with mouse events:

```tsx
// Add these refs inside AnnotationCanvas
const isDrawingHighlight = useRef(false);
const highlightOrigin = useRef<{ x: number; y: number } | null>(null);
const activeRect = useRef<fabric.Rect | null>(null);

function enableHighlighterMode(canvas: fabric.Canvas) {
  canvas.isDrawingMode = false;
  canvas.selection = false;

  canvas.on('mouse:down', (opt) => {
    const pointer = canvas.getPointer(opt.e);
    isDrawingHighlight.current = true;
    highlightOrigin.current = { x: pointer.x, y: pointer.y };

    const rect = new fabric.Rect({
      left: pointer.x,
      top: pointer.y,
      width: 0,
      height: 0,
      fill: activeColor,
      opacity: highlightOpacity,
      selectable: true,
      strokeWidth: 0,
    });
    canvas.add(rect);
    activeRect.current = rect;
  });

  canvas.on('mouse:move', (opt) => {
    if (!isDrawingHighlight.current || !highlightOrigin.current || !activeRect.current) return;
    const pointer = canvas.getPointer(opt.e);
    const origin = highlightOrigin.current;

    activeRect.current.set({
      left: Math.min(pointer.x, origin.x),
      top: Math.min(pointer.y, origin.y),
      width: Math.abs(pointer.x - origin.x),
      height: Math.abs(pointer.y - origin.y),
    });
    canvas.renderAll();
  });

  canvas.on('mouse:up', () => {
    isDrawingHighlight.current = false;
    highlightOrigin.current = null;
    if (activeRect.current) {
      canvas.setActiveObject(activeRect.current);
      activeRect.current = null;
      scheduleSave(); // trigger the existing debounced save
    }
  });
}

function disableHighlighterMode(canvas: fabric.Canvas) {
  canvas.off('mouse:down');
  canvas.off('mouse:move');
  canvas.off('mouse:up');
  canvas.selection = true;
}
```

### Tool switching effect

```tsx
useEffect(() => {
  const canvas = fabricRef.current;
  if (!canvas) return;

  if (activeTool === 'pen') {
    disableHighlighterMode(canvas);
    canvas.isDrawingMode = true;
    canvas.freeDrawingBrush.color = activeColor;
    canvas.freeDrawingBrush.width = 2;
  } else if (activeTool === 'highlighter') {
    canvas.isDrawingMode = false;
    enableHighlighterMode(canvas);
  }
}, [activeTool, activeColor, highlightOpacity]);
```

### Toolbar UI additions

Add these to the toolbar section in `AnnotationCanvas.tsx`:

```tsx
{/* Preset colour swatches */}
const PRESET_COLORS = ['#ffff00', '#90ee90', '#87ceeb', '#ffb6c1', '#ffa500'];

<div className="flex items-center gap-2">
  {PRESET_COLORS.map(color => (
    <button
      key={color}
      onClick={() => setActiveColor(color)}
      className="w-6 h-6 rounded-full border-2"
      style={{
        backgroundColor: color,
        borderColor: activeColor === color ? 'white' : 'transparent',
      }}
    />
  ))}
  {/* Custom colour picker */}
  <input
    type="color"
    value={activeColor}
    onChange={e => setActiveColor(e.target.value)}
    className="w-6 h-6 cursor-pointer rounded"
    title="Custom colour"
  />
</div>

{/* Tool toggle */}
<div className="flex gap-2">
  <button
    onClick={() => setActiveTool('pen')}
    className={`px-3 py-1 rounded text-sm ${activeTool === 'pen' ? 'bg-white text-black' : 'bg-stone-700 text-white'}`}
  >
    ✏️ Pen
  </button>
  <button
    onClick={() => setActiveTool('highlighter')}
    className={`px-3 py-1 rounded text-sm ${activeTool === 'highlighter' ? 'bg-white text-black' : 'bg-stone-700 text-white'}`}
  >
    🖍 Highlight
  </button>
</div>

{/* Opacity slider (shown only in highlighter mode) */}
{activeTool === 'highlighter' && (
  <div className="flex items-center gap-2 text-sm">
    <label>Opacity</label>
    <input
      type="range"
      min={0.1}
      max={0.8}
      step={0.05}
      value={highlightOpacity}
      onChange={e => setHighlightOpacity(parseFloat(e.target.value))}
      className="w-24"
    />
  </div>
)}
```

---

## Done When
A user can switch to the highlighter tool, drag to create a coloured semi-transparent rectangle over text, choose from preset colours or a custom picker, adjust opacity, and have the highlight persist on save/reload.

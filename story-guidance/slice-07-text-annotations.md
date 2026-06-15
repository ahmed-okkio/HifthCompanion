# Slice 7 — Text Annotations

## Goal
Users can click on the canvas to place an editable text label. Text is styled with the active colour and persists as part of `canvas_json`.

---

## No new dependencies or DB changes
`fabric.IText` handles inline editing natively.

---

## Implementation

### Add tool type

```ts
const [activeTool, setActiveTool] = useState<'pen' | 'highlighter' | 'circle' | 'underline' | 'text'>('pen');
```

### Text tool mode

```ts
function enableTextMode(canvas: fabric.Canvas) {
  canvas.isDrawingMode = false;
  canvas.selection = false;

  canvas.on('mouse:down', (opt) => {
    // Don't create a new text box if user clicked an existing object
    if (opt.target) return;

    const p = canvas.getPointer(opt.e);

    const text = new fabric.IText('Type here', {
      left: p.x,
      top: p.y,
      fontSize: 16,
      fill: activeColor,
      fontFamily: 'Arial',
      selectable: true,
      editable: true,
    });

    canvas.add(text);
    canvas.setActiveObject(text);

    // Enter edit mode immediately so the user can start typing
    text.enterEditing();
    text.selectAll();

    // Save when the user finishes editing
    text.on('editing:exited', () => scheduleSave());

    canvas.renderAll();
  });
}
```

### Add to tool switching effect

```tsx
case 'text':
  enableTextMode(canvas);
  break;
```

### Font size control

Add a font size picker to the toolbar (shown when text tool is active):

```tsx
const [fontSize, setFontSize] = useState(16);

// In toolbar JSX:
{activeTool === 'text' && (
  <div className="flex items-center gap-2 text-sm">
    <label>Size</label>
    <select
      value={fontSize}
      onChange={e => setFontSize(parseInt(e.target.value))}
      className="text-black rounded px-2 py-1"
    >
      {[12, 14, 16, 18, 24, 32].map(s => (
        <option key={s} value={s}>{s}px</option>
      ))}
    </select>
  </div>
)}
```

Update `enableTextMode` to use `fontSize` from state — pass it as a parameter or read from a ref:

```ts
// Use a ref so the mouse:down handler always reads the latest value
const fontSizeRef = useRef(fontSize);
useEffect(() => { fontSizeRef.current = fontSize; }, [fontSize]);

// In enableTextMode, replace hardcoded 16:
fontSize: fontSizeRef.current,
```

### Toolbar button

```tsx
<button
  onClick={() => setActiveTool('text')}
  className={`px-3 py-1 rounded text-sm ${activeTool === 'text' ? 'bg-white text-black' : 'bg-stone-700 text-white'}`}
>
  T Text
</button>
```

---

## Fabric IText serialisation note
`fabric.IText` serialises fully into `canvas_json` including text content, position, colour, and font size. No special handling needed — `loadFromJSON` restores it correctly.

After restoring from JSON, `IText` objects are still editable (double-click to edit). This is the expected behaviour.

---

## Done When
A user can switch to text mode, click anywhere on the page, type a label, click elsewhere to confirm, and have the text persist correctly on reload. Font size and colour are respected.

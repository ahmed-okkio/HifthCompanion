# Slice 10 — Toolbar UX Polish

## Goal
The toolbar is intuitive and non-intrusive. Includes undo/redo, eraser, clear page, collapsible toolbar, and active tool highlighting. Toolbar collapsed state persists in localStorage.

---

## No new DB changes or dependencies
All features use Fabric.js built-ins.

---

## Implementation

### Undo / Redo

Fabric.js v5 doesn't include a native history manager. Implement a simple JSON snapshot stack:

```ts
const historyRef = useRef<string[]>([]); // stack of JSON snapshots
const historyIndexRef = useRef<number>(-1);

function pushHistory(canvas: fabric.Canvas) {
  const json = JSON.stringify(canvas.toJSON(['id']));
  // Discard redo states ahead of current index
  historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
  historyRef.current.push(json);
  historyIndexRef.current = historyRef.current.length - 1;
}

function undo(canvas: fabric.Canvas) {
  if (historyIndexRef.current <= 0) return;
  historyIndexRef.current -= 1;
  const snapshot = historyRef.current[historyIndexRef.current];
  canvas.loadFromJSON(JSON.parse(snapshot), () => canvas.renderAll());
}

function redo(canvas: fabric.Canvas) {
  if (historyIndexRef.current >= historyRef.current.length - 1) return;
  historyIndexRef.current += 1;
  const snapshot = historyRef.current[historyIndexRef.current];
  canvas.loadFromJSON(JSON.parse(snapshot), () => canvas.renderAll());
}
```

Call `pushHistory(canvas)` inside the existing `scheduleSave` — before the debounce fires is fine, or on every `path:created` / `object:modified` / `object:removed` event (same events already used for save).

```ts
canvas.on('path:created', () => { pushHistory(canvas); scheduleSave(); });
canvas.on('object:modified', () => { pushHistory(canvas); scheduleSave(); });
canvas.on('object:removed', () => { pushHistory(canvas); scheduleSave(); });
```

Also seed history on initial load:
```ts
// After loadFromJSON completes:
pushHistory(canvas);
```

### Keyboard shortcuts

Add a `useEffect` with a `keydown` listener:
```ts
useEffect(() => {
  function handleKey(e: KeyboardEvent) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      undo(canvas);
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
      e.preventDefault();
      redo(canvas);
    }
  }
  window.addEventListener('keydown', handleKey);
  return () => window.removeEventListener('keydown', handleKey);
}, []);
```

### Eraser tool

Fabric.js v5 has `EraserBrush` as an experimental feature. Use a simpler approach: switch to selection mode and delete the selected object on click.

```ts
function enableEraserMode(canvas: fabric.Canvas) {
  canvas.isDrawingMode = false;
  canvas.selection = true;

  canvas.on('mouse:down', (opt) => {
    if (opt.target) {
      canvas.remove(opt.target);
      canvas.discardActiveObject();
      canvas.renderAll();
      pushHistory(canvas);
      scheduleSave();
    }
  });
}
```

Add to tool switch:
```ts
case 'eraser':
  enableEraserMode(canvas);
  break;
```

### Clear page button

```tsx
async function clearPage() {
  const canvas = fabricRef.current;
  if (!canvas) return;
  if (!confirm('Clear all annotations on this page?')) return;

  canvas.getObjects().forEach(obj => canvas.remove(obj));
  canvas.renderAll();
  pushHistory(canvas);
  scheduleSave();
}

// In toolbar:
<button onClick={clearPage} className="px-3 py-1 rounded text-sm bg-red-800 text-white">
  🗑 Clear
</button>
```

### Collapsible toolbar

Add state and persist to localStorage:

```ts
const [toolbarOpen, setToolbarOpen] = useState<boolean>(() => {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('toolbar-open') !== 'false';
});

function toggleToolbar() {
  setToolbarOpen(prev => {
    const next = !prev;
    localStorage.setItem('toolbar-open', String(next));
    return next;
  });
}
```

Wrap toolbar content:
```tsx
<div className="relative">
  <button
    onClick={toggleToolbar}
    className="absolute -top-1 -right-1 z-10 bg-stone-700 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center"
    title={toolbarOpen ? 'Collapse toolbar' : 'Expand toolbar'}
  >
    {toolbarOpen ? '−' : '+'}
  </button>

  {toolbarOpen && (
    <div className="flex flex-wrap items-center gap-2 mb-2 text-white text-sm bg-stone-800 p-2 rounded">
      {/* All toolbar buttons here */}
    </div>
  )}
</div>
```

### Undo/Redo buttons

```tsx
<button
  onClick={() => fabricRef.current && undo(fabricRef.current)}
  disabled={historyIndexRef.current <= 0}
  className="px-3 py-1 rounded text-sm bg-stone-700 text-white disabled:opacity-40"
  title="Undo (Ctrl+Z)"
>
  ↩ Undo
</button>
<button
  onClick={() => fabricRef.current && redo(fabricRef.current)}
  disabled={historyIndexRef.current >= historyRef.current.length - 1}
  className="px-3 py-1 rounded text-sm bg-stone-700 text-white disabled:opacity-40"
  title="Redo (Ctrl+Y)"
>
  ↪ Redo
</button>
```

### Active tool visual state helper

Replace repeated ternary classNames with a helper:
```ts
function toolClass(tool: string) {
  return `px-3 py-1 rounded text-sm ${activeTool === tool ? 'bg-white text-black' : 'bg-stone-700 text-white'}`;
}
```

---

## Done When
A user can undo strokes with Ctrl+Z, redo with Ctrl+Y, click-erase individual objects, clear the whole page with confirmation, and collapse/expand the toolbar. Collapsed state survives a page reload.

// Pure logic for the Marked-pages / Needs-Focus feature (PRD 0009). No I/O, no Fabric.

export type MarkedPage = { page: number; count: number };

// D8/L2: badge color band by mark count. count=0 never appears (empty pages aren't rows).
export function badgeLevel(count: number): 'grey' | 'orange' | 'red' {
  if (count >= 6) return 'red';
  if (count >= 3) return 'orange';
  return 'grey';
}

// A degenerate mark: a zero-size shape left by a shape-tool click without a drag
// (0×0 rect/ellipse) or a single-point freehand tap. Invisible on the page but it
// still serializes as an object, so it inflates the mark count. Strip on save.
type FabObj = { width?: number; height?: number; scaleX?: number; scaleY?: number; path?: unknown[] };
type StyledObj = FabObj & { left?: number; top?: number; type?: string; stroke?: string; fill?: string };
export function isDegenerate(o: FabObj): boolean {
  // Freehand path: judged by point count only (its width/height may be absent in JSON).
  if (Array.isArray(o.path)) return o.path.length <= 1;
  const w = (o.width ?? 0) * (o.scaleX ?? 1);
  const h = (o.height ?? 0) * (o.scaleY ?? 1);
  return w < 1 && h < 1;
}

// Drop degenerate objects from a serialized objects array (returns a new array).
export function pruneDegenerate<T extends FabObj>(objects: T[]): T[] {
  return objects.filter(o => !isDegenerate(o));
}

// Number of Fabric objects in a raw canvas_json (L1). One object = one mark.
export function objectCount(canvasJson: { objects?: unknown[] } | null | undefined): number {
  return canvasJson?.objects?.length ?? 0;
}

// Axis-aligned bounding box of a serialized Fabric object (rotation/strokeWidth ignored —
// close enough for proximity grouping).
function bbox(o: FabObj & { left?: number; top?: number }) {
  const l = o.left ?? 0, t = o.top ?? 0;
  return { x1: l, y1: t, x2: l + (o.width ?? 0) * (o.scaleX ?? 1), y2: t + (o.height ?? 0) * (o.scaleY ?? 1) };
}

// One drawn mark is often several strokes (you can't extend a line in <400ms, so time
// won't group them — proximity does). Count clusters: objects that are the same tool AND
// colour AND whose bounding boxes are within `gap` px on both axes collapse to a single
// mark. Different tool or colour never merge even when overlapping (they're distinct marks).
export function clusterCount(objects: StyledObj[], gap = 20): number {
  const n = objects.length;
  if (n === 0) return 0;
  const b = objects.map(bbox);
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const sameStyle = (i: number, j: number) =>
    objects[i].type === objects[j].type &&
    objects[i].stroke === objects[j].stroke &&
    objects[i].fill === objects[j].fill;
  const near = (i: number, j: number) =>
    b[i].x1 - gap <= b[j].x2 && b[j].x1 - gap <= b[i].x2 &&
    b[i].y1 - gap <= b[j].y2 && b[j].y1 - gap <= b[i].y2;
  // ponytail: O(n²) pairwise — n = strokes on one page, always small.
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (sameStyle(i, j) && near(i, j)) parent[find(i)] = find(j);
  return new Set(parent.map((_, i) => find(i))).size;
}

export function maxCount(rows: MarkedPage[]): number {
  return rows.reduce((m, r) => (r.count > m ? r.count : m), 0);
}

// L3: Needs Focus tags every page tied at the set max; empty set (max 0) tags nothing.
export function isNeedsFocus(count: number, max: number): boolean {
  return count === max && max > 0;
}

// L4: count desc, then page asc. Returns a new array; input untouched.
export function sortMarked(rows: MarkedPage[]): MarkedPage[] {
  return [...rows].sort((a, b) => b.count - a.count || a.page - b.page);
}

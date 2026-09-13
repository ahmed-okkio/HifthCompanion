// Pure logic for the Marked-pages / Needs-Focus feature (PRD 0009). No I/O, no Fabric.
import { getSurahForPage } from '@/lib/quran';

/** Clustered mark count per mark colour, e.g. `{ '#ef4444': 4, '#f59e0b': 2 }`. */
export type MarkColors = Record<string, number>;

export type MarkedPage = { page: number; count: number; colors?: MarkColors };

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
// Returns one representative object index per cluster. Both clusterCount and
// clusterColors read it, so a page's per-colour counts always sum to its total.
function clusterRoots(objects: StyledObj[], gap: number): number[] {
  const n = objects.length;
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
  return [...new Set(parent.map((_, i) => find(i)))];
}

export function clusterCount(objects: StyledObj[], gap = 20): number {
  return objects.length === 0 ? 0 : clusterRoots(objects, gap).length;
}

// The highlighter applies its opacity by storing rgba(); every other tool stores the
// picker's hex. Normalising to hex means one colour counts as one colour whichever tool
// drew it — the alpha is a tool property, not a different colour.
function toHex(color: string): string {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color);
  if (!m) return color.toLowerCase();
  return `#${[m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('')}`;
}

// A mark's colour. Shape and freehand tools set `stroke` (their fill is 'transparent');
// the text tool sets only `fill`. Objects with neither are ignored.
export function markColor(o: StyledObj): string | null {
  const c = o.stroke && o.stroke !== 'transparent' ? o.stroke : o.fill;
  return c && c !== 'transparent' ? toHex(c) : null;
}

// Clustered mark count per colour. Clusters never merge across colours (see sameStyle),
// so every cluster has exactly one, and these counts sum to clusterCount().
export function clusterColors(objects: StyledObj[], gap = 20): MarkColors {
  const out: MarkColors = {};
  if (objects.length === 0) return out;
  for (const root of clusterRoots(objects, gap)) {
    const c = markColor(objects[root]);
    if (c) out[c] = (out[c] ?? 0) + 1;
  }
  return out;
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

export type SurahGroup = {
  surah: number;
  /** The surah's marked pages, mushaf order. */
  pages: MarkedPage[];
  /** Marks across the whole group — what the collapsed card reports. */
  count: number;
  /** Holds a page tied at the set max, so a collapsed card still shows the L3 signal. */
  hasFocus: boolean;
};

// Group rows under the surah each page belongs to, mushaf order in and out. This is the
// alternative to sortMarked's count-desc order: you can group OR rank, not both, so the
// panel offers the two as a sort choice. `max` is taken over the full input, keeping
// hasFocus in agreement with the flat list's Needs Focus pill.
export function groupBySurah(rows: MarkedPage[]): SurahGroup[] {
  const max = maxCount(rows);
  const by = new Map<number, MarkedPage[]>();
  for (const r of rows) {
    const surah = getSurahForPage(r.page);
    const pages = by.get(surah);
    if (pages) pages.push(r);
    else by.set(surah, [r]);
  }
  return [...by.entries()]
    .map(([surah, pages]) => {
      pages.sort((a, b) => a.page - b.page);
      return {
        surah,
        pages,
        count: pages.reduce((n, p) => n + p.count, 0),
        hasFocus: pages.some(p => isNeedsFocus(p.count, max)),
      };
    })
    .sort((a, b) => a.surah - b.surah);
}

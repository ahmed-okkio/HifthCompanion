// Pure logic for the Marked-pages / Needs-Focus feature (PRD 0009). No I/O, no Fabric.

export type MarkedPage = { page: number; count: number };

// D8/L2: badge color band by mark count. count=0 never appears (empty pages aren't rows).
export function badgeLevel(count: number): 'grey' | 'orange' | 'red' {
  if (count >= 6) return 'red';
  if (count >= 3) return 'orange';
  return 'grey';
}

// Number of Fabric objects in a raw canvas_json (L1). One object = one mark.
export function objectCount(canvasJson: { objects?: unknown[] } | null | undefined): number {
  return canvasJson?.objects?.length ?? 0;
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

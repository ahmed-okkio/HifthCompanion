import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The page-flip flush (useGoToPage awaits __hifthFlushReaderCanvas before router.push).
 *
 * saveNow used to write unconditionally, so leaving any page that HAD annotations paid a
 * store.save + reconcileNoteBindings round-trip before navigation even started — even when
 * the user only looked at it. A blank page never stalled because saveCanvas's empty-payload
 * guard bailed first, which is exactly the asymmetry that surfaced the bug.
 *
 * This models the dirty-flag state machine those two functions now share. It must skip the
 * pointless write WITHOUT ever dropping a real one — the paths that nearly broke are the
 * 120ms snapshot throttle and undo/redo, neither of which reaches commit()'s tail.
 */
function makeCanvas() {
  let dirty = false;
  let timer: number | null = null;
  const writes: string[] = [];
  let now = 0;
  let lastSnapshotAt = -Infinity;
  let restoring = false;

  return {
    writes,
    advance: (ms: number) => { now += ms; },
    setRestoring: (v: boolean) => { restoring = v; },
    /** useAnnotationCanvas's commit(): every canvas mutation routes through here. */
    commit(force = false) {
      dirty = true;                                   // above both early-outs
      if (restoring) return;
      if (!force && now - lastSnapshotAt < 120) return;
      lastSnapshotAt = now;
    },
    /** scheduleSave(): the 1.5s debounce. */
    scheduleSave() { timer = 1; },
    /** saveNow(): what the page-flip flush calls on every mounted canvas. */
    flush(label: string) {
      if (!dirty && timer === null) return;
      timer = null;
      dirty = false;
      writes.push(label);
    },
  };
}

describe('page-flip flush', () => {
  let c: ReturnType<typeof makeCanvas>;
  beforeEach(() => { c = makeCanvas(); });

  it('skips the write when the page was only looked at', () => {
    c.flush('idle');
    expect(c.writes).toEqual([]);
  });

  it('still writes a single stroke (path:created commits, then flushes)', () => {
    c.commit();
    c.flush('stroke');
    expect(c.writes).toEqual(['stroke']);
  });

  it('does not drop a second stroke inside the 120ms snapshot throttle', () => {
    c.commit();
    c.flush('first');
    c.advance(30);
    c.commit();          // throttled: returns before snapshotting, but the canvas DID change
    c.flush('second');
    expect(c.writes).toEqual(['first', 'second']);
  });

  it('does not drop an undo (commit bails on `restoring`; scheduleSave is the signal)', () => {
    c.commit();
    c.flush('stroke');
    c.setRestoring(true);
    c.commit();          // restoring: returns early
    c.scheduleSave();    // handleUndo schedules directly
    c.flush('undo');
    expect(c.writes).toEqual(['stroke', 'undo']);
  });

  it('does not re-write an already-saved page on the next flip', () => {
    c.commit();
    c.flush('stroke');
    c.flush('flip-away');
    c.flush('flip-back');
    expect(c.writes).toEqual(['stroke']);
  });
});

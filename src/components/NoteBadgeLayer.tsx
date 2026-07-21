'use client';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { fabric } from 'fabric';
import type { Note } from '@/types';
import { useI18n } from '@/components/I18nProvider';

export interface BadgeSpec {
  objectId: string;
  /** 1-based number shown on the badge. */
  index: number;
  /** How many non-deleted notes are bound to this object. */
  count: number;
}

/**
 * Numbering is by the first note bound to each object (created_at, id as tiebreak), so the
 * same page renders the same numbers across reloads (C3). Pure — exported for the unit test.
 */
export function computeBadges(notes: Note[]): BadgeSpec[] {
  const first = new Map<string, Note>();
  const count = new Map<string, number>();
  for (const n of notes) {
    const id = n.fabric_object_id;
    if (!id || n.deleted_at) continue;
    count.set(id, (count.get(id) ?? 0) + 1);
    const cur = first.get(id);
    if (!cur || n.created_at < cur.created_at || (n.created_at === cur.created_at && n.id < cur.id)) first.set(id, n);
  }
  return [...first.values()]
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1))
    .map((n, i) => ({ objectId: n.fabric_object_id!, index: i + 1, count: count.get(n.fabric_object_id!)! }));
}

interface Props {
  fabricRef: React.RefObject<fabric.Canvas | null>;
  setId: string;
  pageNum: number;
  canvasReady: boolean;
  /** Share/read-only views pass notes directly; the reader gets them off the panel's event bus. */
  notes?: Note[];
}

/**
 * DOM-only overlay (C5): a badge is never a Fabric object, so nothing here can reach
 * canvas.toJSON(), the eraser, or selection (C7). Positions come from getBoundingRect(),
 * which is already in canvas display pixels — the CSS zoom/pan transform lives on an
 * ancestor, so the overlay rides along with it for free.
 */
export default function NoteBadgeLayer({ fabricRef, setId, pageNum, canvasReady, notes: notesProp }: Props) {
  const { t, fmtNum } = useI18n();
  const [notes, setNotes] = useState<Note[]>(notesProp ?? []);
  const [placed, setPlaced] = useState<(BadgeSpec & { left: number; top: number })[]>([]);
  const [flashing, setFlashing] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // Viewport rect of the open badge — the popover is portalled to <body> and positioned off this
  // so no ancestor's overflow clip can cut it off.
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  useEffect(() => { if (notesProp) setNotes(notesProp); }, [notesProp]);

  useEffect(() => {
    if (notesProp) return;
    const onNotes = (e: Event) => {
      const d = (e as CustomEvent).detail as { setId: string; pageNum: number; notes: Note[] };
      if (d.setId !== setId || d.pageNum !== pageNum) return;
      setNotes(d.notes);
    };
    window.addEventListener('hifth:notes', onNotes);
    return () => window.removeEventListener('hifth:notes', onNotes);
  }, [setId, pageNum, notesProp]);

  // Panel → badge (D5). setId + pageNum keep a spread's two overlays from both flashing.
  useEffect(() => {
    const onFlash = (e: Event) => {
      const d = (e as CustomEvent).detail as { setId: string; pageNum: number; fabricObjectId: string };
      if (d.setId !== setId || d.pageNum !== pageNum) return;
      setFlashing(d.fabricObjectId);
    };
    window.addEventListener('hifth:note-flash', onFlash);
    return () => window.removeEventListener('hifth:note-flash', onFlash);
  }, [setId, pageNum]);

  useEffect(() => {
    if (!flashing) return;
    const timer = setTimeout(() => setFlashing(null), 1200);
    return () => clearTimeout(timer);
  }, [flashing]);

  const reposition = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) { setPlaced([]); return; }
    const byId = new Map<string, fabric.Object>();
    for (const o of canvas.getObjects()) {
      const id = (o as fabric.Object & { id?: string }).id;
      if (id) byId.set(id, o);
    }
    const W = canvas.getWidth(), H = canvas.getHeight();
    const SZ = 16; // ~badge size, kept fully inside the canvas box so edge badges aren't clipped
    setPlaced(computeBadges(notes).flatMap(b => {
      const obj = byId.get(b.objectId);
      if (!obj) return [];
      const r = obj.getBoundingRect();
      // Anchored to the object's bottom-right corner, then clamped inside the canvas.
      const left = Math.max(2, Math.min(r.left + r.width - 7, W - SZ));
      const top = Math.max(2, Math.min(r.top + r.height - 7, H - SZ));
      return [{ ...b, left, top }];
    }));
  }, [fabricRef, notes]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !canvasReady) return;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; reposition(); });
    };
    schedule();
    // after:render covers zoom, pan, load and every viewport change; object:modified fires
    // for a drag that ends without a re-render.
    canvas.on('after:render', schedule);
    canvas.on('object:modified', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      canvas.off('after:render', schedule);
      canvas.off('object:modified', schedule);
    };
  }, [fabricRef, canvasReady, reposition]);

  if (!placed.length) return null;

  const open = openId ? placed.find(b => b.objectId === openId) : undefined;
  const openNotes = open
    ? notes
        .filter(n => n.fabric_object_id === open.objectId && !n.deleted_at)
        .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    : [];

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
      {placed.map(b => (
        <button
          key={b.objectId}
          type="button"
          data-note-badge={b.objectId}
          className={flashing === b.objectId ? 'animate-note-flash' : undefined}
          aria-label={t(b.count > 1 ? 'notes.badgeMulti' : 'notes.badge', { index: b.index, count: b.count })}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            setOpenId(prev => (prev === b.objectId ? null : b.objectId));
            setAnchor(rect);
          }}
          style={{
            position: 'absolute',
            left: b.left,
            top: b.top,
            minWidth: 14,
            height: 14,
            padding: '0 3px',
            borderRadius: 999,
            border: '1px solid var(--border-subtle)',
            background: openId === b.objectId ? 'var(--accent, #16a34a)' : 'var(--surface-main)',
            color: openId === b.objectId ? '#fff' : 'var(--text-primary)',
            boxShadow: 'var(--shadow-e1)',
            fontSize: '9px',
            fontWeight: 600,
            lineHeight: '12px',
            pointerEvents: 'auto',
            cursor: 'pointer',
          }}
        >
          {fmtNum(b.index)}{b.count > 1 ? `·${fmtNum(b.count)}` : ''}
        </button>
      ))}
      {/* Popover: portalled to <body> so no ancestor overflow clip can cut it off. Positioned in
          viewport coords off the badge's on-screen rect, flipped/clamped to stay on screen. */}
      {open && anchor && typeof document !== 'undefined' && createPortal(
        (() => {
          const PW = 220, PH = 260, GAP = 8;
          const vw = window.innerWidth, vh = window.innerHeight;
          // Prefer left of the badge; flip right if it won't fit.
          let left = anchor.left - PW - GAP;
          if (left < 8) left = anchor.right + GAP;
          left = Math.max(8, Math.min(left, vw - PW - 8));
          // Below the badge; flip above near the bottom edge.
          let top = anchor.bottom + 6;
          if (top + PH > vh) top = anchor.top - PH - 6;
          top = Math.max(8, Math.min(top, vh - PH - 8));
          return (
            <>
              {/* Backdrop catches an outside click to close. */}
              <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} onClick={() => setOpenId(null)} />
              <div
                role="dialog"
                style={{
                  position: 'fixed', left, top, width: PW, maxHeight: PH, overflowY: 'auto', zIndex: 61,
                  background: 'var(--surface-main)', border: '1px solid var(--border-subtle)',
                  borderRadius: 8, boxShadow: 'var(--shadow-e2)', padding: '8px 10px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}
              >
                {openNotes.map(n => (
                  <div key={n.id} dir="auto" style={{ fontSize: '12px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {n.body}
                  </div>
                ))}
              </div>
            </>
          );
        })(),
        document.body
      )}
    </div>
  );
}

'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Mobile: a compact trigger button (portaled into ReaderShell's #mobile-panel-buttons row)
 * that opens `children` in a bottom sheet. Desktop (lg): the sheet box is `display:contents`,
 * so `children` render inline as before. Children mount once either way, keeping their state.
 */
export default function MobileSheet({ testid, icon, label, children }: {
  testid: string;
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the slot is ReaderShell's DOM node; it only exists after commit
    setSlot(document.getElementById('mobile-panel-buttons'));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {slot && createPortal(
        <button
          type="button"
          data-testid={`${testid}-button`}
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="btn btn-outline btn-sm min-w-0"
        >
          <span aria-hidden className="shrink-0 text-green-600">{icon}</span>
          <span className="truncate">{label}</span>
        </button>,
        slot,
      )}
      {open && (
        <div onClick={() => setOpen(false)} aria-hidden className="lg:hidden fixed inset-0 z-(--z-sticky) bg-overlay" />
      )}
      <div
        data-testid={`${testid}-sheet`}
        className={`fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto p-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] bg-surface-main rounded-t-xl shadow-e3 transition-[translate,visibility] duration-300 ease-sheet ${open ? 'translate-y-0' : 'translate-y-full invisible'} lg:contents lg:visible`}
      >
        <div className="lg:hidden flex justify-center pb-2">
          <div className="w-9 h-1 rounded-full bg-neutral-300" />
        </div>
        {children}
      </div>
    </>
  );
}

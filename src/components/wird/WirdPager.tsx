'use client';

/**
 * WirdPager — the /wird surface. Renders every state (H3/I1–I3):
 *   - empty: no wirds → what-to-do-next, no redirect (H3).
 *   - all-done: every wird done today → the strip is replaced by a screen that
 *     states completion and names where each next portion begins (I3).
 *   - strip: the cards as a horizontal CSS snap strip (H4) — scroll-snap-type:
 *     x mandatory + overflow-x, no gesture library and no pointer/touch
 *     handlers. An IntersectionObserver tracks the active card for the index:
 *     dots at ≤5 (completed marked distinctly), a "4 / 9" count at ≥6 (H5).
 *     At ≥lg the card caps at 520px, is centred, and ‹ › buttons + arrow keys
 *     move between cards through one handler (H6).
 *
 * Card order is whatever the service returns — outstanding first, then
 * done-today (H5a) — and is never re-sorted here.
 *
 * Motion is M6; this milestone only builds the states as plain renders.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';
import { Sk } from '@/components/Skeleton';
import WirdCard from './WirdCard';
import WirdForm from './WirdForm';
import ReminderSheet, { reminderSheetStart, type ReminderSheetStart } from './ReminderSheet';

export interface WirdCardData {
  id: string;
  name: string;
  scope: { memorized: true } | { memorized: false; range: string };
  opening: string;
  closing: string;
  portionRange: string;
  portionSinglePage: boolean;
  pct: number;
  pagesToGo: number;
  doneToday: boolean;
  daysSinceLastDone: number | null;
  nextRef: string;
}

const DOTS_MAX = 5;

export default function WirdPager({ cards, memorizedPages }: { cards: WirdCardData[]; memorizedPages: number[] }) {
  const { t } = useI18n();
  const router = useRouter();
  // The create form opens from the top-bar "New" action via ?new=1, so no
  // floating button sits over the card — the Done disc is the one control.
  // The create form opens as a client-side modal — no navigation, so the /wird
  // server component isn't refetched just to show the pop-up. ?new=1 is still
  // honoured for deep links (e.g. an external "New" link).
  const params = useSearchParams();
  const [newOpen, setNewOpen] = useState(false);
  // Bridges the optimistic gap: the dialog hides the instant Create is tapped,
  // and the new card only lands after the server write + refresh. This shows a
  // loading placeholder in between so the tap has immediate feedback.
  const [creating, setCreating] = useState(false);
  const openNew = () => setNewOpen(true);
  // The daily reminder is offered once, after the FIRST wird is created (0016).
  const [reminder, setReminder] = useState<ReminderSheetStart | null>(null);
  const closeReminder = useCallback(() => setReminder(null), []);
  const formOpen = newOpen || params.get('new') === '1';
  const closeForm = () => {
    setNewOpen(false);
    if (params.get('new') === '1') router.replace('/wird');
  };

  // Cards completed this session leave the strip optimistically and never return
  // (a refresh would otherwise re-render them as done-today and snap them back).
  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());
  const outstanding = cards.filter((c) => !c.doneToday && !doneIds.has(c.id));

  let content: React.ReactNode;
  if (cards.length === 0) {
    content = <StatePanel title={t('wird.emptyTitle')} hint={t('wird.emptyHint')} showCreate onNew={openNew} />;
  } else if (outstanding.length === 0) {
    // J7: arrives from the inline-end, the direction a next card would come from.
    content = (
      <StatePanel title={t('wird.allDoneTitle')} hint={t('wird.allDoneHint')} enter showOptions onNew={openNew}>
        {/* nextRef is where the NEXT portion begins, resolved server-side before
            Done is tapped, so it's right immediately — no wait on the refresh. */}
        <ul className="list-none m-0 p-0 flex flex-col gap-2 w-full">
          {cards.map((c) => (
            <li key={c.id} className="text-small font-semibold text-secondary text-center">
              {t('wird.nextBegins', { name: c.name, ref: c.nextRef })}
            </li>
          ))}
        </ul>
      </StatePanel>
    );
  } else {
    content = (
      <Strip
        cards={outstanding}
        t={t}
        onNew={openNew}
        onDoneCard={(id) => setDoneIds((s) => new Set(s).add(id))}
      />
    );
  }

  return (
    <>
      {content}
      {creating && <CreatingOverlay t={t} />}
      {reminder && <ReminderSheet start={reminder} onClose={closeReminder} />}
      {/* Create + Manage live in the top bar (see WirdHeaderActions). No floating
          button sits over the card, so the Done disc is the one control (H10). */}
      {/* Mounted only while open, so each New starts fresh: the form's
          optimistic `pending` hide would otherwise outlive a create and keep
          every later open invisible. */}
      {formOpen && <WirdForm
        open
        onClose={closeForm}
        onSubmitStart={() => setCreating(true)}
        onFailed={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          closeForm();
          router.refresh();
          if (cards.length === 0) void reminderSheetStart().then(setReminder);
        }}
        canUseMemorized={memorizedPages.length > 0}
        memorizedPages={memorizedPages}
      />}
    </>
  );
}

// ---------------------------------------------------------------------------

function Strip({
  cards,
  t,
  onNew,
  onDoneCard,
}: {
  cards: WirdCardData[];
  t: ReturnType<typeof useI18n>['t'];
  onNew: () => void;
  onDoneCard: (id: string) => void;
}) {
  const router = useRouter();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  // J2–J6: which card is travelling out. The pager adds `is-leaving` (CSS
  // slides the card + closes the flex gap), then refreshes once travel ends —
  // the duration is READ FROM CSS, never a hardcoded constant (J6).
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // J10: never leave a timer running past unmount / a re-render.
  useEffect(() => () => { if (exitTimer.current) clearTimeout(exitTimer.current); }, []);

  const onExit = useCallback((id: string) => {
    setLeavingId(id);
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--duration-exit').trim(); // e.g. "320ms" or "0.32s"
    const ms = raw.endsWith('ms') ? parseFloat(raw) : parseFloat(raw) * 1000;
    if (exitTimer.current) clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(() => {
      // Card is gone for good (removed from the pager's outstanding set); the
      // next card snaps in, or the all-done panel takes over (I3/J7). Refresh in
      // the background to sync the advanced position — it can't snap the card
      // back because the pager filters it out.
      onDoneCard(id);
      setLeavingId(null);
      router.refresh();
    }, (Number.isFinite(ms) ? ms : 320) + 20); // small buffer past travel end
  }, [router, onDoneCard]);

  // H5: track the most-visible card. IntersectionObserver only — no scroll,
  // pointer or touch handlers.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            const i = itemRefs.current.indexOf(e.target as HTMLDivElement);
            if (i >= 0) setActive(i);
          }
        }
      },
      { root, threshold: [0.6] },
    );
    itemRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [cards.length]);

  // The one handler behind both the ‹ › buttons and the arrow keys (H6).
  function goTo(i: number) {
    const next = Math.max(0, Math.min(cards.length - 1, i));
    const root = scrollerRef.current;
    const el = itemRefs.current[next];
    if (!root || !el) return;
    // Rect delta, not offsetLeft: offsetLeft is from the offset parent (the page),
    // not the strip, so it overshot by the strip's own left edge.
    const delta = el.getBoundingClientRect().left - root.getBoundingClientRect().left;
    root.scrollTo({ left: root.scrollLeft + delta - (root.clientWidth - el.clientWidth) / 2, behavior: 'smooth' });
    setActive(next);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(active + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(active - 1); }
  }

  const useCount = cards.length > DOTS_MAX;

  return (
    <main
      className="fit-screen w-full flex-1 min-h-0 flex flex-col overflow-hidden"
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-roledescription="carousel"
      aria-label={t('wird.pageTitle')}
    >
      {/* Index: dots (≤5) or a count (≥6), one line at any number (H5). */}
      <div className="flex-none flex items-center justify-center gap-1.5 min-h-10 pt-3">
        {useCount ? (
          <span className="text-small font-bold text-secondary whitespace-nowrap">
            {t('wird.cardCount', { current: active + 1, total: cards.length })}
          </span>
        ) : (
          cards.map((c, i) => (
            <span
              key={c.id}
              aria-hidden
              className={`h-1.5 rounded-full flex-none transition-all duration-(--duration-fast) ease-(--ease-out) ${
                i === active
                  ? 'w-5 bg-accent'
                  : c.doneToday
                    ? 'w-1.5 bg-accent-muted border border-accent' // completed marked distinctly (H5)
                    : 'w-1.5 bg-strong'
              }`}
            />
          ))
        )}
      </div>

      <div className="flex-1 min-h-0 flex items-stretch justify-center gap-4 px-4 pb-4">
        <ArrowButton dir="prev" label={t('wird.prevCard')} disabled={active === 0} onClick={() => goTo(active - 1)} />

        <div
          ref={scrollerRef}
          // Snap off while a card leaves: snapping would keep re-centring the
          // shrinking slide, dragging the previous card in to collide with
          // the next one. Unsnapped, only the neighbour closing the gap moves.
          className={`thin-scroll flex-1 min-w-0 max-w-130 flex gap-4 overflow-x-auto overflow-y-hidden [scrollbar-width:none] ${leavingId ? 'snap-none' : 'snap-x snap-mandatory'}`}
        >
          {cards.map((c, i) => (
            <div
              key={c.id}
              ref={(el) => { itemRefs.current[i] = el; }}
              className={`wird-slide basis-full shrink-0 grow-0 min-w-0 snap-center flex${leavingId === c.id ? ' is-leaving' : ''}`}
            >
              {/* height: 100% so the card sizes to the strip, not its content
                  (content-sized cards grow the page into a scroll). */}
              <div className="w-full h-full">
                <WirdCard card={c} onExit={onExit} />
              </div>
            </div>
          ))}
        </div>

        <ArrowButton dir="next" label={t('wird.nextCard')} disabled={active === cards.length - 1} onClick={() => goTo(active + 1)} />
      </div>

      {/* Bottom bar: the options menu (New / Manage) sits in the thumb zone,
          not at the top corner. The card floats above it (H10 — the card face
          still holds only the Done disc). */}
      <div className="flex-none flex justify-end items-center min-h-12 px-4 pb-3">
        <OptionsMenu t={t} openUp onNew={onNew} />
      </div>
    </main>
  );
}

/**
 * A brief loading placeholder shown between the optimistic dialog close and the
 * refreshed card landing. Non-blocking (pointer-events: none) so it never traps
 * a tap; a shimmering card + spinner give the create immediate feedback.
 */
function CreatingOverlay({ t }: { t: ReturnType<typeof useI18n>['t'] }) {
  return (
    <div
      aria-live="polite"
      className="fixed inset-0 z-90 pointer-events-none flex items-center justify-center p-4"
    >
      <div className="w-full max-w-90 flex flex-col gap-3 bg-surface-main border border-subtle rounded-xl shadow-e3 p-6">
        {[70, 40, 90].map((w, i) => (
          <Sk key={i} w={`${w}%`} h={i === 1 ? 28 : 14} r={8} />
        ))}
        <span className="mt-1 text-small font-semibold text-muted text-center">
          {t('common.loading')}
        </span>
      </div>
    </div>
  );
}

function ArrowButton({ dir, label, disabled, onClick }: { dir: 'prev' | 'next'; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      // ‹ › are a desktop affordance (H6): hidden below lg, where the snap strip
      // is the whole interaction.
      className={`hidden lg:flex self-center flex-none size-11 rounded-full border border-default bg-surface-main text-secondary items-center justify-center ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={dir === 'next' ? '-scale-x-100' : undefined}>
        <path d="M15 6l-6 6 6 6" />
      </svg>
    </button>
  );
}

function StatePanel({ title, hint, children, enter, showCreate, showOptions, onNew }: { title: string; hint: string; children?: React.ReactNode; enter?: boolean; showCreate?: boolean; showOptions?: boolean; onNew: () => void }) {
  const { t } = useI18n();
  return (
    <main className="fit-screen w-full flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 flex items-center justify-center p-4">
      <div className={`w-full max-w-130 flex flex-col items-center gap-3 text-center border border-dashed border-default rounded-xl py-8 px-6${enter ? ' wird-alldone-enter' : ''}`}>
        <h1 className="m-0 text-heading-m font-semibold">{title}</h1>
        <p className="m-0 text-small text-muted leading-normal">{hint}</p>
        {children}
        {showCreate && (
          <button
            type="button"
            onClick={onNew}
            aria-label={t('wird.newWird')}
            title={t('wird.newWird')}
            className="border-none cursor-pointer mt-2 size-16 rounded-full bg-(--accent-solid) text-accent-contrast shadow-e2 flex items-center justify-center"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        )}
      </div>
      </div>
      {showOptions && (
        <div className="flex-none flex justify-end items-center min-h-12 px-4 pb-3">
          <OptionsMenu t={t} openUp onNew={onNew} />
        </div>
      )}
    </main>
  );
}

/**
 * OptionsMenu — the single control shown while cards are on screen: a gear that
 * opens New + Manage. Keeps the card face clear (H10) and replaces the floating
 * create/manage buttons. Closes on outside click or Escape.
 */
function OptionsMenu({ t, openUp, onNew }: { t: ReturnType<typeof useI18n>['t']; openUp?: boolean; onNew: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const item = 'menu-item rounded-none px-4 py-2 font-semibold text-primary whitespace-nowrap';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('wird.options')}
        className="btn btn-ghost btn-icon"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute end-0 ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'} min-w-40 bg-surface-main border border-default rounded-md shadow-e3 overflow-hidden z-(--z-popover)`}
        >
          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); onNew(); }}>{t('wird.newWird')}</button>
          <Link href="/wird/manage" role="menuitem" className={`${item} border-t border-subtle`} onClick={() => setOpen(false)}>{t('wird.manage')}</Link>
        </div>
      )}
    </div>
  );
}

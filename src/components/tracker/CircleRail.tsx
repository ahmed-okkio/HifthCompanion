'use client';

/**
 * CircleRail — Discord-style circle picker, shown right of the main NavRail on
 * the tracker pages. Active circles render as avatars (current one highlighted),
 * pending invites render dimmed, and a trailing "+" opens the create-circle modal.
 *
 * Responsive: a vertical column on desktop, a horizontal scrollable strip on mobile
 * (AppShell stacks it above the content there). RTL-safe via logical properties.
 */

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';
import { createCircle } from '@/lib/services/circle';
import type { RailCircle } from '@/lib/tracker/railCircles';
import { ActionButton, Avatar, Icon } from './ui';
import { LAST_CIRCLE_KEY } from '@/lib/tracker/lastCircle';
import { useCircleReady } from './CircleReady';
import { Sk } from '@/components/Skeleton';

export type { RailCircle };

export default function CircleRail({ circles }: { circles: RailCircle[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  // Active circle derived from the URL (the rail lives in a persistent layout that
  // doesn't re-render per switch, so it can't get currentId from the server).
  const routeId = pathname?.match(/^\/tracker\/(?!join(?:\/|$))([^/]+)/)?.[1];
  // Optimistic selection: highlight the tapped circle immediately, before the route
  // actually changes. Sync when the pathname catches up.
  const [selected, setSelected] = useState(routeId);
  useEffect(() => {
    setSelected(routeId);
    // Remember the current circle so the main NavRail's Circles item can jump straight
    // here next time (one hop, one skeleton — no /tracker index redirect).
    if (routeId) localStorage.setItem(LAST_CIRCLE_KEY, routeId);
  }, [routeId]);

  // Hold the rail as a skeleton until the circle content mounts, so the whole view
  // reveals together on first open (rail doesn't pop in before the content). Latches
  // true, so between-circle nav keeps the rail real (content skeleton covers that).
  const { ready } = useCircleReady();
  if (!ready) return <RailSkeleton count={circles.length || 3} />;

  return (
    <nav
      aria-label={t('tracker.title')}
      className="flex justify-center w-full p-3 lg:h-full lg:w-auto lg:items-stretch lg:p-0 overflow-visible"
    >
      {/* Horizontal strip on mobile, vertical column on desktop. */}
      <div
        className="thin-scroll flex flex-row lg:flex-col items-center gap-2 w-full lg:w-auto lg:h-full overflow-x-auto lg:overflow-visible rounded-2xl lg:rounded-none border lg:border-y-0 lg:border-s-0 py-2 px-3 bg-surface-main border-subtle shadow-e1"
      >
      {circles.map((c) => {
        const active = c.id === selected;
        // The covering entry is a temporary pseudo-circle: its own label, and a
        // dashed ring so it never reads as one of the user's real circles.
        const label = c.covering
          ? t('subs.covering')
          : `${c.name} · ${t(c.teaching ? 'tracker.roleTeacher' : 'tracker.roleStudent')}`;
        return (
          <button
            key={c.id}
            type="button"
            aria-label={`${label}${c.pending ? ` · ${t('tracker.pendingInvite')}` : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => { setSelected(c.id); router.push(`/tracker/${c.id}`); }}
            onMouseEnter={() => setHovered(c.id)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(c.id)}
            onBlur={() => setHovered(null)}
            className={`relative flex-shrink-0 rounded-full transition-transform duration-150 ease-out hover:scale-110 focus-visible:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-600 border-0 bg-transparent cursor-pointer p-0${c.pending ? ' opacity-55' : ''}${active ? ' ring-2 ring-green-600 ring-offset-2 ring-offset-surface-app' : ''}`}
          >
            {active && (
              <>
                {/* desktop: bar on the inline-start edge; mobile: bar on top of the avatar */}
                <span
                  aria-hidden
                  className="hidden lg:block absolute -start-3 top-1/2 -translate-y-1/2 w-0.75 h-7 rounded-sm bg-green-600"
                />
                <span
                  aria-hidden
                  className="lg:hidden absolute -top-2.5 left-1/2 -translate-x-1/2 w-7 h-0.75 rounded-sm bg-green-600"
                />
              </>
            )}
            {c.covering ? (
              <span
                className="flex items-center justify-center rounded-full size-11 border border-dashed border-strong text-green-600 bg-surface-main"
              >
                <Icon name="cap" size={18} />
              </span>
            ) : (
              <Avatar seed={c.name} size={44} />
            )}
            {c.teaching && (
              <span
                aria-hidden
                className="flex items-center justify-center absolute -bottom-0.5 -end-0.5 size-4.5 rounded-full bg-green-600 text-accent-contrast border-2 border-surface-app"
              >
                <Icon name="cap" size={11} />
              </span>
            )}
            <Tooltip show={hovered === c.id} label={label} />
          </button>
        );
      })}

      <div aria-hidden className="hidden lg:block w-7 h-px bg-subtle my-1" />

      <button
        type="button"
        aria-label={t('tracker.createCircle')}
        onClick={() => setCreating(true)}
        onMouseEnter={() => setHovered('__create__')}
        onMouseLeave={() => setHovered(null)}
        onFocus={() => setHovered('__create__')}
        onBlur={() => setHovered(null)}
        className="relative flex flex-shrink-0 items-center justify-center rounded-full bg-transparent transition duration-150 ease-out hover:scale-110 focus-visible:scale-110 hover:bg-green-soft hover:border-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-600 size-11 border border-dashed border-strong cursor-pointer text-green-600"
      >
        <Icon name="plus" size={18} />
        <Tooltip show={hovered === '__create__'} label={t('tracker.createCircle')} />
      </button>
      </div>

      {creating && (
        <CreateCircleModal
          onClose={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); router.push(`/tracker/${id}`); router.refresh(); }}
        />
      )}
    </nav>
  );
}

/** Skeleton rail — same column geometry as the real rail, shimmer dots for circles. */
function RailSkeleton({ count }: { count: number }) {
  return (
    <nav className="flex justify-center w-full p-3 lg:h-full lg:w-auto lg:items-stretch lg:p-0" aria-hidden>
      <div
        className="flex flex-row lg:flex-col items-center gap-2 w-full lg:w-auto lg:h-full rounded-2xl lg:rounded-none border lg:border-y-0 lg:border-s-0 py-2 px-3 bg-surface-main border-subtle shadow-e1"
      >
        {Array.from({ length: Math.min(count, 6) }, (_, i) => (
          <Sk key={i} w={44} h={44} r={22} />
        ))}
      </div>
    </nav>
  );
}

/** Discord-style hover label, pinned to the inline-end (content) side of the avatar. */
function Tooltip({ show, label }: { show: boolean; label: string }) {
  return (
    <span
      role="tooltip"
      aria-hidden={!show}
      className={`hidden lg:block absolute start-full ms-3 top-1/2 -translate-y-1/2 pointer-events-none whitespace-nowrap bg-neutral-800 text-white text-caption font-semibold px-3 py-1.5 rounded-md shadow-e2 transition duration-150 ease-out z-10 ${show ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
    >
      {label}
    </span>
  );
}

function CreateCircleModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const c = await createCircle(name);
      onCreated(c.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('tracker.createCircle')}
      onClick={onClose}
      className="fixed inset-0 z-100 bg-overlay flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card flex flex-col gap-4 w-full max-w-100 p-6 rounded-xl shadow-e3 bg-surface-main"
      >
        <h2 className="text-heading-m font-bold text-primary m-0">{t('tracker.createCircle')}</h2>
        <input
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
          placeholder={t('tracker.createCircleHint')}
          className="input"
        />
        {error && <div role="alert" className="text-danger text-small">{error}</div>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn btn-outline btn-lg">{t('common.cancel')}</button>
          <ActionButton onClick={submit} disabled={!name.trim() || busy} className="btn btn-primary btn-lg">{t('common.create')}</ActionButton>
        </div>
      </div>
    </div>
  );
}

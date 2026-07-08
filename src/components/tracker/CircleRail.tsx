'use client';

/**
 * CircleRail — Discord-style circle picker, shown right of the main NavRail on
 * the tracker pages. Active circles render as avatars (current one highlighted),
 * pending invites render dimmed, and a trailing "+" opens the create-circle modal.
 *
 * Responsive: a vertical column on desktop, a horizontal scrollable strip on mobile
 * (AppShell stacks it above the content there). RTL-safe via logical properties.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';
import { createCircle } from '@/lib/services/circle';
import type { RailCircle } from '@/lib/tracker/railCircles';
import { Avatar, Icon } from './ui';

export type { RailCircle };

export default function CircleRail({ circles, currentId }: { circles: RailCircle[]; currentId?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <nav
      aria-label={t('tracker.title')}
      className="flex justify-center w-full p-3 lg:h-full lg:w-auto lg:items-stretch lg:p-3 lg:ps-0"
      style={{ overflow: 'visible' }}
    >
      {/* Horizontal strip on mobile, vertical column on desktop. */}
      <div
        className="thin-scroll flex flex-row lg:flex-col items-center gap-2 w-full lg:w-auto overflow-x-auto lg:overflow-visible"
        style={{
          padding: 'var(--space-8) var(--space-12)',
          background: 'var(--neutral-100, rgba(15,23,42,0.04))',
          borderRadius: 'var(--radius-xl, 20px)',
        }}
      >
      {circles.map((c) => {
        const active = c.id === currentId;
        return (
          <button
            key={c.id}
            type="button"
            aria-label={`${c.name} · ${t(c.teaching ? 'tracker.roleTeacher' : 'tracker.roleStudent')}${c.pending ? ` · ${t('tracker.pendingInvite')}` : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => router.push(`/tracker/${c.id}`)}
            onMouseEnter={() => setHovered(c.id)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(c.id)}
            onBlur={() => setHovered(null)}
            className="relative flex-shrink-0 rounded-full transition-transform duration-150 ease-out hover:scale-110 focus-visible:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--green-600)]"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
              opacity: c.pending ? 0.55 : 1,
              // active ring via box-shadow so `outline` stays free for the keyboard focus ring
              boxShadow: active ? '0 0 0 2px var(--surface-app, #fff), 0 0 0 4px var(--green-600)' : 'none',
            }}
          >
            {active && (
              <>
                {/* desktop: bar on the inline-start edge; mobile: bar on top of the avatar */}
                <span
                  aria-hidden
                  className="hidden lg:block"
                  style={{ position: 'absolute', insetInlineStart: -12, top: '50%', transform: 'translateY(-50%)', width: 3, height: 28, borderRadius: 2, background: 'var(--green-600)' }}
                />
                <span
                  aria-hidden
                  className="lg:hidden"
                  style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', width: 28, height: 3, borderRadius: 2, background: 'var(--green-600)' }}
                />
              </>
            )}
            <Avatar seed={c.name} size={44} />
            {c.teaching && (
              <span
                aria-hidden
                className="flex items-center justify-center"
                style={{
                  position: 'absolute', bottom: -2, insetInlineEnd: -2,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'var(--green-600)', color: '#fff',
                  border: '2px solid var(--surface-app, #fff)',
                }}
              >
                <Icon name="cap" size={11} />
              </span>
            )}
            <Tooltip show={hovered === c.id} label={`${c.name} · ${t(c.teaching ? 'tracker.roleTeacher' : 'tracker.roleStudent')}`} />
          </button>
        );
      })}

      <div aria-hidden className="hidden lg:block" style={{ width: 28, height: 1, background: 'var(--border-subtle)', margin: 'var(--space-4) 0' }} />

      <button
        type="button"
        aria-label={t('tracker.createCircle')}
        onClick={() => setCreating(true)}
        onMouseEnter={() => setHovered('__create__')}
        onMouseLeave={() => setHovered(null)}
        onFocus={() => setHovered('__create__')}
        onBlur={() => setHovered(null)}
        className="relative flex flex-shrink-0 items-center justify-center rounded-full transition-transform duration-150 ease-out hover:scale-110 focus-visible:scale-110 hover:bg-[var(--green-soft,rgba(22,155,82,0.12))] hover:border-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--green-600)]"
        style={{
          width: 44,
          height: 44,
          border: '1px dashed var(--border-strong, var(--border-subtle))',
          background: 'transparent',
          cursor: 'pointer',
          color: 'var(--green-600)',
        }}
      >
        <Icon name="plus" size={18} />
        <Tooltip show={hovered === '__create__'} label={t('tracker.createCircle')} />
      </button>
      </div>

      {creating && (
        <CreateCircleModal
          onClose={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); router.push(`/tracker/${id}`); }}
        />
      )}
    </nav>
  );
}

/** Discord-style hover label, pinned to the inline-end (content) side of the avatar. */
function Tooltip({ show, label }: { show: boolean; label: string }) {
  return (
    <span
      role="tooltip"
      aria-hidden={!show}
      className="hidden lg:block"
      style={{
        position: 'absolute',
        insetInlineStart: '100%',
        marginInlineStart: 12,
        top: '50%',
        transform: `translateY(-50%) scale(${show ? 1 : 0.9})`,
        opacity: show ? 1 : 0,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        background: 'var(--neutral-800, #1f2937)',
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
        padding: '6px 10px',
        borderRadius: 'var(--radius-md, 8px)',
        boxShadow: 'var(--shadow-e2)',
        transition: 'opacity var(--duration-fast, 0.15s) ease, transform var(--duration-fast, 0.15s) var(--ease-out, ease)',
        zIndex: 10,
      }}
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
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card flex flex-col gap-4"
        style={{ width: 'min(400px, 100%)', padding: '22px 24px' }}
      >
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{t('tracker.createCircle')}</h2>
        <input
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
          placeholder={t('tracker.createCircleHint')}
          className="input"
        />
        {error && <div role="alert" style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn btn-outline" style={{ minHeight: 44 }}>{t('common.cancel')}</button>
          <button onClick={submit} disabled={!name.trim() || busy} className="btn btn-primary" style={{ minHeight: 44 }}>{t('common.create')}</button>
        </div>
      </div>
    </div>
  );
}

'use client';

/**
 * CircleRail — Discord-style circle picker, shown right of the main NavRail on
 * the tracker pages. Active circles render as avatars (current one highlighted),
 * pending invites render dimmed, and a trailing "+" opens the create-circle modal.
 *
 * The rail is desktop-only (AppShell renders it inside a `hidden lg:block` slot).
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
            title={c.name}
            aria-label={c.name}
            aria-current={active ? 'page' : undefined}
            onClick={() => router.push(`/tracker/${c.id}`)}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; setHovered(c.id); }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; setHovered(null); }}
            style={{
              position: 'relative',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
              opacity: c.pending ? 0.45 : 1,
              borderRadius: '50%',
              outline: active ? '2px solid var(--green-600)' : 'none',
              outlineOffset: 2,
              flexShrink: 0,
              transform: 'scale(1)',
              transition: 'transform var(--duration-fast, 0.15s) var(--ease-out, ease)',
            }}
          >
            {active && (
              <span
                aria-hidden
                style={{ position: 'absolute', insetInlineStart: -12, top: '50%', transform: 'translateY(-50%)', width: 3, height: 28, borderRadius: '0 2px 2px 0', background: 'var(--green-600)' }}
              />
            )}
            <Avatar seed={c.name} size={44} />
            {c.teaching && (
              <span
                aria-hidden
                title={t('tracker.roleTeacher')}
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
            <Tooltip show={hovered === c.id} label={c.teaching ? `${c.name} · ${t('tracker.roleTeacher')}` : `${c.name} · ${t('tracker.roleStudent')}`} />
          </button>
        );
      })}

      <div aria-hidden className="hidden lg:block" style={{ width: 28, height: 1, background: 'var(--border-subtle)', margin: 'var(--space-4) 0' }} />

      <button
        type="button"
        aria-label={t('tracker.createCircle')}
        onClick={() => setCreating(true)}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.background = 'var(--green-soft, rgba(22,155,82,0.12))';
          e.currentTarget.style.borderStyle = 'solid';
          setHovered('__create__');
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderStyle = 'dashed';
          setHovered(null);
        }}
        className="flex items-center justify-center"
        style={{
          position: 'relative',
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: '1px dashed var(--border-strong, var(--border-subtle))',
          background: 'transparent',
          cursor: 'pointer',
          color: 'var(--green-600)',
          flexShrink: 0,
          transform: 'scale(1)',
          transition: 'transform var(--duration-fast, 0.15s) var(--ease-out, ease), background var(--duration-fast, 0.15s) ease',
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

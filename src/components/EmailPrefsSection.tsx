'use client';

// Email notification opt-outs (PRD 0010 M4, U1–U3). Default-on: a missing key
// reads as checked. Each toggle persists immediately via saveEmailPrefs.

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { saveEmailPrefs } from '@/lib/services/profile';
import type { EmailPrefs } from '@/types';

const KEYS = ['invite', 'homework', 'session_change'] as const;

/** Native checkbox styled as a switch — keeps keyboard focus and screen-reader
 *  semantics for free rather than rebuilding them on a div. */
function Switch({ checked, onChange, labelledBy }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  labelledBy: string;
}) {
  return (
    <span
      style={{
        position: 'relative', display: 'inline-flex', flexShrink: 0,
        width: 40, height: 24, borderRadius: 999,
        background: checked ? 'var(--green-600)' : 'var(--border-default)',
        transition: 'background var(--duration-normal) var(--ease-out)',
      }}
    >
      <input
        type="checkbox"
        role="switch"
        aria-labelledby={labelledBy}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, opacity: 0, cursor: 'pointer' }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute', top: 3, insetInlineStart: checked ? 19 : 3,
          width: 18, height: 18, borderRadius: '50%', background: '#fff',
          boxShadow: 'var(--shadow-e1)',
          transition: 'inset-inline-start var(--duration-normal) var(--ease-out)',
        }}
      />
    </span>
  );
}

export default function EmailPrefsSection({ initial }: { initial: EmailPrefs }) {
  const { t } = useI18n();
  const [prefs, setPrefs] = useState<EmailPrefs>(initial);

  const toggle = async (key: (typeof KEYS)[number], value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    // ponytail: no rollback on failure — reload shows truth; add a toast if users hit it.
    await saveEmailPrefs({ [key]: value });
  };

  return (
    <div className="flex flex-col">
      <p className="text-sm" style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-16)' }}>
        {t('profile.emailPrefs.help')}
      </p>
      {KEYS.map((key, i) => (
        <div
          key={key}
          className="flex items-center justify-between gap-4"
          style={{
            padding: 'var(--space-12) 0',
            borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex flex-col gap-1 min-w-0">
            <span id={`pref-${key}`} className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {t(`profile.emailPrefs.${key}`)}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t(`profile.emailPrefs.${key}.desc`)}
            </span>
          </div>
          <Switch
            checked={prefs[key] !== false}
            onChange={(v) => toggle(key, v)}
            labelledBy={`pref-${key}`}
          />
        </div>
      ))}
    </div>
  );
}

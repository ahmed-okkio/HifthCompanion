'use client';

// Email notification opt-outs (PRD 0010 M4, U1–U3). Default-on: a missing key
// reads as checked. Each toggle persists immediately via saveEmailPrefs.

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { saveEmailPrefs } from '@/lib/services/profile';
import type { EmailPrefs } from '@/types';

const KEYS = ['invite', 'homework', 'session_change', 'progress', 'exam'] as const;

/** Native checkbox styled as a switch — keeps keyboard focus and screen-reader
 *  semantics for free rather than rebuilding them on a div. */
function Switch({ checked, onChange, labelledBy }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  labelledBy: string;
}) {
  return (
    <span
      className={`relative inline-flex shrink-0 w-10 h-6 rounded-full transition-colors ${checked ? 'bg-green-600' : 'bg-default'}`}
    >
      <input
        type="checkbox"
        role="switch"
        aria-labelledby={labelledBy}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="absolute inset-0 w-full h-full m-0 opacity-0 cursor-pointer"
      />
      <span
        aria-hidden
        className={`absolute top-0.75 size-4.5 rounded-full bg-white shadow-e1 transition-all ${checked ? 'start-4.75' : 'start-0.75'}`}
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
      <p className="text-sm text-muted mb-4">
        {t('profile.emailPrefs.help')}
      </p>
      {KEYS.map((key, i) => (
        <div
          key={key}
          className={`flex items-center justify-between gap-4 py-3 ${i === 0 ? '' : 'border-t border-subtle'}`}
        >
          <div className="flex flex-col gap-1 min-w-0">
            <span id={`pref-${key}`} className="text-sm font-medium text-primary">
              {t(`profile.emailPrefs.${key}`)}
            </span>
            <span className="text-xs text-muted">
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

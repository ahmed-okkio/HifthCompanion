'use client';

// Email notification opt-outs (PRD 0010 M4, U1–U3). Default-on: a missing key
// reads as checked. Each toggle persists immediately via saveEmailPrefs.

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { saveEmailPrefs } from '@/lib/services/profile';
import type { EmailPrefs } from '@/types';

const KEYS = ['invite', 'homework', 'session_change'] as const;

export default function EmailPrefsSection({ initial }: { initial: EmailPrefs }) {
  const { t } = useI18n();
  const [prefs, setPrefs] = useState<EmailPrefs>(initial);

  const toggle = async (key: (typeof KEYS)[number], value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    // ponytail: no rollback on failure — reload shows truth; add a toast if users hit it.
    await saveEmailPrefs({ [key]: value });
  };

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        {t('profile.emailPrefs.title')}
      </h2>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {t('profile.emailPrefs.help')}
      </p>
      {KEYS.map((key) => (
        <label key={key} className="flex items-center gap-2 text-sm"
               style={{ color: 'var(--text-primary)' }}>
          <input
            type="checkbox"
            checked={prefs[key] !== false}
            onChange={(e) => toggle(key, e.target.checked)}
          />
          {t(`profile.emailPrefs.${key}`)}
        </label>
      ))}
    </div>
  );
}

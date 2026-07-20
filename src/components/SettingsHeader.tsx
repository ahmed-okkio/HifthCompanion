'use client';

// Page chrome for /settings. Client-side because every string is translated.
// Reuses the tracker's PageHeader/SectionTitle vocabulary so Settings reads as
// part of the same app rather than a one-off screen.

import type { ReactNode } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { PageHeader, SectionTitle } from '@/components/tracker/ui';
import type { MessageKey } from '@/lib/i18n/dictionaries';

export default function SettingsHeader() {
  const { t } = useI18n();
  return <PageHeader title={t('common.settings')} subtitle={t('settings.subtitle')} />;
}

/** An uppercase section label above a card. */
export function SettingsSection({ labelKey, children }: { labelKey: MessageKey; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <section className="flex flex-col" style={{ gap: 'var(--space-12)' }}>
      <SectionTitle>{t(labelKey)}</SectionTitle>
      <div className="card" style={{ padding: 'var(--space-20)' }}>
        {children}
      </div>
    </section>
  );
}

'use client';

// Daily wird reminder time (PRD 0016). One native select — Off plus every
// 15-minute slot — in the EmailPrefsSection row idiom. Saves on change; a
// failed save rolls back to the last saved value. The time is per account, but
// whether a push can arrive is per device, so the amber bar (the wird card's
// D15 stale-marker tone) says when it won't arrive HERE — the select stays
// editable, since the time still applies to the user's other devices.

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { saveWirdReminderTime } from '@/lib/services/profile';
import { PUSH_CHANGED, readPushStatus, type PushStatus } from '@/lib/push/client';
import { REMINDER_TIMES, formatReminderTime } from '@/lib/wirdReminder';
import { AMBER } from '@/components/wird/WirdCard';
import type { MessageKey } from '@/lib/i18n/dictionaries';

const BAR: Record<Exclude<PushStatus, 'on'>, MessageKey> = {
  off: 'wird.reminder.pushOff',
  denied: 'wird.reminder.pushDenied',
  ios: 'wird.reminder.iosNotInstalled',
  unsupported: 'wird.reminder.unsupported',
};

export default function WirdReminderRow({ initial, hasWirds }: {
  /** profiles.wird_reminder_time ('HH:MM:SS') or null when off. */
  initial: string | null;
  hasWirds: boolean;
}) {
  const { t, locale } = useI18n();
  const toValue = (time: string | null) => (time ? time.slice(0, 5) : '');
  const [value, setValue] = useState(toValue(initial));
  const saved = useRef(toValue(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [push, setPush] = useState<PushStatus | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const refresh = () => { void readPushStatus().then(setPush); };
    refresh();
    window.addEventListener(PUSH_CHANGED, refresh);
    return () => window.removeEventListener(PUSH_CHANGED, refresh);
  }, []);

  async function change(next: string) {
    setValue(next);
    setError(false);
    setSaving(true);
    const req = ++latest.current; // last change wins
    try {
      await saveWirdReminderTime(next === '' ? null : next);
      saved.current = next;
    } catch {
      if (req === latest.current) {
        setValue(saved.current);
        setError(true);
      }
    } finally {
      if (req === latest.current) setSaving(false);
    }
  }

  const showBar = hasWirds && value !== '' && push !== null && push !== 'on';

  return (
    <div
      data-testid="wird-reminder-row"
      className="flex flex-col py-3 border-t border-subtle mt-3"
    >
      <div
        className={`flex items-center justify-between gap-4 ${hasWirds ? '' : 'opacity-35'}`}
      >
        <div className="flex flex-col gap-1 min-w-0">
          <label htmlFor="wird-reminder" className="text-sm font-medium text-primary">
            {t('wird.reminder.label')}
          </label>
          <span className="text-xs text-muted">
            {t('wird.reminder.desc')}
          </span>
        </div>
        <select
          id="wird-reminder"
          className="input w-auto shrink-0"
          value={value}
          disabled={!hasWirds}
          onChange={(e) => change(e.target.value)}
        >
          <option value="">{t('wird.reminder.off')}</option>
          {REMINDER_TIMES.map((time) => (
            <option key={time} value={time}>{formatReminderTime(time, locale)}</option>
          ))}
        </select>
      </div>

      {!hasWirds && (
        <span className="text-xs text-muted mt-2">
          {t('wird.reminder.noWirds')}
        </span>
      )}
      {showBar && (
        <span
          role="status"
          className={`mt-2 px-3 py-2 rounded-sm text-caption font-medium ${AMBER}`}
        >
          {t(BAR[push])}
        </span>
      )}
      {saving && (
        <span className="text-xs flex items-center gap-2 text-muted mt-2">
          <span className="spinner" aria-hidden />
          {t('wird.reminder.saving')}
        </span>
      )}
      {error && (
        <span role="alert" className="text-danger text-caption mt-2">
          {t('wird.reminder.saveError')}
        </span>
      )}
    </div>
  );
}

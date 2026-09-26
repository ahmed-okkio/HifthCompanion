'use client';

/**
 * ReminderSheet — offers the daily wird reminder once, right after the first
 * wird is created (PRD 0016). A soft prompt: our button is what spends the
 * one-shot native permission dialog, never page load.
 *
 * Only an explicit "Not now" turns the reminder off (saves null). Close,
 * Escape and a scrim tap save nothing, so the account keeps the 18:00 default
 * and it starts working whenever push is later turned on.
 */

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { saveWirdReminderTime } from '@/lib/services/profile';
import { PUSH_CHANGED, readPushStatus, subscribeToPush } from '@/lib/push/client';
import { DEFAULT_REMINDER, REMINDER_TIMES, formatReminderTime } from '@/lib/wirdReminder';

const ASKED_KEY = 'hifth:wirdReminderAsked';

export type ReminderSheetStart = 'ask' | 'ios';

/**
 * Whether to offer the sheet on this device, and which face. Asks only while
 * the permission is still unspent (an already-subscribed user keeps the
 * default silently), or on iOS-in-a-tab where the fix is installing. Marks the
 * device as asked, so it never repeats.
 */
export async function reminderSheetStart(): Promise<ReminderSheetStart | null> {
  try {
    if (localStorage.getItem(ASKED_KEY)) return null;
  } catch {
    // Blocked storage: ask anyway.
  }
  const status = await readPushStatus();
  const start: ReminderSheetStart | null =
    status === 'ios'
      ? 'ios'
      : status === 'off' && Notification.permission === 'default' && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        ? 'ask'
        : null;
  if (start) {
    try {
      localStorage.setItem(ASKED_KEY, '1');
    } catch {
      // Nothing to persist to.
    }
  }
  return start;
}

type Phase = 'ask' | 'busy' | 'set' | 'denied' | 'ios';

export default function ReminderSheet({ start, onClose }: { start: ReminderSheetStart; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [phase, setPhase] = useState<Phase>(start);
  const [time, setTime] = useState(DEFAULT_REMINDER);
  const [timeOpen, setTimeOpen] = useState(false);
  const [error, setError] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const shown = formatReminderTime(time, locale);

  useEffect(() => {
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    // NotifyBanner is mounted globally; hide it while this asks the same thing.
    document.documentElement.dataset.reminderSheet = '';
    return () => {
      window.removeEventListener('keydown', onKey);
      delete document.documentElement.dataset.reminderSheet;
    };
  }, [onClose]);

  function step(dir: 1 | -1) {
    const i = REMINDER_TIMES.indexOf(time);
    setTime(REMINDER_TIMES[(i + dir + REMINDER_TIMES.length) % REMINDER_TIMES.length]);
  }

  function enable() {
    setError(false);
    setPhase('busy');
    // requestPermission() must be the first thing the click does: Safari drops
    // the user gesture across an earlier await and silently refuses.
    void Notification.requestPermission().then(async (permission) => {
      if (permission !== 'granted') {
        window.dispatchEvent(new Event(PUSH_CHANGED));
        setPhase('denied');
        return;
      }
      try {
        await subscribeToPush(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!);
        window.dispatchEvent(new Event(PUSH_CHANGED));
        await saveWirdReminderTime(time);
        setPhase('set');
      } catch {
        setError(true);
        setPhase('ask');
      }
    });
  }

  function notNow() {
    // ponytail: fire-and-forget; a failed save leaves the 18:00 default, which Settings shows.
    void saveWirdReminderTime(null).catch(() => {});
    onClose();
  }

  const h2 = 'm-0 text-heading-m font-bold text-primary';
  const muted = 'm-0 text-body text-muted leading-normal';
  const closeBtn = (
    <button ref={primaryRef} type="button" className="btn btn-ghost btn-tall" onClick={onClose}>
      {t('wird.reminder.close')}
    </button>
  );

  let body: React.ReactNode;
  if (phase === 'set') {
    body = (
      <>
        <span className="size-12 rounded-full bg-accent text-accent-contrast flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5L20 7" /></svg>
        </span>
        <h2 id="reminder-sheet-title" className={h2}>{t('wird.reminder.set', { t: shown })}</h2>
        <p className={muted}>{t('wird.reminder.setSub')}</p>
        {closeBtn}
      </>
    );
  } else if (phase === 'denied') {
    body = (
      <>
        <h2 id="reminder-sheet-title" className="m-0 text-body font-bold text-danger">{t('push.denied')}</h2>
        <p className={muted}>{t('wird.reminder.deniedSub', { t: shown })}</p>
        {closeBtn}
      </>
    );
  } else if (phase === 'ios') {
    body = (
      <>
        <h2 id="reminder-sheet-title" className={h2}>{t('wird.reminder.iosTitle')}</h2>
        <p className={muted}>{t('push.iosHint')}</p>
        <p className="m-0 text-body leading-normal font-semibold text-primary">{t('install.iosSafari')}</p>
        {closeBtn}
      </>
    );
  } else {
    body = (
      <>
        <h2 id="reminder-sheet-title" className={h2}>{t('wird.reminder.sheetTitle')}</h2>
        <p className={`${muted} -mt-2`}>{t('wird.reminder.sheetBody', { t: shown })}</p>
        <div className="flex items-center gap-2 min-h-10">
          <span className="flex-1 text-body font-semibold text-secondary">{t('wird.reminder.timeLabel')}</span>
          {timeOpen ? (
            <span className="inline-flex items-center h-10 border border-default rounded-sm bg-surface-main overflow-hidden">
              <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => step(-1)} aria-label={t('wird.reminder.earlier')}>−</button>
              <output aria-live="polite" className="min-w-18 text-center text-body font-semibold">{shown}</output>
              <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => step(1)} aria-label={t('wird.reminder.later')}>+</button>
            </span>
          ) : (
            <>
              <span className="font-bold text-body">{shown}</span>
              <button type="button" className="btn btn-ghost" onClick={() => setTimeOpen(true)}>
                {t('wird.reminder.change')}
              </button>
            </>
          )}
        </div>
        <button ref={primaryRef} type="button" className="btn btn-primary btn-tall" onClick={enable} disabled={phase === 'busy'}>
          {phase === 'busy' ? <span className="spinner" aria-hidden /> : null}
          {t('wird.reminder.remindAt', { t: shown })}
        </button>
        {error && (
          <span role="alert" className="text-danger text-caption -mt-2">
            {t('wird.reminder.enableError')}
          </span>
        )}
        <button type="button" className="btn btn-ghost btn-lg -mt-2" onClick={notNow} disabled={phase === 'busy'}>
          {t('wird.reminder.notNow')}
        </button>
      </>
    );
  }

  return (
    <div
      onClick={onClose}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-(--z-overlay) bg-overlay flex items-end justify-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-sheet-title"
        data-testid="reminder-sheet"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-120 bg-surface-main rounded-t-xl shadow-e3 pt-2 px-6 pb-[calc(24px+env(safe-area-inset-bottom))] flex flex-col gap-4"
      >
        <span aria-hidden className="w-9 h-1 rounded-full bg-neutral-300 self-center" />
        {body}
      </div>
    </div>
  );
}

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

  const h2: React.CSSProperties = { margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' };
  const muted: React.CSSProperties = { margin: 0, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.45 };
  const stepBtn: React.CSSProperties = {
    width: 34, height: '100%', border: 'none', background: 'transparent', cursor: 'pointer',
    fontSize: 16, fontWeight: 600, color: 'var(--text-muted)',
  };
  const closeBtn = (
    <button ref={primaryRef} type="button" className="btn btn-ghost btn-tall" onClick={onClose}>
      {t('wird.reminder.close')}
    </button>
  );

  let body: React.ReactNode;
  if (phase === 'set') {
    body = (
      <>
        <span style={{ width: 48, height: 48, borderRadius: 9999, background: 'var(--accent-solid)', color: 'var(--accent-contrast)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5L20 7" /></svg>
        </span>
        <h2 id="reminder-sheet-title" style={h2}>{t('wird.reminder.set', { t: shown })}</h2>
        <p style={muted}>{t('wird.reminder.setSub')}</p>
        {closeBtn}
      </>
    );
  } else if (phase === 'denied') {
    body = (
      <>
        <h2 id="reminder-sheet-title" style={{ ...h2, fontSize: 15, color: 'var(--danger)' }}>{t('push.denied')}</h2>
        <p style={muted}>{t('wird.reminder.deniedSub', { t: shown })}</p>
        {closeBtn}
      </>
    );
  } else if (phase === 'ios') {
    body = (
      <>
        <h2 id="reminder-sheet-title" style={h2}>{t('wird.reminder.iosTitle')}</h2>
        <p style={muted}>{t('push.iosHint')}</p>
        <p style={{ ...muted, fontWeight: 600, color: 'var(--text-primary)' }}>{t('install.iosSafari')}</p>
        {closeBtn}
      </>
    );
  } else {
    body = (
      <>
        <h2 id="reminder-sheet-title" style={h2}>{t('wird.reminder.sheetTitle')}</h2>
        <p style={{ ...muted, marginTop: -8 }}>{t('wird.reminder.sheetBody', { t: shown })}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40 }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>{t('wird.reminder.timeLabel')}</span>
          {timeOpen ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', height: 40, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', overflow: 'hidden' }}>
              <button type="button" style={stepBtn} onClick={() => step(-1)} aria-label={t('wird.reminder.earlier')}>−</button>
              <output aria-live="polite" style={{ minWidth: 72, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{shown}</output>
              <button type="button" style={stepBtn} onClick={() => step(1)} aria-label={t('wird.reminder.later')}>+</button>
            </span>
          ) : (
            <>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{shown}</span>
              <button type="button" className="btn btn-ghost" style={{ padding: '8px 10px' }} onClick={() => setTimeOpen(true)}>
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
          <span role="alert" style={{ color: 'var(--danger)', fontSize: 12, marginTop: -8 }}>
            {t('wird.reminder.enableError')}
          </span>
        )}
        <button type="button" className="btn btn-ghost" style={{ minHeight: 44, marginTop: -8 }} onClick={notNow} disabled={phase === 'busy'}>
          {t('wird.reminder.notNow')}
        </button>
      </>
    );
  }

  return (
    <div
      onClick={onClose}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15,23,42,0.45)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-sheet-title"
        data-testid="reminder-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(480px, 100%)', background: 'var(--surface-main)',
          borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0', boxShadow: 'var(--shadow-e3)',
          padding: '8px 24px calc(24px + env(safe-area-inset-bottom))',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <span aria-hidden style={{ width: 36, height: 4, borderRadius: 9999, background: 'var(--neutral-300)', alignSelf: 'center' }} />
        {body}
      </div>
    </div>
  );
}

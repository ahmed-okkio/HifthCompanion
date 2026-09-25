import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { sendPushToUser } from '@/lib/push/send';
import { localDate } from '@/lib/localDate';
import { reminderDue, wirdsLeftToday, type ReminderEntry, type ReminderWird } from '@/lib/wirdReminder';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/config';

/**
 * Daily wird reminder tick (0016). pg_cron POSTs here every 15 minutes (see
 * supabase/migrations/20260925000001_wird_reminder.sql). Pushes "N wirds left
 * today" to every user whose reminder time is the current 15-minute slot in
 * their own timezone and who still has a wird waiting. Users with no saved
 * timezone are skipped, not guessed at.
 *
 * ponytail: loads every opted-in profile each tick and filters the slot in JS.
 * Fine for thousands of users; move the slot match into SQL (an RPC comparing
 * `now() at time zone timezone`) once that stops being true.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 });
  }
  const admin = createSupabaseAdmin(url, serviceKey, { auth: { persistSession: false } });
  const now = new Date();

  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, timezone, wird_reminder_time, locale')
    .not('wird_reminder_time', 'is', null)
    .not('timezone', 'is', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const due = (profiles ?? []).filter(
    (p: { timezone: string; wird_reminder_time: string }) =>
      reminderDue(p.timezone, p.wird_reminder_time, now),
  ) as { id: string; timezone: string; locale: Locale | null }[];
  if (due.length === 0) return NextResponse.json({ due: 0, sent: 0 });

  const { data: wirds, error: wErr } = await admin
    .from('wird')
    .select('id, user_id, pages_per_period, period_days, cycle_seq')
    .in('user_id', due.map((p) => p.id))
    .is('deleted_at', null);
  if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });
  const liveWirds = (wirds ?? []) as (ReminderWird & { user_id: string })[];

  let entries: ReminderEntry[] = [];
  if (liveWirds.length > 0) {
    const { data, error: eErr } = await admin
      .from('wird_entry')
      .select('wird_id, entry_date, cycle_seq')
      .in('wird_id', liveWirds.map((w) => w.id));
    if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });
    entries = (data ?? []) as ReminderEntry[];
  }

  let sent = 0;
  await Promise.all(
    due.map(async (p) => {
      const left = wirdsLeftToday(
        liveWirds.filter((w) => w.user_id === p.id),
        entries,
        localDate(p.timezone, now),
      );
      if (left === 0) return;
      const dict = getDictionary(p.locale === 'ar' ? 'ar' : 'en');
      const result = await sendPushToUser(p.id, {
        title: dict['wird.reminder.pushTitle'],
        body: left === 1 ? dict['wird.reminder.pushOne'] : dict['wird.reminder.pushMany'].replace('{n}', String(left)),
        url: '/wird',
      });
      sent += result.sent;
    }),
  );

  return NextResponse.json({ due: due.length, sent });
}

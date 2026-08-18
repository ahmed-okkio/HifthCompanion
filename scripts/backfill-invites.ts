/**
 * One-off backfill: send a calendar invite for every membership that already
 * has a weekly schedule from before invites existed.
 *
 * Those students will never get one otherwise — setSchedule only mails when the
 * rule *changes*, so a teacher re-saving an identical schedule sends nothing.
 *
 * Dry run (prints who would be mailed, sends nothing):
 *   npx tsx --env-file=.env.local scripts/backfill-invites.ts
 * For real:
 *   npx tsx --env-file=.env.local scripts/backfill-invites.ts --send
 *
 * Re-running is safe: each invite reuses the membership's stable series UID, so
 * a client replaces the series rather than stacking a second copy.
 *
 * ponytail: a script, not a UI button — this is a one-time migration, and the
 * ongoing resend cases (student changes calendar account, horizon expiry) have
 * not actually come up yet.
 */
import { createClient } from '@supabase/supabase-js';

import { notifySchedule } from '../src/lib/email/notify';
import type { Recurrence } from '../src/types';

const send = process.argv.includes('--send');
/** Mail a single membership first, to check a real client before the rest. */
const only = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length);
/**
 * Also rewrite each rule's lesson length before mailing. Schedules saved before
 * the length field existed have none and are read as 60 minutes, so this is how
 * they get moved in bulk rather than re-edited one student at a time.
 */
const setMinutes = Number(
  process.argv.find((a) => a.startsWith('--set-minutes='))?.slice('--set-minutes='.length),
);

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required');
  if (send && !process.env.SMTP_USER) throw new Error('SMTP_USER not set — --send would be a no-op');

  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db
    .from('membership')
    .select('id, user_id, schedule, status, circle(name)')
    .eq('status', 'active')
    .not('schedule', 'is', null);
  if (error) throw error;

  const rows = (data ?? [])
    .filter((m) => {
      const s = m.schedule as Recurrence | null;
      return Boolean(s?.weekdays?.length);
    })
    .filter((m) => !only || m.id === only);

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  // Names, never addresses — the listing has to be readable without putting
  // anyone's email in a terminal or a scrollback buffer. Separate query because
  // membership.user_id carries no FK to profiles (same reason notify.ts's
  // nameOf does its own lookup rather than embedding).
  const { data: profiles } = await db
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', rows.map((m) => m.user_id));
  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(' ')]),
  );
  const who = (m: (typeof rows)[number]) => {
    const c = Array.isArray(m.circle) ? m.circle[0] : m.circle;
    const name = nameById.get(m.user_id) || '(unnamed)';
    return c?.name ? `${name} · ${c.name}` : name;
  };

  console.log(`${rows.length} active membership(s) with a schedule.`);
  if (!send) {
    for (const m of rows) {
      const s = m.schedule as Recurrence;
      const days = [...s.weekdays].sort((a, b) => a - b).map((d) => DAYS[d]).join('/');
      const len = setMinutes ? `${s.minutes ?? 60}->${setMinutes}min` : `${s.minutes ?? 60}min`;
      console.log(
        `  ${who(m).padEnd(28)} ${days} ${s.time} ${s.timezone ?? 'UTC'} ${len.padStart(11)}   ${m.id}`,
      );
    }
    console.log('\nDry run — nothing sent. Re-run with --send to mail these.');
    return;
  }

  let ok = 0;
  for (const m of rows) {
    let rule = m.schedule as Recurrence;
    if (setMinutes) {
      rule = { ...rule, minutes: setMinutes };
      const { error: upErr } = await db.from('membership').update({ schedule: rule }).eq('id', m.id);
      if (upErr) throw upErr;
    }
    // notifySchedule is best-effort and swallows its own failures, so one bad
    // row can never abort the rest of the backfill.
    await notifySchedule(m.id, rule);
    ok += 1;
    console.log(`  sent ${ok}/${rows.length}  ${m.id}`);
  }
  console.log(
    `\nDone — ${ok} invite(s) dispatched (student + teacher each)` +
      (setMinutes ? `, length set to ${setMinutes} min.` : '.'),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

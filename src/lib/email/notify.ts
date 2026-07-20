// ponytail: no `server-only` import — every caller is a 'use server' service file,
// and the guard is unresolvable under vitest without touching vitest.config.ts.
import { createClient as createSupabaseAdmin, type SupabaseClient } from '@supabase/supabase-js';

import { displayName } from '@/lib/displayName';
import { sendEmail } from '@/lib/email/send';
import {
  prefEnabled,
  inviteBody,
  homeworkBody,
  sessionChangeBody,
  type EmailPrefKey,
} from '@/lib/email/templates';

/**
 * Service-role client — recipient email addresses are resolved server-side only
 * (auth.admin.getUserById) and never handed back to the triggering teacher.
 * Same pattern as push/send.ts. Returns null when unconfigured so every notify
 * degrades to a no-op instead of throwing (S1).
 */
function admin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.warn('[email] SUPABASE_SERVICE_ROLE_KEY not set — notify is a no-op.');
    return null;
  }
  return createSupabaseAdmin(url, serviceKey, { auth: { persistSession: false } });
}

/** Resolve address + prefs, gate, send. Never returns the address. */
async function deliver(
  db: SupabaseClient,
  userId: string,
  key: EmailPrefKey,
  subject: string,
  html: string,
): Promise<void> {
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error) throw error;
  const to = data.user?.email;
  if (!to) return;

  const { data: profile } = await db
    .from('profiles')
    .select('email_prefs')
    .eq('id', userId)
    .maybeSingle();
  if (!prefEnabled(profile?.email_prefs, key)) return;

  await sendEmail(to, subject, html);
}

/** ponytail: one swallow-and-log wrapper instead of try/catch in each notify. */
async function bestEffort(label: string, fn: (db: SupabaseClient) => Promise<void>): Promise<void> {
  try {
    const db = admin();
    if (!db) return;
    await fn(db);
  } catch (err) {
    console.warn(`[email] ${label} notify failed`, (err as Error).message);
  }
}

async function nameOf(db: SupabaseClient, userId: string): Promise<string> {
  const { data } = await db
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', userId)
    .maybeSingle();
  return displayName({ user_id: userId, first_name: data?.first_name, last_name: data?.last_name });
}

/** A teacher added `userId` to `circleId` as a pending member. */
export async function notifyInvite(userId: string, circleId: string): Promise<void> {
  await bestEffort('invite', async (db) => {
    const { data: circle } = await db
      .from('circle')
      .select('name, teacher_id')
      .eq('id', circleId)
      .maybeSingle();
    if (!circle) return;
    const teacherName = await nameOf(db, circle.teacher_id);
    await deliver(
      db,
      userId,
      'invite',
      'You have been invited to a circle — دعوة إلى حلقة',
      inviteBody({ teacherName, circleName: circle.name ?? '' }),
    );
  });
}

/** New homework prescribed on `membershipId` — recipient is that membership's student. */
export async function notifyHomework(
  membershipId: string,
  range: string,
  deadline: string | null,
): Promise<void> {
  await bestEffort('homework', async (db) => {
    const { data: membership } = await db
      .from('membership')
      .select('user_id')
      .eq('id', membershipId)
      .maybeSingle();
    if (!membership?.user_id) return;
    const studentName = await nameOf(db, membership.user_id);
    await deliver(
      db,
      membership.user_id,
      'homework',
      'New homework — واجب جديد',
      homeworkBody({ studentName, range, deadline: deadline ?? 'no deadline / بدون موعد' }),
    );
  });
}

/**
 * Session moved (newTime) or canceled (newTime null) — recipient is its student.
 * `oldTime` is passed by reschedule (the row already holds the new time by then);
 * cancel omits it and the stored scheduled_at is correct.
 */
export async function notifySessionChange(
  sessionId: string,
  newTime: string | null,
  oldTime?: string,
): Promise<void> {
  await bestEffort('session_change', async (db) => {
    const { data: session } = await db
      .from('session')
      .select('scheduled_at, membership(user_id)')
      .eq('id', sessionId)
      .maybeSingle();
    const membership = session?.membership as { user_id?: string } | { user_id?: string }[] | null;
    const userId = Array.isArray(membership) ? membership[0]?.user_id : membership?.user_id;
    if (!userId) return;
    const studentName = await nameOf(db, userId);
    await deliver(
      db,
      userId,
      'session_change',
      newTime ? 'Session rescheduled — تغيير موعد الجلسة' : 'Session canceled — إلغاء الجلسة',
      sessionChangeBody({ studentName, oldTime: oldTime ?? session?.scheduled_at ?? '', newTime }),
    );
  });
}

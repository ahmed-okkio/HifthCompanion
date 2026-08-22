import nodemailer, { type Transporter } from 'nodemailer';

import { buildIcs, type IcsEvent, type IcsMethod } from '@/lib/email/ics';

/** Calendar invite to ride along with the mail; the attendee is filled in here. */
export interface EmailInvite {
  method: IcsMethod;
  events: IcsEvent[];
  /** Shown as the organizer's display name; the address stays the app mailbox. */
  organizerName?: string;
}

export interface EmailResult {
  sent: boolean;
  skipped: boolean;
}

// ponytail: one lazily-built module-level transporter, pooled — without
// `pool: true` nodemailer opens a fresh connection per message, so every mail
// paid for a TCP + TLS + AUTH round trip to Gmail. Most events send two (student
// and teacher), and a pooled socket is reused for the life of the process.
let transporter: Transporter | null = null;

function getTransport(): Transporter | null {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) return null;

  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user, pass },
      pool: true,
      maxConnections: 2,
    });
  }
  return transporter;
}

/**
 * Send one transactional email over SMTP (free Gmail SMTP works — App Password).
 * No-op (with a single warn) when SMTP credentials are absent, and never throws
 * on a transport failure — mirrors the best-effort shape of push/send.ts.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  invite?: EmailInvite,
): Promise<EmailResult> {
  const transport = getTransport();
  if (!transport) {
    console.warn('[email] SMTP_USER/SMTP_PASSWORD not set — email send is a no-op.');
    return { sent: false, skipped: true };
  }

  const from = process.env.EMAIL_FROM ?? process.env.RESEND_FROM ?? process.env.SMTP_USER;

  try {
    await transport.sendMail({
      from,
      to,
      // nodemailer builds the text/calendar alternative part itself — the shape
      // Gmail/Outlook need to show Yes/No buttons instead of an attachment.
      ...(invite && invite.events.length > 0
        ? {
            icalEvent: {
              method: invite.method,
              filename: 'invite.ics',
              content: buildIcs(invite.events, invite.method, to, {
                // Organizer must be a real mailbox or clients drop the invite,
                // and must stay identical across a series and its later
                // overrides — so it is always the app's own sending address,
                // never a teacher's. The teacher rides along as CN only.
                email: (from ?? to).replace(/^.*<|>$/g, ''),
                name: invite.organizerName,
              }),
            },
          }
        : {}),
      subject,
      html,
      // Plaintext alternative — HTML-only mail is a spam signal (esp. Outlook).
      text: htmlToText(html),
      // Gmail/Outlook both weigh a machine-readable opt-out heavily for
      // notification mail. Points at the existing email-prefs UI.
      // ponytail: link-only (no one-click POST endpoint) — add List-Unsubscribe-Post
      // only if a provider starts asking for it.
      headers: {
        'List-Unsubscribe': `<${(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hifth-companion.vercel.app').replace(/\/$/, '')}/settings>`,
      },
    });
    return { sent: true, skipped: false };
  } catch (err) {
    console.warn('[email] send failed', (err as Error).message);
    return { sent: false, skipped: false };
  }
}

// ponytail: crude tag-strip, good enough for a plaintext fallback; swap for a
// real html-to-text lib only if the plaintext ever needs to look nice.
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Keep the URL — a plaintext part with no link at all is both useless and a
    // spam signal when the HTML part is link-driven.
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Test-only: drop the cached transporter so env changes take effect. */
export function __resetTransport(): void {
  transporter = null;
}

import nodemailer, { type Transporter } from 'nodemailer';

export interface EmailResult {
  sent: boolean;
  skipped: boolean;
}

// ponytail: one lazily-built module-level transporter; nodemailer pools/reuses
// the connection itself, so no custom pooling here.
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
): Promise<EmailResult> {
  const transport = getTransport();
  if (!transport) {
    console.warn('[email] SMTP_USER/SMTP_PASSWORD not set — email send is a no-op.');
    return { sent: false, skipped: true };
  }

  try {
    await transport.sendMail({
      from: process.env.EMAIL_FROM ?? process.env.RESEND_FROM ?? process.env.SMTP_USER,
      to,
      subject,
      html,
      // Plaintext alternative — HTML-only mail is a spam signal (esp. Outlook).
      text: htmlToText(html),
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

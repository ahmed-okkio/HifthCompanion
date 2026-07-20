export interface EmailResult {
  sent: boolean;
  skipped: boolean;
}

/**
 * Send one transactional email via the Resend REST API. No SDK, plain fetch.
 * No-op (with a single warn) when RESEND_API_KEY is absent, and never throws on
 * a network/API failure — mirrors the best-effort shape of push/send.ts.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — email send is a no-op.');
    return { sent: false, skipped: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM,
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.warn('[email] send failed', res.status);
      return { sent: false, skipped: false };
    }
    return { sent: true, skipped: false };
  } catch (err) {
    console.warn('[email] send failed', (err as Error).message);
    return { sent: false, skipped: false };
  }
}

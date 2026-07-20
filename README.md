This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Email (Resend) — launch prerequisites

Circle notification emails and Supabase auth mail both go through Resend.

1. **Verify a sending domain** in the Resend dashboard and add the DNS records it
   gives you: the `MX` + `TXT` (SPF) pair on the bounce subdomain, the `TXT`
   DKIM record, and (recommended) a `_dmarc` `TXT` policy. Mail sends only after
   the domain shows *Verified*.
2. **Set the env vars** (Vercel project + Supabase, never committed):

   | Var | Value |
   | --- | --- |
   | `RESEND_API_KEY` | Resend API key (`re_...`) — used by the app's send layer |
   | `RESEND_FROM` | Sender address on the verified domain, e.g. `Hifth Companion <no-reply@yourdomain>` |
   | `SMTP_PASSWORD` | Resend API key again — Supabase auth SMTP password (`supabase/config.toml` reads it via `env(SMTP_PASSWORD)`) |

3. Update `admin_email` in `supabase/config.toml` to an address on that domain.

Without `RESEND_API_KEY` the app's sends are a logged no-op; auth mail falls back
to the built-in Supabase sender and its 2/hr cap.

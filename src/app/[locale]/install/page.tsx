import { headers } from 'next/headers';
import QRCode from 'qrcode';
import InstallGuide from '@/components/install/InstallGuide';

// Public install guide. Platform detection is client-side (InstallGuide); the
// server only renders the desktop QR code pointing back at this page.
export default async function InstallPage() {
  const h = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
  const qrSvg = await QRCode.toString(`${origin}/install`, { type: 'svg', margin: 1 });

  return <InstallGuide qrSvg={qrSvg} />;
}

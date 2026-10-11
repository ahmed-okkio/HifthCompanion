import InstallGuide from '@/components/install/InstallGuide';

// Public install guide, a static shell (PRD 0016 C2): platform detection and the desktop QR
// code are both client-side (InstallGuide), so nothing here reads headers.
export default function InstallPage() {
  return <InstallGuide />;
}

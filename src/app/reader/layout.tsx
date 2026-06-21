import ReaderShell from '@/components/ReaderShell';

export const dynamic = 'force-dynamic';

export default function ReaderLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ReaderShell>{children}</ReaderShell>;
}

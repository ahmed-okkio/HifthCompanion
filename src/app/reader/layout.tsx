import ReaderShell from '@/components/ReaderShell';

export default function ReaderLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ReaderShell>{children}</ReaderShell>;
}

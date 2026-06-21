import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ page: string }>;
}

export default async function ReaderLegacyPage({ params }: Props) {
  const { page } = await params;
  redirect(`/reader?page=${page}`);
}

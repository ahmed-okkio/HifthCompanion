import { defaultLocale, isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionaries';
import ManageScreen from '@/components/wird/ManageScreen';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return { title: getDictionary(isLocale(locale) ? locale : defaultLocale)['wird.manageTitle'] };
}

/**
 * /wird/manage — edit or delete wirds, off the daily card so the card keeps its
 * single control (H10). Static shell; data is read client-side (PRD 0016 C2/E1).
 */
export default function WirdManagePage() {
  return <ManageScreen />;
}

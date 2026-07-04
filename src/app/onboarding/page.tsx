'use client';

// Onboarding baseline screen (PRD 0008 M4, O2–O4). Login-style brand shell with
// the memorization editor. Only a Done action — no skip. Zero ranges still
// completes: saveMemorization stamps onboarded_at regardless, so the middleware
// gate stops trapping the user (O4). Middleware exempts /onboarding + gates
// non-onboarded users, so no auth/onboarded check is needed here.

import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';
import MemorizationEditor from '@/components/MemorizationEditor';
import AuthBrand from '@/components/AuthBrand';
import { saveMemorization } from '@/lib/services/profile';
import type { MemorizedRange } from '@/types';

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useI18n();

  const onSave = async (ranges: MemorizedRange[], weakest: number[]) => {
    await saveMemorization(ranges, weakest);
    router.push('/reader/1');
  };

  return (
    <div className="min-h-screen flex items-start justify-center px-4 py-10 overflow-x-hidden"
         style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-xl animate-fade-in-scale">
        {/* Brand */}
        <AuthBrand />
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('onboarding.title')}
          </h1>
        </div>

        {/* Editor */}
        <div className="card p-6 sm:p-8">
          <MemorizationEditor initialRanges={[]} saveLabel={t('onboarding.done')} onSave={onSave} />
        </div>
      </div>
    </div>
  );
}

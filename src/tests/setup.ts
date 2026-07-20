import { vi } from 'vitest';

vi.mock('@/components/I18nProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/I18nProvider')>();
  const { getDictionary } = await import('@/lib/i18n/dictionaries');
  const dict = getDictionary('en');
  return {
    ...actual,
    useI18n: () => ({
      locale: 'en',
      t: (key: string, vars?: any) => {
        let str = dict[key as keyof typeof dict] ?? key;
        if (vars) {
          for (const [k, v] of Object.entries(vars)) {
            str = (str as string).replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
          }
        }
        return str;
      },
      fmtNum: (val: string | number) => String(val),
      setLocale: vi.fn(),
    }),
  };
});

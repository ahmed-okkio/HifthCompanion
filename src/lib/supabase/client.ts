import { createBrowserClient } from '@supabase/ssr';
import { MockSupabaseClient } from './mock';

let mockClientInstance: any = null;

export function createClient() {
  const isE2E = typeof window !== 'undefined' && document.cookie.includes('x-e2e-test=true');

  if (isE2E) {
    if (!mockClientInstance) {
      const authenticated = document.cookie.includes('sb-access-token=dummy-token') || 
                            document.cookie.includes('sb-auth-token');
      mockClientInstance = new MockSupabaseClient(authenticated) as any;
    }
    return mockClientInstance;
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

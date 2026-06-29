import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ReaderNav from '../components/ReaderNav';
import { useRouter } from 'next/navigation';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(() => '/reader/1'),
  useSearchParams: vi.fn(() => new URLSearchParams('')),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  })),
}));

describe('ReaderNav', () => {
  it('renders the modern English brand and page controls', () => {
    (useRouter as any).mockReturnValue({ push: vi.fn() });
    render(<ReaderNav currentPage={1} />);
    expect(screen.getByText('Hifth Companion')).toBeDefined();
    expect(screen.getByText('Page')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('/')).toBeDefined();
    expect(screen.getByText('604')).toBeDefined();
    expect(screen.queryByText('حفظ')).toBeNull();
  });
});

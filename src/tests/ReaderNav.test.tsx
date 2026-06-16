import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ReaderNav from '../components/ReaderNav';
import { useRouter } from 'next/navigation';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  })),
}));

describe('ReaderNav', () => {
  it('renders correctly', () => {
    (useRouter as any).mockReturnValue({ push: vi.fn() });
    render(<ReaderNav currentPage={1} />);
    expect(screen.getByText(/1/)).toBeDefined();
  });
});

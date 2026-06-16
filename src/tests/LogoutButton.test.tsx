import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LogoutButton from '../components/LogoutButton';
import { useRouter } from 'next/navigation';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

describe('LogoutButton', () => {
  it('renders the button', () => {
    (useRouter as any).mockReturnValue({ push: vi.fn() });
    render(<LogoutButton />);
    expect(screen.getByRole('button', { name: /log out/i })).toBeDefined();
  });
});

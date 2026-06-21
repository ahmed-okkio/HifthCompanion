import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ShareButton from '@/components/ShareButton';

describe('ShareButton', () => {
  it('renders the share popover in a portal when opened', () => {
    render(
      <ShareButton
        userId="user-1"
        pageNum={7}
        sets={[{ id: 'set-1', name: 'Set One' }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /share/i }));

    const dialog = screen.getByRole('dialog', { name: /share link/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/share page 7/i)).toBeInTheDocument();
    expect(document.body).toContainElement(dialog);
  });
});

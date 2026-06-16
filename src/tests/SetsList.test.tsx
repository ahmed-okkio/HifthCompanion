import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SetsList from '../components/SetsList';
import * as services from '@/lib/services/annotationSets';

vi.mock('@/lib/services/annotationSets', () => ({
  createAnnotationSet: vi.fn(),
  updateAnnotationSet: vi.fn(),
  deleteAnnotationSet: vi.fn(),
}));

describe('SetsList', () => {
  const mockSets = [{ id: '1', name: 'Test Set', user_id: '1', created_at: '2026-06-16' }];

  it('renders list of sets', () => {
    render(<SetsList initialSets={mockSets} />);
    expect(screen.getByText('Test Set')).toBeDefined();
  });

  it('calls create function', async () => {
    const createMock = vi.mocked(services.createAnnotationSet).mockResolvedValue({ id: '2', name: 'New', user_id: '1', created_at: '2026-06-16' });
    render(<SetsList initialSets={[]} />);
    
    fireEvent.change(screen.getByPlaceholderText('New set name...'), { target: { value: 'New Set' } });
    fireEvent.click(screen.getByText('Create'));
    
    expect(createMock).toHaveBeenCalledWith('New Set');
  });
});

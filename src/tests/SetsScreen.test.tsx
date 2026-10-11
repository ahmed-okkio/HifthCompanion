import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SetsList } from '../components/SetsScreen';
import * as services from '@/lib/services/annotationSets';

vi.mock('@/lib/services/annotationSets', () => ({
  createAnnotationSet: vi.fn(),
  updateAnnotationSet: vi.fn(),
  deleteAnnotationSet: vi.fn(),
}));

const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

describe('SetsList', () => {
  const mockSets = [{ id: '1', name: 'Test Set', user_id: '1', created_at: '2026-06-16' }];

  it('renders list of sets', () => {
    wrap(<SetsList sets={mockSets} />);
    expect(screen.getByText('Test Set')).toBeDefined();
  });

  it('calls create function', async () => {
    const createMock = vi.mocked(services.createAnnotationSet).mockResolvedValue({ id: '2', name: 'New', user_id: '1', created_at: '2026-06-16' });
    wrap(<SetsList sets={[]} />);
    
    fireEvent.change(screen.getByPlaceholderText('New set name...'), { target: { value: 'New Set' } });
    fireEvent.click(screen.getByText('Create'));
    
    expect(createMock).toHaveBeenCalledWith('New Set');
  });
});

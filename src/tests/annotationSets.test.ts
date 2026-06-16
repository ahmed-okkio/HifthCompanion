import { describe, it, expect, vi } from 'vitest';
import { getAnnotationSets, createAnnotationSet } from '../lib/services/annotationSets';

// Mock Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [{ id: '1', name: 'Set 1' }], error: null }),
    })),
  })),
  createClientAction: vi.fn(async () => ({
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: '2', name: 'New Set' }, error: null }),
    })),
  })),
}));

describe('annotationSets service', () => {
  it('should fetch annotation sets', async () => {
    const sets = await getAnnotationSets();
    expect(sets).toHaveLength(1);
    expect(sets[0].name).toBe('Set 1');
  });

  it('should create an annotation set', async () => {
    const newSet = await createAnnotationSet('New Set');
    expect(newSet.name).toBe('New Set');
  });
});

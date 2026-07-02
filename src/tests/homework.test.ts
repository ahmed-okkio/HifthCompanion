import { describe, it, expect } from 'vitest';
import { homeworkStatus } from '../lib/homework';

describe('homeworkStatus (D10)', () => {
  const today = '2026-07-01';

  it('open when no deadline', () => {
    expect(homeworkStatus({ deadline: null }, 0, today)).toBe('open');
  });
  it('open when deadline today or future, regardless of linked logs', () => {
    expect(homeworkStatus({ deadline: today }, 0, today)).toBe('open');
    expect(homeworkStatus({ deadline: '2026-07-05' }, 3, today)).toBe('open');
  });
  it('missed when past deadline with no linked logs', () => {
    expect(homeworkStatus({ deadline: '2026-06-30' }, 0, today)).toBe('missed');
  });
  it('completed when past deadline with at least one linked log', () => {
    expect(homeworkStatus({ deadline: '2026-06-30' }, 1, today)).toBe('completed');
  });
});

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StudentAnalytics from '../components/tracker/StudentAnalytics';
import { I18nProvider } from '../components/I18nProvider';
import type { Circle, ProgressLog } from '../types';

const today = () => new Date().toISOString().slice(0, 10);

const circle: Circle = {
  id: 'h1',
  teacher_id: 't1',
  name: 'Test',
  invite_code: 'abc',
  student_statuses: [{ label: 'Done', polarity: 'positive' }],
  teacher_statuses: [
    { label: 'Excellent', polarity: 'positive' },
    { label: 'Needs work', polarity: 'negative' },
  ],
  created_at: today(),
};

function makeLog(p: Partial<ProgressLog>): ProgressLog {
  return {
    id: Math.random().toString(36).slice(2),
    membership_id: 'm1',
    log_date: today(),
    homework_id: null,
    log_type: 'memorization',
    page_start: 1,
    page_end: 1,
    surah: null,
    ayah_start: null,
    ayah_end: null,
    student_status: null,
    student_notes: null,
    teacher_status: null,
    teacher_comment: null,
    reviewed_at: null,
    created_at: today(),
    updated_at: today(),
    ...p,
  };
}

const renderPanel = (logs: ProgressLog[]) =>
  render(
    <I18nProvider locale="en">
      <StudentAnalytics circle={circle} logs={logs} />
    </I18nProvider>,
  );

describe('StudentAnalytics', () => {
  it('renders all four analytics sections', () => {
    renderPanel([]);
    expect(screen.getByText('Consistency')).toBeDefined();
    expect(screen.getByText('Needs attention')).toBeDefined();
    expect(screen.getByText('Mushaf coverage')).toBeDefined();
    expect(screen.getByText(/\/ 604/)).toBeDefined(); // pages total stat
  });

  it('shows empty weakest-surah state with no graded logs', () => {
    renderPanel([makeLog({ page_start: 2, page_end: 2 })]);
    expect(screen.getByText('No graded logs yet.')).toBeDefined();
  });

  it('lists weakest surah by name from graded negative logs', () => {
    renderPanel([
      makeLog({ surah: 2, reviewed_at: today(), teacher_status: 'Needs work' }),
    ]);
    expect(screen.getByText(/Al-Baqara/)).toBeDefined();
  });

  it('reflects cumulative page totals', () => {
    renderPanel([makeLog({ page_start: 1, page_end: 3 })]);
    expect(screen.getByText('3 / 604')).toBeDefined();
  });
});

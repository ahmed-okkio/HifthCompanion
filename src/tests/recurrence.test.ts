import { describe, it, expect } from 'vitest';
import { recurringSlots, missingSlots } from '../lib/recurrence';
import type { Recurrence } from '../types';

// Fixed Monday for determinism: 2026-06-29 is a Monday (getDay() === 1).
const MON = new Date('2026-06-29T00:00:00');

describe('recurringSlots', () => {
  it('returns [] for null rule or empty weekdays', () => {
    expect(recurringSlots(null, MON)).toEqual([]);
    expect(recurringSlots({ weekdays: [], time: '17:00' }, MON)).toEqual([]);
  });

  it('emits one slot per matching weekday in the horizon', () => {
    const rule: Recurrence = { weekdays: [1], time: '17:00' }; // Mondays
    const slots = recurringSlots(rule, MON, 14);
    expect(slots).toHaveLength(2); // two Mondays in 14 days
    expect(new Date(slots[0]).getDay()).toBe(1);
    expect(new Date(slots[0]).getHours()).toBe(17);
  });

  it('handles multiple weekdays and stays sorted', () => {
    const rule: Recurrence = { weekdays: [1, 3], time: '09:30' }; // Mon + Wed
    const slots = recurringSlots(rule, MON, 7);
    expect(slots).toHaveLength(2);
    expect(slots[0] < slots[1]).toBe(true);
    expect(new Date(slots[1]).getMinutes()).toBe(30);
  });

  it('excludes invalid weekdays and clamps malformed time to 00:00', () => {
    const rule = { weekdays: [9, 1], time: 'nope' } as Recurrence;
    const slots = recurringSlots(rule, MON, 7);
    expect(slots).toHaveLength(1);
    expect(new Date(slots[0]).getHours()).toBe(0);
  });
});

describe('missingSlots', () => {
  it('omits slots already present in existing', () => {
    const rule: Recurrence = { weekdays: [1], time: '17:00' };
    const all = recurringSlots(rule, MON, 21); // three Mondays
    const missing = missingSlots(rule, [all[0]], MON, 21);
    expect(missing).toHaveLength(2);
    expect(missing).not.toContain(all[0]);
  });

  it('is idempotent — nothing missing when all present', () => {
    const rule: Recurrence = { weekdays: [1, 4], time: '17:00' };
    const all = recurringSlots(rule, MON, 28);
    expect(missingSlots(rule, all, MON, 28)).toEqual([]);
  });
});

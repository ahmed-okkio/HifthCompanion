import type { MembershipWithCircle } from '@/lib/services/membership';

export type RailCircle = { id: string; name: string; pending: boolean; teaching: boolean };

/** Build the circle-rail list (active circles first, then pending invites) from memberships. */
export function railCircles(memberships: MembershipWithCircle[]): RailCircle[] {
  const active = memberships.filter((m) => m.status === 'active');
  const pending = memberships.filter((m) => m.status === 'pending');
  return [...active, ...pending].map((m) => ({
    id: m.circle_id,
    name: m.circle.name,
    pending: m.status === 'pending',
    teaching: m.role === 'teacher',
  }));
}

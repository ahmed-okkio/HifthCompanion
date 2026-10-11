// Query keys (PRD 0016). Mutations invalidate by prefix, e.g. qk.wird covers every wird screen.
export const qk = {
  me: ['me'] as const,
  wird: ['wird'] as const,
  wirdDaily: ['wird', 'daily'] as const,
  wirdManage: ['wird', 'manage'] as const,
  sets: ['sets'] as const,
  notes: (setId: string, page: number) => ['notes', setId, page] as const,
  // Every tracker mutation invalidates qk.tracker (src/lib/tracker/actions.ts).
  tracker: ['tracker'] as const,
  trackerRail: ['tracker', 'rail'] as const,
  trackerCovering: ['tracker', 'covering'] as const,
  trackerCircle: (circleId: string) => ['tracker', 'circle', circleId] as const,
  trackerStudent: (circleId: string, membershipId: string) => ['tracker', 'student', circleId, membershipId] as const,
};

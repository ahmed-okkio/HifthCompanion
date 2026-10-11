// Query keys (PRD 0016). Mutations invalidate by prefix, e.g. qk.wird covers every wird screen.
export const qk = {
  me: ['me'] as const,
  wird: ['wird'] as const,
  wirdDaily: ['wird', 'daily'] as const,
  wirdManage: ['wird', 'manage'] as const,
  sets: ['sets'] as const,
};

/**
 * Sk — a single shimmering placeholder block, shared by route loading.tsx skeletons.
 * Same gradient/keyframe as PageDisplayFrame's canvas skeleton (`@keyframes shimmer`).
 */
export function Sk({ w, h, r = 12, style }: { w?: number | string; h: number | string; r?: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width: w ?? '100%',
        height: h,
        borderRadius: r,
        background: 'linear-gradient(90deg, var(--neutral-100), var(--neutral-200), var(--neutral-100))',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s linear infinite',
        ...style,
      }}
    />
  );
}

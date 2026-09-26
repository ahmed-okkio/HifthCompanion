/**
 * Sk — a single shimmering placeholder block, shared by route loading.tsx skeletons.
 * Same gradient/keyframe as PageDisplayFrame's canvas skeleton (`@keyframes shimmer`).
 */
export function Sk({ w, h, r = 12, style }: { w?: number | string; h: number | string; r?: number; style?: React.CSSProperties }) {
  return (
    <div
      className="skeleton"
      // eslint-disable-next-line shadcn/no-inline-styles -- size/radius come from props
      style={{ width: w ?? '100%', height: h, borderRadius: r, ...style }}
    />
  );
}

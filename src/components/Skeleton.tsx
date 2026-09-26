/**
 * Sk — a single shimmering placeholder block, shared by route loading.tsx skeletons.
 * Same gradient/keyframe as PageDisplayFrame's canvas skeleton (`@keyframes shimmer`).
 */
export function Sk({ w, h, r = 12, style }: { w?: number | string; h: number | string; r?: number; style?: React.CSSProperties }) {
  return (
    <div
      className="bg-linear-to-r from-neutral-100 via-neutral-200 to-neutral-100 bg-size-[200%_100%] animate-[shimmer_1.4s_linear_infinite]"
      // eslint-disable-next-line shadcn/no-inline-styles -- size/radius come from props
      style={{ width: w ?? '100%', height: h, borderRadius: r, ...style }}
    />
  );
}

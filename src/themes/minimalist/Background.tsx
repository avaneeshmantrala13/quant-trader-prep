/**
 * Minimalist backdrop — deliberately near-silent and essentially empty. NO grid
 * lines (removed by request): just the flat page color and ONE thin accent rule
 * that drifts across the upper third almost imperceptibly slowly. Pure CSS
 * transforms (GPU-friendly), sits behind all content, and is rendered fully
 * static under `prefers-reduced-motion` (handled globally in index.css). No
 * shadows, gradients, grid, or texture noise.
 */
export function MinimalBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Scoped, self-contained keyframe so we never touch shared index.css. */}
      <style>{`
        @keyframes qtp-min-drift {
          0%   { transform: translate3d(0, 0, 0); opacity: 0; }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { transform: translate3d(100%, 0, 0); opacity: 0; }
        }
      `}</style>

      {/* One restrained accent rule, drifting very slowly left → right. */}
      <div className="absolute left-0 top-[26%] h-px w-1/2 overflow-visible">
        <div
          className="h-px w-full bg-accent opacity-[0.18] dark:opacity-[0.24]"
          style={{ animation: "qtp-min-drift 46s linear infinite" }}
        />
      </div>
    </div>
  );
}

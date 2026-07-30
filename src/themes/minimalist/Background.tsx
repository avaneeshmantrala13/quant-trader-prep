/**
 * Minimalist backdrop — deliberately near-silent and essentially empty. NO grid
 * lines and NO moving accent rule: just the flat page color. Sits behind all
 * content. No shadows, gradients, grid, or texture noise.
 */
export function MinimalBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    />
  );
}

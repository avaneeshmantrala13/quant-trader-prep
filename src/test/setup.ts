/**
 * Global Vitest setup — loaded via `test.setupFiles` in vite.config.ts, so it
 * runs once per test file BEFORE the suite. It exists to kill three sources of
 * jsdom test noise/flake that were previously patched ad-hoc in ~5 files:
 *
 *   1. `window.matchMedia` — jsdom doesn't implement it, but theme code,
 *      reduced-motion checks and the celebrate() confetti all call it. Without
 *      a stub any component that touches it throws on mount.
 *   2. `canvas-confetti` — a real WebGL/canvas animation with its own RAF loop.
 *      In jsdom it can't paint, and its async ticks add nondeterministic churn
 *      to the App-mount tests. We replace it with a no-op.
 *   3. `requestAnimationFrame` — jsdom's impl is a real macrotask; several
 *      count-up / tour animations schedule it. A synchronous shim makes those
 *      settle deterministically instead of leaking timers across tests.
 *
 * Plus a `cleanup()` after every test so mounted trees never bleed into the
 * next case. All of this is guarded on `typeof window` so the Node-environment
 * tests (the majority) are completely unaffected.
 */
import { afterEach, vi } from "vitest";

// (2) canvas-confetti → no-op. celebrate() becomes a safe no-op everywhere.
vi.mock("canvas-confetti", () => ({ default: () => undefined }));

if (typeof window !== "undefined") {
  // (1) matchMedia — a minimal, non-matching implementation (so
  // prefers-reduced-motion reads false and every media query is inert).
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }

  // (3) requestAnimationFrame — resolve on a microtask so animation callbacks
  // run promptly and deterministically under `act`, instead of on jsdom's
  // real timer queue (which can outlive the test and flake waitFor).
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      return setTimeout(() => cb(performance.now()), 0) as unknown as number;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id)) as typeof window.cancelAnimationFrame;
  }
}

// A mounted tree from one test must never leak into the next. Only meaningful
// in the jsdom environment; guarded so the Node-env tests skip it entirely.
afterEach(async () => {
  if (typeof document === "undefined") return;
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});

/**
 * The ordered ONBOARDING TOUR script (pure data — no React, no styling). Each
 * step is one themed coach-mark: a short title, simple body copy telling the
 * learner what to do next to best prep as a quant trader, and an optional
 * `target` hook naming the on-screen element the box anchors to.
 *
 * The tour walks the learner through the UI IN PLACE — it never navigates away
 * mid-tour. Navigation now lives behind a single hamburger MENU, so the tour
 * first points at the menu button, then anchors later steps to the individual
 * menu items (the shell reveals the menu whenever a step targets one of them —
 * see `AppShell` + `OnboardingTour.onActiveTargetChange`). A step points a small
 * arrow at the matching element (looked up via `[data-tour="<target>"]`). Steps
 * with no `target` (welcome + wrap-up) render centered, and any step whose
 * target isn't currently rendered falls back to centered gracefully.
 */

/**
 * Stable `data-tour` hooks the tour can anchor to. Each maps 1:1 to an element
 * tagged with the same token in `AppShell`: `menu` is the hamburger button, the
 * rest are items inside the menu it opens. Keep this union in sync with the
 * `data-tour` attributes rendered in the shell.
 */
export type TourTarget =
  | "menu"
  | "dashboard"
  | "probability"
  | "contents"
  | "simulations"
  | "arena"
  | "recalibrate"
  | "themes";

export interface OnboardingStep {
  /** Stable id (React key + test anchor). */
  id: string;
  /** Short headline for the box. */
  title: string;
  /** One–two plain sentences a brand-new user immediately understands. */
  body: string;
  /**
   * Optional anchor hook. When set, the overlay finds `[data-tour="<target>"]`,
   * positions the box adjacent to it, and aims an arrow at it. When omitted the
   * box renders centered (used for the welcome + wrap-up steps). Falls back to
   * centered gracefully if the target isn't currently rendered/visible. When the
   * target lives inside the hamburger menu, the shell opens the menu first.
   */
  target?: TourTarget;
}

export const ONBOARDING_TOUR_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "You're in — here's the game plan",
    body:
      "You just finished the diagnostic, which set your starting level across every topic. This quick tour shows you where to go and the order we recommend to prep like a quant trader. It takes about 30 seconds.",
  },
  {
    id: "menu",
    title: "1 · Everything lives in the menu",
    body:
      "Tap the ☰ menu button in the top-left to reach every part of the app — your Dashboard, all the topic tracks, the Speed Arena, Simulations, and Themes. We'll open it as we go.",
    target: "menu",
  },
  {
    id: "dashboard",
    title: "2 · Start at your Dashboard",
    body:
      "Your Dashboard reads your diagnostic to show your strengths, your weak spots, and the single topic to focus on next. Check it first — and come back after each session to see what moved.",
    target: "dashboard",
  },
  {
    id: "probability",
    title: "3 · Build the base in Probability & Statistics",
    body:
      "Probability is the backbone of quant interviews, so begin here. Play the recommended level, then work down the map — each level unlocks the next as you master it.",
    target: "probability",
  },
  {
    id: "tracks",
    title: "4 · Branch out across the tracks",
    body:
      "Once probability feels solid, widen out: Applied Math & Number Puzzles, Mental Math, Brainteasers, and Interview Games. The Table of Contents lists every track and lesson in one place.",
    target: "contents",
  },
  {
    id: "simulations",
    title: "5 · Make it click in Simulations",
    body:
      "Stuck on why a probability is what it is? The Simulations tab lets you flip any coin, roll any die, and drag a trials slider to watch the empirical result converge to the theory — plus Venn diagrams, the CLT, Kelly betting, Monty Hall and more. Reach for it whenever a concept feels abstract.",
    target: "simulations",
  },
  {
    id: "arena",
    title: "6 · Sharpen speed in the Speed Arena",
    body:
      "Traders have to be fast and accurate under pressure. The Speed Arena runs timed drills so your mental math becomes reflexive — do short bursts often between topic work.",
    target: "arena",
  },
  {
    id: "recalibrate",
    title: "7 · Recalibrate whenever you level up",
    body:
      "As you improve, retake the diagnostic from the Recalibrate tab. It re-reads your level so your Dashboard and recommendations always match where you actually are.",
    target: "recalibrate",
  },
  {
    id: "themes",
    title: "8 · Make it yours in Themes",
    body:
      "Switch the whole look anytime in Themes — six styles, each with light and dark mode. Pick whatever keeps you coming back to practice.",
    target: "themes",
  },
  {
    id: "done",
    title: "That's the tour — go get an edge",
    body:
      "Recommended path: Dashboard → Probability & Statistics → the other tracks → Speed Arena, using Simulations whenever a concept needs to click, and recalibrating as you grow. Need this again later? Reopen it anytime from \"Show tutorial\" up in the nav.",
  },
];

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
import type { GoalMode } from "@/types/progress";

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

/**
 * The Case-A (course-mastery) ONBOARDING TOUR script. Same SHAPE as
 * `ONBOARDING_TOUR_STEPS` above — identical step ids, order, and `target`
 * anchors so the coach-mark layout/behaviour is byte-for-byte the same — but the
 * COPY is rewritten for a learner prepping the UT courses (Intro to Probability
 * / Intro to Stochastic Processes) instead of quant-trading interviews. It drops
 * all "become a trader" framing and only references UI that exists in the Case-A
 * menu (the two course tracks, the Foundations group, the mode-aware Course
 * Readiness dashboard, Simulations, the "Beyond the course" extras, Recalibrate,
 * the mode toggle, and Themes). Anchors that Case A doesn't render (e.g. the
 * standalone Probability track) simply fall back to centered, exactly as the
 * overlay already handles a missing target.
 */
export const COURSE_ONBOARDING_TOUR_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "You're in — here's the game plan",
    body:
      "You just finished the diagnostic, which set your starting level across every topic. This quick tour shows you where to go and the order we recommend to master Intro to Probability, Intro to Stochastic Processes, or both. It takes about 30 seconds.",
  },
  {
    id: "menu",
    title: "1 · Everything lives in the menu",
    body:
      "Tap the ☰ menu button in the top-left to reach every part of the app — your Dashboard, the two course tracks, the Foundations that feed them, Simulations, and Themes. We'll open it as we go.",
    target: "menu",
  },
  {
    id: "dashboard",
    title: "2 · Start at your Dashboard",
    body:
      "Your Dashboard reads your diagnostic into Course Readiness — a card per course showing how close you are, which topics are strong or shaky, and what to study next. Check it first, and come back after each session to see what moved.",
    target: "dashboard",
  },
  {
    id: "probability",
    title: "3 · Pick your course track",
    body:
      "Open Intro to Probability or Intro to Stochastic Processes from the menu — do one, or both. Each lays out its topics in course order, and every level unlocks the next as you master it. Not sure where to start? Begin with Intro to Probability; it feeds the rest.",
    target: "probability",
  },
  {
    id: "tracks",
    title: "4 · See the whole map in the Table of Contents",
    body:
      "The Table of Contents lists every course topic and lesson in one place. Under Foundations you'll also find the Mental Math and Applied Math the courses lean on — shore those up first if the diagnostic flagged them.",
    target: "contents",
  },
  {
    id: "simulations",
    title: "5 · Make it click in Simulations",
    body:
      "Stuck on why a result is what it is? The Simulations tab lets you flip any coin, roll any die, and drag a trials slider to watch the empirical result converge to the theory — plus Venn diagrams, the CLT, and the double integral of a joint density. Reach for it whenever a course concept feels abstract.",
    target: "simulations",
  },
  {
    id: "arena",
    title: "6 · Extras live under “Beyond the course”",
    body:
      "Below the course tracks, a “Beyond the course” section keeps optional extras — Speed Arena drills, brainteasers, and puzzles. They aren't required for the courses, so treat them as a fun warm-up once your Course Readiness is looking strong.",
    target: "arena",
  },
  {
    id: "recalibrate",
    title: "7 · Recalibrate — and switch goals anytime",
    body:
      "As you improve, retake the diagnostic from the Recalibrate tab so your Course Readiness always matches where you actually are. Changing goals? Use the Course mastery / Interview prep toggle up in the header to reshape the whole app around what you're prepping for.",
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
    title: "That's the tour — go master your courses",
    body:
      "Recommended path: Dashboard → your course track (Intro to Probability and/or Intro to Stochastic Processes) → shore up Foundations as needed, using Simulations whenever a concept needs to click, and recalibrating as you grow. Need this again later? Reopen it anytime from \"Show tutorial\" up in the nav.",
  },
];

/**
 * Pick the tour script for the learner's goal mode. Case A ("course") gets the
 * course-mastery copy; everything else — including the default/undefined mode —
 * keeps the original interview/quant tour EXACTLY as it is today.
 */
export function onboardingStepsForMode(mode: GoalMode): OnboardingStep[] {
  return mode === "course"
    ? COURSE_ONBOARDING_TOUR_STEPS
    : ONBOARDING_TOUR_STEPS;
}

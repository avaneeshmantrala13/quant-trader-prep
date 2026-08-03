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
  | "games"
  | "trading-floor"
  | "arena"
  | "timed-oa"
  | "mock"
  | "verified-bank"
  | "community"
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
      "You just finished the diagnostic, which set your starting level across every topic. Two modes shape the whole app — flip the header toggle between Interview prep (where you are now) and Course mastery anytime. This 60-second tour shows you where everything lives to prep like a quant trader.",
  },
  {
    id: "menu",
    title: "1 · Everything lives in the menu",
    body:
      "Tap the ☰ menu button in the top-left to reach every part of the app — your Dashboard and Roadmap, every topic track, the Quant Games hub, the Speed Arena, Timed Sections, the Mock Interview, and more. We'll open it as we go.",
    target: "menu",
  },
  {
    id: "dashboard",
    title: "2 · Start at your Dashboard",
    body:
      "Your Dashboard reads your diagnostic to show strengths, weak spots, and the single topic to focus on next. Pair it with the Roadmap and daily Lessons — start here, and come back after each session to see what moved.",
    target: "dashboard",
  },
  {
    id: "probability",
    title: "3 · Build the base in Probability",
    body:
      "Probability is the backbone of quant interviews, so begin here. Play the recommended level, then work down the map — each level unlocks the next as you master it.",
    target: "probability",
  },
  {
    id: "tracks",
    title: "4 · Branch out across the tracks",
    body:
      "Once probability feels solid, widen out: Applied Math, Mental Math, Brainteasers, and Interview Games. The Table of Contents lists every track and lesson in one place.",
    target: "contents",
  },
  {
    id: "simulations",
    title: "5 · Make it click in Simulations",
    body:
      "Stuck on why a probability is what it is? Simulations lets you flip any coin, roll any die, and drag a trials slider to watch the empirical result converge to the theory — plus Venn diagrams, the CLT, Kelly betting, and Monty Hall. Reach for it whenever a concept feels abstract.",
    target: "simulations",
  },
  {
    id: "games",
    title: "6 · Compete in the Quant Games hub",
    body:
      "The Quant Games hub gathers the competitive market-making and betting games — make-market, market-of-cards, probability betting, fruit market, dice & cards, next-card betting, and more. Their scores feed the unified Leaderboard, reachable right from the hub, where you rank against everyone across every game plus the Trading Floor and Speed Arena.",
    target: "games",
  },
  {
    id: "trading-floor",
    title: "7 · Take a seat on the Trading Floor",
    body:
      "The Trading Floor is a live market simulation: quote two-sided prices, manage your inventory, and react as the market moves. It's the closest thing to a real trading seat — and it feeds the Leaderboard too.",
    target: "trading-floor",
  },
  {
    id: "arena",
    title: "8 · Sharpen speed in the Speed Arena",
    body:
      "Traders must be fast and accurate under pressure. The Speed Arena runs timed mental-math drills so your reflexes sharpen — and its weak-spot mode zeroes in on exactly the topics your Dashboard flags as shaky.",
    target: "arena",
  },
  {
    id: "timed",
    title: "9 · Prove it under time in Timed Sections",
    body:
      "Timed Sections mirror real online-assessment formats under the clock. The pool is fed by focused drills — Arbitrage & De-vig, EV Under Time, plus sequences and auctions content — so practice each drill, then test yourself against the timer.",
    target: "timed-oa",
  },
  {
    id: "mock",
    title: "10 · Rehearse with the AI Mock Interview",
    body:
      "The AI Mock Interview runs a realistic interview you answer by voice or by typing. It probes your reasoning, follows up, and gives feedback — the best rehearsal before the real thing.",
    target: "mock",
  },
  {
    id: "verified-bank",
    title: "11 · Trust the Verified Bank",
    body:
      "The Verified Bank is a curated set of vetted, real interview questions with trusted solutions. Reach for it when you want signal you can rely on rather than crowd-sourced guesses.",
    target: "verified-bank",
  },
  {
    id: "community",
    title: "12 · Learn from the Community",
    body:
      "The Community is real-user content — experience reports, discussions, and shared solutions, all moderated for quality. Learn from others' interviews, and contribute your own once you've been through the gauntlet.",
    target: "community",
  },
  {
    id: "recalibrate",
    title: "13 · Recalibrate whenever you level up",
    body:
      "As you improve, retake the diagnostic from Recalibrate so your Dashboard always matches where you actually are. And remember the header toggle — switch between Interview prep and Course mastery whenever your goal changes.",
    target: "recalibrate",
  },
  {
    id: "themes",
    title: "14 · Make it yours in Themes",
    body:
      "Switch the whole look anytime in Themes — six styles, each with light and dark mode. Pick whatever keeps you coming back to practice.",
    target: "themes",
  },
  {
    id: "done",
    title: "That's the tour — go get an edge",
    body:
      "Recommended path: Dashboard → Probability → the other tracks, sharpening in the Quant Games hub, Speed Arena, and Trading Floor, then proving it under time in Timed Sections and the Mock Interview. Need this again later? Reopen it anytime from \"Show tutorial\" up in the nav.",
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
      "You just finished the diagnostic, which set your starting level across every topic. Two modes shape the whole app — flip the header toggle between Course mastery (where you are now) and Interview prep anytime. This 60-second tour shows you where everything lives to master Intro to Probability, Intro to Stochastic Processes, or both.",
  },
  {
    id: "menu",
    title: "1 · Everything lives in the menu",
    body:
      "Tap the ☰ menu button in the top-left to reach every part of the app — your Dashboard, the two course tracks, the Foundations that feed them, Simulations, and the optional extras under Beyond the course. We'll open it as we go.",
    target: "menu",
  },
  {
    id: "dashboard",
    title: "2 · Start at your Dashboard",
    body:
      "Your Dashboard reads your diagnostic into Course Readiness — a card per course showing how close you are, which topics are strong or shaky, and what to study next. Pair it with the Roadmap and daily Lessons; start here and come back after each session to see what moved.",
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
      "Stuck on why a result is what it is? Simulations lets you flip any coin, roll any die, and drag a trials slider to watch the empirical result converge to the theory — plus Venn diagrams, the CLT, and the double integral of a joint density. Reach for it whenever a course concept feels abstract.",
    target: "simulations",
  },
  {
    id: "games",
    title: "6 · Optional: the Games hub",
    body:
      "Beyond the course, a Games hub gathers optional competitive market-making and betting games — make-market, market-of-cards, probability betting, fruit market, dice & cards, next-card betting, and more. Their scores feed a unified Leaderboard reachable from the hub, ranking every game plus the Trading Floor and Speed Arena. Treat these as fun warm-ups once your Course Readiness is looking strong.",
    target: "games",
  },
  {
    id: "trading-floor",
    title: "7 · Optional: the Trading Floor",
    body:
      "The Trading Floor is an optional live market simulation — quote two-sided prices, manage inventory, and react as the market moves. It isn't required for the courses, so treat it as a challenge once your Course Readiness is strong. It also feeds the Leaderboard.",
    target: "trading-floor",
  },
  {
    id: "arena",
    title: "8 · Optional: the Speed Arena",
    body:
      "Under Beyond the course, the Speed Arena runs optional timed mental-math drills to sharpen your reflexes, and its weak-spot mode targets exactly the topics your Course Readiness flags as shaky. Not required for the courses — just a fun way to stay sharp.",
    target: "arena",
  },
  {
    id: "timed",
    title: "9 · Optional: Timed Sections",
    body:
      "Also beyond the course: Timed Sections mirror timed online-assessment formats, fed by focused drills — Arbitrage & De-vig, EV Under Time, plus sequences and auctions content. Purely optional, but a good stress-test once the course material feels solid.",
    target: "timed-oa",
  },
  {
    id: "mock",
    title: "10 · Optional: the AI Mock Interview",
    body:
      "The AI Mock Interview is an optional rehearsal you answer by voice or by typing; it probes your reasoning and gives feedback. Not needed for the courses, but handy if you ever want to test yourself out loud.",
    target: "mock",
  },
  {
    id: "verified-bank",
    title: "11 · Optional: the Verified Bank",
    body:
      "The Verified Bank is an optional, curated set of vetted questions with trusted solutions. Reach for it when you want reliable practice beyond the course material.",
    target: "verified-bank",
  },
  {
    id: "community",
    title: "12 · Optional: the Community",
    body:
      "The Community is optional real-user content — experience reports, discussions, and shared solutions, all moderated for quality. A place to compare notes with other learners once you're rolling.",
    target: "community",
  },
  {
    id: "recalibrate",
    title: "13 · Recalibrate — and switch goals anytime",
    body:
      "As you improve, retake the diagnostic from Recalibrate so your Course Readiness always matches where you actually are. Changing goals? Use the Course mastery / Interview prep toggle up in the header to reshape the whole app around what you're prepping for.",
    target: "recalibrate",
  },
  {
    id: "themes",
    title: "14 · Make it yours in Themes",
    body:
      "Switch the whole look anytime in Themes — six styles, each with light and dark mode. Pick whatever keeps you coming back to practice.",
    target: "themes",
  },
  {
    id: "done",
    title: "That's the tour — go master your courses",
    body:
      "Recommended path: Dashboard → your course track (Intro to Probability and/or Intro to Stochastic Processes) → shore up Foundations as needed, using Simulations whenever a concept needs to click, and treating everything under Beyond the course as optional extras. Need this again later? Reopen it anytime from \"Show tutorial\" up in the nav.",
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

import type { GoalMode } from "@/types/progress";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import { TRACKS } from "@/content";
import { isCourseTopic } from "./courseMap";

/**
 * MODE → FEATURE / NAV / DASHBOARD VISIBILITY (WS0).
 *
 * The single knob for how a goalMode reprojects the app: navigation grouping,
 * which features are prominent vs collapsed to "beyond the course", the
 * dashboard focus, and the Case-B "Extra Relevant Knowledge" display grouping.
 *
 * Decision D3 (aggressiveness): Case A NEVER fully hides quant-only competitive
 * content — it stays VISIBLE but de-emphasized under a "beyond the course"
 * group. The only thing that truly toggles on/off is the Case-B "Extra Relevant
 * Knowledge" display category (a projection over the seven first-class topics).
 */

/* -------------------------------------------------------------------------- */
/*  Feature visibility / emphasis                                             */
/* -------------------------------------------------------------------------- */

export type FeatureKey =
  | "speed-arena"
  | "interview-games"
  | "market-making-sims"
  | "trading-floor"
  | "fermi"
  | "timing"
  | "betting-kelly"
  | "game-theory"
  | "double-integral-sim"
  | "extra-relevant-knowledge";

/** Quant-only competitive features collapsed to "beyond the course" in Case A. */
const QUANT_ONLY: FeatureKey[] = [
  "speed-arena",
  "interview-games",
  "market-making-sims",
  "trading-floor",
  "fermi",
  "timing",
  "betting-kelly",
  "game-theory",
];

/**
 * Is a feature shown AT ALL in this mode? Almost everything is visible in both
 * modes (Case A de-emphasizes rather than hides). The one exception is the
 * Case-B "Extra Relevant Knowledge" display grouping, which only exists in
 * interview mode (in course mode those seven topics are first-class course
 * topics instead).
 */
export function isFeatureVisible(mode: GoalMode, feature: FeatureKey): boolean {
  if (feature === "extra-relevant-knowledge") return mode === "interview";
  return true;
}

export type FeatureEmphasis = "prominent" | "beyond";

/**
 * How prominently a visible feature is surfaced. Case B ≈ today: quant features
 * are prominent and the double-integral sim is shown-but-not-emphasized. Case A:
 * quant-only competitive content is de-emphasized to "beyond", while the
 * double-integral sim becomes a first-class course feature.
 */
export function featureEmphasis(
  mode: GoalMode,
  feature: FeatureKey,
): FeatureEmphasis {
  if (mode === "interview") {
    return feature === "double-integral-sim" ? "beyond" : "prominent";
  }
  if (feature === "double-integral-sim") return "prominent";
  if (QUANT_ONLY.includes(feature)) return "beyond";
  return "prominent";
}

/** Convenience: is a visible feature emphasized (prominent) in this mode? */
export function isFeatureEmphasized(
  mode: GoalMode,
  feature: FeatureKey,
): boolean {
  return featureEmphasis(mode, feature) === "prominent";
}

/* -------------------------------------------------------------------------- */
/*  Extra Relevant Knowledge (Case B display grouping)                        */
/* -------------------------------------------------------------------------- */

/**
 * DISPLAY label for the seven first-class course-completeness topics when Case B
 * groups them together. The underlying content `section`s are NEVER renamed —
 * this label is resolved by the projection only.
 */
export const EXTRA_RELEVANT_KNOWLEDGE_LABEL = "Extra Relevant Knowledge";

/** The seven topicKeys Case B displays under "Extra Relevant Knowledge". */
export const EXTRA_RELEVANT_KNOWLEDGE_TOPIC_KEYS: string[] = [
  topicKeyOf("probability", "Moment Generating Functions"),
  topicKeyOf("probability", "Gamma Distribution"),
  topicKeyOf("probability", "Joint Distributions"),
  topicKeyOf("probability", "Limit Theorems"),
  topicKeyOf("probability", "Branching Processes"),
  topicKeyOf("probability", "Continuous-Time Markov Chains"),
  topicKeyOf("probability", "Markov Chain Structure"),
];

const ERK_SET = new Set(EXTRA_RELEVANT_KNOWLEDGE_TOPIC_KEYS);

/** True when a topic is one of the seven ex-ERK course-completeness topics. */
export function isExtraRelevantKnowledge(topicKey: string): boolean {
  return ERK_SET.has(topicKey);
}

/* -------------------------------------------------------------------------- */
/*  Topic categorisation (nav / dashboard grouping + gating priority)          */
/* -------------------------------------------------------------------------- */

/** Foundations / prerequisite topics (Mental Math + the math-questions spine). */
export const FOUNDATION_TOPIC_KEYS: string[] = [
  topicKeyOf("mental-math"),
  topicKeyOf("math-questions", "Rates, Algebra & Word Problems"),
  topicKeyOf("math-questions", "Number Theory & Counting"),
  topicKeyOf("math-questions", "Geometry & Derivations"),
];

/** Quant-only competitive topics collapsed to "beyond the course" in Case A. */
export const BEYOND_TOPIC_KEYS: string[] = [
  topicKeyOf("probability", "Betting & Sizing"),
  topicKeyOf("probability", "Game Theory & Puzzles"),
  topicKeyOf("interview-games"),
  topicKeyOf("brainteasers", "Core Puzzles"),
  topicKeyOf("brainteasers", "Techniques Toolkit"),
];

const FOUNDATION_SET = new Set(FOUNDATION_TOPIC_KEYS);

export type TopicCategory = "course" | "foundation" | "beyond";

/**
 * Coarse projection category for a topic (drives Case-A grouping + gating
 * priority). Course topics first, then foundations, then beyond-the-course.
 * Mode-independent structurally; consumers decide how to emphasize per mode.
 */
export function topicCategory(topicKey: string): TopicCategory {
  if (isCourseTopic(topicKey)) return "course";
  if (FOUNDATION_SET.has(topicKey)) return "foundation";
  return "beyond";
}

/**
 * Gating / focus PRIORITY for a topic in a given mode (lower = surfaced first).
 * Case A prioritizes course topics, then foundations, then beyond. Case B keeps
 * the current interview ordering (foundations floor + spine first, beyond last),
 * so the existing readiness/weakness ordering is unchanged.
 */
export function gatingPriority(mode: GoalMode, topicKey: string): number {
  const cat = topicCategory(topicKey);
  if (mode === "course") {
    return cat === "course" ? 0 : cat === "foundation" ? 1 : 2;
  }
  // Case B ≈ today: foundations floor first, then course/spine, beyond last.
  return cat === "foundation" ? 0 : cat === "course" ? 1 : 2;
}

/* -------------------------------------------------------------------------- */
/*  Dashboard focus                                                           */
/* -------------------------------------------------------------------------- */

export type DashboardFocus = "courses" | "weaknesses";

/** The dashboard's primary framing: course-readiness (A) vs weakness ranking (B). */
export function dashboardFocus(mode: GoalMode): DashboardFocus {
  return mode === "course" ? "courses" : "weaknesses";
}

/* -------------------------------------------------------------------------- */
/*  Navigation                                                                */
/* -------------------------------------------------------------------------- */

export interface NavItem {
  to: string;
  label: string;
  end: boolean;
  /** Onboarding-tour anchor hook (unchanged from today's AppShell). */
  tour?: string;
  /** Case-A de-emphasis marker for "beyond the course" items. */
  emphasis?: "beyond";
}

/**
 * A COLLAPSIBLE navigation SUBSECTION. Every group now carries a stable `id`
 * (used as the React key and the localStorage persistence key for its
 * expand/collapse state), a short `heading`, and a `defaultOpen` flag that
 * decides the initial expanded state when the user has no saved preference.
 * Groups flagged `emphasis: "beyond"` are the optional, quant-heavy sections a
 * Case-A (course) learner can safely treat as extra-curricular — they render
 * de-emphasized and start collapsed.
 */
export interface NavGroup {
  /** Stable id: React key + localStorage expand/collapse persistence key. */
  id: string;
  /** Section heading rendered on the collapsible group header. */
  heading: string;
  items: NavItem[];
  /** Initial expanded state when the user has no saved preference. */
  defaultOpen: boolean;
  /** Case-A de-emphasis marker for optional "beyond the course" groups. */
  emphasis?: "beyond";
}

/** A track link, mirroring today's AppShell `TRACKS.map`. */
function trackItem(id: string, extra?: Partial<NavItem>): NavItem {
  const t = TRACKS.find((x) => x.id === id);
  return {
    to: `/track/${id}`,
    label: t?.title ?? id,
    end: false,
    tour: id === "probability" ? "probability" : undefined,
    ...extra,
  };
}

/**
 * The Case-B (interview) navigation — the full flat menu reorganised into
 * logical, collapsible SUBSECTIONS so the growing feature set no longer forces
 * the learner to scroll one long list. The Leaderboard and Community surfaces
 * are intentionally NOT advertised here (their routes/libs still exist for a
 * future re-enable — see App.tsx and src/lib/{leaderboard,community}) — the menu
 * simply doesn't link them.
 */
function interviewNav(): NavGroup[] {
  return [
    {
      id: "overview",
      heading: "Overview",
      defaultOpen: true,
      items: [
        { to: "/", label: "Home", end: true },
        { to: "/dashboard", label: "Dashboard", end: false, tour: "dashboard" },
        { to: "/roadmap", label: "Roadmap", end: false },
      ],
    },
    {
      id: "learn",
      heading: "Learn",
      defaultOpen: true,
      items: [
        {
          to: "/contents",
          label: "Table of Contents",
          end: false,
          tour: "contents",
        },
        ...TRACKS.map((t) => trackItem(t.id)),
        {
          to: "/simulations",
          label: "Simulations",
          end: false,
          tour: "simulations",
        },
      ],
    },
    {
      id: "practice",
      heading: "Practice",
      defaultOpen: true,
      items: [
        { to: "/oa", label: "Timed Sections", end: false, tour: "timed-oa" },
        { to: "/arena", label: "Speed Arena", end: false, tour: "arena" },
        { to: "/arbitrage", label: "Arbitrage & De-vig", end: false },
        { to: "/ev-timed", label: "EV Under Time", end: false },
        { to: "/fermi", label: "Fermi Drill", end: false },
        { to: "/drill", label: "Custom Drill", end: false },
      ],
    },
    {
      id: "games",
      heading: "Games",
      defaultOpen: false,
      items: [
        { to: "/games", label: "Quant Games", end: false, tour: "games" },
        {
          to: "/trading-floor",
          label: "The Trading Floor",
          end: false,
          tour: "trading-floor",
        },
      ],
    },
    {
      id: "interview-prep",
      heading: "Interview Prep",
      defaultOpen: true,
      items: [
        { to: "/mock", label: "Mock Interview", end: false, tour: "mock" },
      ],
    },
  ];
}

/**
 * The Case-A (course) navigation — a cleanly COURSE-SCOPED menu. It surfaces
 * only what is genuinely relevant to mastering the two UT probability courses:
 * the Overview (Home / Dashboard / Roadmap), the two Courses + shared
 * Simulations, the math Foundations the courses lean on, and Settings.
 *
 * Quant-interview-only surfaces (Speed Arena, Timed Sections, the market-making
 * Games hub, the Trading Floor, the Leaderboard, the Mock Interview, the
 * Verified Bank, the Community, and the quant-only tracks/topics: Fermi,
 * Arbitrage, EV-under-time, Custom Drill, Interview Games, Brainteasers, and the
 * Betting/Game-Theory probability sub-topics) are DELIBERATELY absent from this
 * menu. They are not deleted — the routes still work and the mode toggle still
 * reveals them under Interview prep — course mode simply doesn't advertise them.
 * `QUANT_ONLY_ROUTES` is the single source of truth for that exclusion set (and
 * is enforced by `visibility.test.ts`).
 */
function courseNav(): NavGroup[] {
  return [
    {
      id: "overview",
      heading: "Overview",
      defaultOpen: true,
      items: [
        { to: "/", label: "Home", end: true },
        { to: "/dashboard", label: "Dashboard", end: false, tour: "dashboard" },
        { to: "/roadmap", label: "Roadmap", end: false },
      ],
    },
    {
      id: "courses",
      heading: "Courses",
      defaultOpen: true,
      items: [
        {
          to: "/contents",
          label: "Table of Contents",
          end: false,
          tour: "contents",
        },
        {
          to: "/course/m362k",
          label: "Intro to Probability",
          end: false,
          tour: "probability",
        },
        {
          to: "/course/m362m",
          label: "Intro to Stochastic Processes",
          end: false,
        },
        {
          to: "/simulations",
          label: "Simulations",
          end: false,
          tour: "simulations",
        },
      ],
    },
    {
      id: "foundations",
      heading: "Foundations",
      defaultOpen: true,
      items: [
        trackItem("mental-math"),
        trackItem("math-questions"),
      ],
    },
  ];
}

/* -------------------------------------------------------------------------- */
/*  Canonical mode-scoping route sets (single source of truth for tests)       */
/* -------------------------------------------------------------------------- */

/**
 * QUANT-ONLY discovery surfaces: routes/tracks that the INTERVIEW menu may link
 * but the COURSE menu must never advertise. These stay fully reachable (the
 * routes exist and the mode toggle reveals them) — course mode just doesn't
 * surface them. Route bases are compared ignoring any `?query` (a `/track/...`
 * deep-link with a `?topic=` is still the same nav surface).
 */
export const QUANT_ONLY_ROUTES: string[] = [
  "/oa",
  "/arena",
  "/arbitrage",
  "/ev-timed",
  "/fermi",
  "/drill",
  "/games",
  "/trading-floor",
  "/mock",
  "/track/interview-games",
  "/track/brainteasers",
];

/**
 * COURSE-ONLY discovery surfaces: the two course-framed table-of-contents pages
 * that only make sense in course mode and must never leak into the interview
 * menu. (The underlying probability content is still reachable in interview mode
 * via the shared `/track/probability` track.)
 */
export const COURSE_ONLY_ROUTES: string[] = [
  "/course/m362k",
  "/course/m362m",
];

/** Every nav-item route in a mode's menu, normalised to its `?query`-less base. */
export function navRouteBases(mode: GoalMode): string[] {
  return navFor(mode).flatMap((g) => g.items.map((i) => i.to.split("?")[0]));
}

/** Mode-aware navigation groups for the AppShell menu. */
export function navFor(mode: GoalMode): NavGroup[] {
  return mode === "course" ? courseNav() : interviewNav();
}

/* -------------------------------------------------------------------------- */
/*  GUIDED PIPELINE strip-down config (Phase P1 — PREPARED, NOT YET ACTIVE)    */
/* -------------------------------------------------------------------------- */

/**
 * The guided pipeline (spec §2 / §7) collapses the whole free-roam shell to a
 * single persistent layout: one "Your Next Task" area, a read-only Progress /
 * Roadmap panel, a compact 8-step stepper, and Sign out + a light/dark toggle.
 * There is NO free navigation — the stage router (`RequirePipelineStage`) is the
 * sole navigation authority — so the guided shell exposes NO `NavGroup` menu.
 *
 * IMPORTANT (sequencing): this config is ADDITIVE and DORMANT. `navFor()` above
 * is still the live nav in P1 (the free-roam pages still exist and are the sole
 * runtime authority until the integration phase flips `PIPELINE_ENABLED`). The
 * exports below merely DOCUMENT the exact cutover so a later phase can hide the
 * free-roam routes without re-deriving the list. See `datasets/PIPELINE_CUTOVER.md`.
 */

/**
 * The guided shell has no traditional side-nav. Returns an EMPTY nav so a caller
 * that (in the cutover) swaps `navFor` for `guidedNavFor` renders no free-roam
 * menu — the stepper + Progress panel replace it entirely (spec §2).
 */
export function guidedNavFor(_mode: GoalMode): NavGroup[] {
  return [];
}

/**
 * The exact free-roam route BASES the integration phase will HIDE from the shell
 * when it flips `PIPELINE_ENABLED` on (spec §7.1). The underlying route/page/
 * engine files are NEVER deleted — several are reused INTERNALLY by stage
 * screens (e.g. the lesson player by the drilling loop, the mock runner by the
 * mock stage) — they are simply not user-navigable once the guided flow owns
 * navigation. This is the single source of truth for that hide-set so the
 * cutover (and its tests) never drift from the plan.
 */
export const GUIDED_HIDDEN_ROUTES: string[] = [
  // Overview / hubs (replaced by the in-loop Progress panel + stepper)
  "/dashboard",
  "/roadmap",
  "/contents",
  "/simulations",
  // Games hub + individual game pages + trading floor (Stage 4 reuses engines)
  "/games",
  "/make-market",
  "/probability-betting",
  "/cards-market-making",
  "/market-of-cards",
  "/fruit-market",
  "/dice-and-cards",
  "/next-card-betting",
  "/trading-floor",
  // Tracks / courses / lessons player (drilling loop reuses the lesson player)
  "/track",
  "/course",
  "/review",
  // Standalone drills (engines reused by the diagnosis / drilling stages)
  "/arena",
  "/oa",
  "/arbitrage",
  "/ev-timed",
  "/fermi",
  "/drill",
  // Cognitive assessment cluster
  "/numberlogic",
  "/beat-the-odds",
  "/stockmaster",
  "/number-box",
  "/shape-shift",
  // Mock hub (Stage 7 reuses the mock runner internally)
  "/mock",
];

/**
 * The routes the guided shell KEEPS reachable at cutover: auth + the pipeline
 * stage routes (`/pipeline/*`, owned by `RequirePipelineStage`) + the landing /
 * login entry points. Everything else in {@link GUIDED_HIDDEN_ROUTES} is hidden
 * from navigation (but importable for internal reuse).
 */
export const GUIDED_KEPT_ROUTES: string[] = ["/", "/login", "/pipeline"];

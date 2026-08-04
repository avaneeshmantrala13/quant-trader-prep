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
 * the learner to scroll one long list. Every route and every `data-tour` anchor
 * from the old flat menu is preserved (just regrouped), and the unified
 * Leaderboard is now a first-class nav item under Games.
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
        { to: "/leaderboard", label: "Leaderboard", end: false },
      ],
    },
    {
      id: "interview-prep",
      heading: "Interview Prep",
      defaultOpen: true,
      items: [
        { to: "/mock", label: "Mock Interview", end: false, tour: "mock" },
        {
          to: "/verified-bank",
          label: "Verified Bank",
          end: false,
          tour: "verified-bank",
        },
      ],
    },
    {
      id: "community",
      heading: "Community",
      defaultOpen: false,
      items: [
        { to: "/community", label: "Community", end: false, tour: "community" },
      ],
    },
    {
      id: "settings",
      heading: "Settings",
      defaultOpen: false,
      items: [
        {
          to: "/diagnostic",
          label: "Recalibrate",
          end: false,
          tour: "recalibrate",
        },
        { to: "/themes", label: "Themes", end: false, tour: "themes" },
      ],
    },
  ];
}

/**
 * The Case-A (course) navigation — the course-relevant subsections (Overview,
 * Courses, Foundations) stay prominent and expanded, while the quant-heavy
 * competitive content keeps its "beyond the course" framing: those groups are
 * marked `emphasis: "beyond"` (de-emphasized, visible-not-hidden) and collapsed
 * by default. Every Case-A route and `data-tour` anchor is preserved; the
 * Leaderboard is added under the (optional) Games group.
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
        { to: "/course/m362k", label: "Intro to Probability", end: false },
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
        trackItem("mental-math", { emphasis: "beyond" }),
        trackItem("math-questions", { emphasis: "beyond" }),
      ],
    },
    {
      id: "extra-topics",
      heading: "Beyond the course",
      defaultOpen: false,
      emphasis: "beyond",
      items: [
        {
          to: "/track/probability?topic=betting-and-sizing",
          label: "Betting & Sizing (Kelly)",
          end: false,
          emphasis: "beyond",
        },
        {
          to: "/track/probability?topic=game-theory-and-puzzles",
          label: "Game Theory & Puzzles",
          end: false,
          emphasis: "beyond",
        },
        trackItem("interview-games", { emphasis: "beyond" }),
        trackItem("brainteasers", { emphasis: "beyond" }),
      ],
    },
    {
      id: "practice",
      heading: "Practice",
      defaultOpen: false,
      emphasis: "beyond",
      items: [
        {
          to: "/arena",
          label: "Speed Arena",
          end: false,
          tour: "arena",
          emphasis: "beyond",
        },
        {
          to: "/arbitrage",
          label: "Arbitrage & De-vig",
          end: false,
          emphasis: "beyond",
        },
        { to: "/ev-timed", label: "EV Under Time", end: false, emphasis: "beyond" },
        { to: "/fermi", label: "Fermi Drill", end: false, emphasis: "beyond" },
        { to: "/drill", label: "Custom Drill", end: false, emphasis: "beyond" },
      ],
    },
    {
      id: "games",
      heading: "Games",
      defaultOpen: false,
      emphasis: "beyond",
      items: [
        {
          to: "/games",
          label: "Quant Games",
          end: false,
          tour: "games",
          emphasis: "beyond",
        },
        {
          to: "/trading-floor",
          label: "The Trading Floor",
          end: false,
          tour: "trading-floor",
          emphasis: "beyond",
        },
        { to: "/leaderboard", label: "Leaderboard", end: false, emphasis: "beyond" },
      ],
    },
    {
      id: "interview-prep",
      heading: "Interview Prep",
      defaultOpen: false,
      emphasis: "beyond",
      items: [
        {
          to: "/mock",
          label: "Mock Interview",
          end: false,
          tour: "mock",
          emphasis: "beyond",
        },
        {
          to: "/verified-bank",
          label: "Verified Bank",
          end: false,
          tour: "verified-bank",
          emphasis: "beyond",
        },
      ],
    },
    {
      id: "community",
      heading: "Community",
      defaultOpen: false,
      emphasis: "beyond",
      items: [
        {
          to: "/community",
          label: "Community",
          end: false,
          tour: "community",
          emphasis: "beyond",
        },
      ],
    },
    {
      id: "settings",
      heading: "Settings",
      defaultOpen: false,
      items: [
        {
          to: "/diagnostic",
          label: "Recalibrate",
          end: false,
          tour: "recalibrate",
        },
        { to: "/themes", label: "Themes", end: false, tour: "themes" },
      ],
    },
  ];
}

/** Mode-aware navigation groups for the AppShell menu. */
export function navFor(mode: GoalMode): NavGroup[] {
  return mode === "course" ? courseNav() : interviewNav();
}

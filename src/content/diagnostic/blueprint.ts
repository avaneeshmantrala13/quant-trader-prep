import type { Difficulty } from "@/types/content";
import type { GoalMode } from "@/types/progress";
import { topicKeyOf } from "@/lib/mastery/topicKey";

/**
 * Content-balanced blueprint for the required-once onboarding diagnostic
 * (PHASE_3 §4/§5 + the approved redesign).
 *
 * Research anchor: a content-balanced blueprint with ~2 items/topic across the
 * core topics is the standard cold-start floor (2 items/topic is a sensible
 * minimum; a balanced blueprint prevents over-sampling one skill). Each slot
 * re-uses an EXISTING quiz-mode OR numeric-mode topic generator (no new
 * question content) so the trap distractors ARE the misconception probes
 * (RESEARCH_ASSESSMENT §1.9, §3), numeric levels are surfaced as MCQ by
 * turning their authored `commonErrors` into distractors (see `items.ts`).
 *
 * The redesign raises quality to ~8 always-on-topic × 2 items plus a GATED
 * Markov probe (shown only when the Conditional-Probability item was answered
 * correctly) and an adaptive tiebreak 3rd item on any topic whose two items
 * split (both injected at runtime by `run.ts`). Pelánek spillover stays OFF.
 */

export interface DiagnosticSlot {
  /** `topicKeyOf(trackId, section)`, the Phase-1 mastery bucket this seeds. */
  topicKey: string;
  trackId: string;
  /** Source level whose (quiz- or numeric-mode) generator/pool we sample. */
  levelId: string;
  /** Items drawn for this topic (default 2). */
  itemsPerTopic: number;
  /** Tier the first item is assigned; item 2 bumps via `nextTier`. */
  startTier: Difficulty;
  /** Human-friendly topic name (UI + content-review blueprint). */
  label: string;
  /** The specific trap/misconception this topic's items probe (for review). */
  probes: string;
  /**
   * AUTHORED misconception tag for this topic. Used as the misconception key on
   * a miss when the source item carries no per-choice `misconceptions[i]` tag,
   * so the seeded key is meaningful for later remediation (never the anonymous
   * `idx:<i>` fallback). Namespaced downstream via `misconceptionKey`.
   */
  misconceptionTag: string;
  /**
   * When set, this slot is GATED: its items are only shown (and only seeded)
   * when the FIRST item of the slot whose `topicKey === gatedOnTopicKey` was
   * answered correctly. Used for the Markov probe (gated on Conditional).
   */
  gatedOnTopicKey?: string;
}

/**
 * COMPREHENSIVE MULTISTAGE BLUEPRINT (redesign, ≤ 30 items).
 *
 * Goal: probe EVERY MCQ-able topic family across the skill graph
 * (`src/lib/roadmap/skillGraph.ts`), 15 of the 17 mastery topics; the two
 * Brainteasers topics are flashcard/integrity-only and cannot be surfaced as
 * MCQ, while staying strictly under 31 items. Two stages keep it efficient:
 *
 *  1. BASE breadth pass (8 always-on slots, 14 items): the Tier-0/Tier-1 core
 *     plus Expected Value and the Interview-Games decision genre. Core
 *     Probability is the ROUTER whose first items set the global starting tier.
 *  2. GATED depth pass (7 slots, 9 items): each advanced/derived topic is shown
 *     ONLY when its PREREQUISITE passed, exactly the prerequisite edges of the
 *     skill graph (Geometric←CoreProb; OrderStats/Variance/Betting←EV;
 *     Markov←Conditional; GameTheory←InterviewGames; Geometry←Rates/Algebra).
 *     A failed-prereq topic is honestly left un-seeded (roadmap shows it as
 *     not-started) instead of spending items on it.
 *
 * `run.ts` also injects an adaptive TIEBREAK 3rd item on any 2-item BASE slot
 * whose two items split. Worst case = 14 base + 9 gated-all-open + 6 tiebreaks
 * (six 2-item base slots) = 29 items, under the 31 cap. Nominal (base + all
 * gated, no tiebreaks) = 23. Fresh questions every attempt (unchanged).
 *
 * The base slots come first (indices 0–7) so `buildDiagnosticPlan` materializes
 * them directly; gated slots follow (8–14) and are injected by the follow-up
 * plan. Each slot re-uses an EXISTING quiz- or numeric-mode generator/pool (no
 * new question content); numeric levels are surfaced as MCQ via their authored
 * `commonErrors` (see `items.ts`).
 */
export const DIAGNOSTIC_BLUEPRINT: DiagnosticSlot[] = [
  /* ---------------------------- BASE (always-on) --------------------------- */
  {
    // slot 0. ROUTER: the first 1–2 items set the global starting tier.
    topicKey: topicKeyOf("probability", "Core Probability"),
    trackId: "probability",
    levelId: "pr-1",
    itemsPerTopic: 2,
    startTier: "medium",
    label: "Core Probability",
    probes:
      "OR-rule applied without subtracting the overlap (inclusion–exclusion); multiplying for 'or'; combinations vs permutations when order (doesn't) matter.",
    misconceptionTag: "union_rule_no_overlap",
  },
  {
    topicKey: topicKeyOf("mental-math"),
    trackId: "mental-math",
    levelId: "mm-1",
    itemsPerTopic: 2,
    startTier: "medium",
    label: "Mental Math / Speed",
    probes:
      "Place-value / decimal-shift slips (×10, ÷10); dropped carry or borrow across columns; multiply-by-the-wrong-factor off-by-one.",
    misconceptionTag: "decimal_shift",
  },
  {
    topicKey: topicKeyOf("probability", "Combinatorial Analysis"),
    trackId: "probability",
    levelId: "ca-1",
    itemsPerTopic: 2,
    startTier: "medium",
    label: "Combinatorial Analysis",
    probes:
      "Ordered (nᵏ, P(n,k)) vs unordered C(n,k) counts; with- vs without-replacement models; dropping a color/factor in favorable-over-total ratios.",
    misconceptionTag: "ordered_vs_unordered",
  },
  {
    topicKey: topicKeyOf("probability", "Conditional Probability"),
    trackId: "probability",
    levelId: "cp-1",
    itemsPerTopic: 2,
    startTier: "medium",
    label: "Conditional Probability & Bayes",
    probes:
      "Reversed conditional (prosecutor's-fallacy trap: P(B|A) for P(A|B)); base-rate neglect; miscounting the reduced sample space (ordered vs unordered, faces vs objects).",
    misconceptionTag: "reversed_conditional",
  },
  {
    topicKey: topicKeyOf("probability", "Expected Value"),
    trackId: "probability",
    levelId: "ev-1",
    itemsPerTopic: 2,
    startTier: "medium",
    label: "Expected Value",
    probes:
      "The 1/N vs 1/N² dice-match trap; averaging payoffs WITHOUT weighting by probability; forgetting the losing outcomes.",
    misconceptionTag: "unweighted_average",
  },
  {
    // 1-item BREADTH probe (numeric → MCQ). Applied-math algebra foundation.
    topicKey: topicKeyOf("math-questions", "Rates, Algebra & Word Problems"),
    trackId: "math-questions",
    levelId: "mq-1",
    itemsPerTopic: 1,
    startTier: "medium",
    label: "Rates, Algebra & Word Problems",
    probes:
      "Averaging rates instead of combining them (net fill/drain); mishandling current/speed direction; dropping an equation when translating a word problem.",
    misconceptionTag: "averaged_rates",
  },
  {
    // 1-item BREADTH probe. Both former MQ slots (mq-2 & mq-4) share this section.
    topicKey: topicKeyOf("math-questions", "Number Theory & Counting"),
    trackId: "math-questions",
    levelId: "mq-4",
    itemsPerTopic: 1,
    startTier: "medium",
    label: "Number Theory & Counting",
    probes:
      "Doubling 'half-in-time' trap (¼-covered on day D−2k, NOT D/4); summing a range vs reaching for n² outside 1,3,5,…; multiples-in-interval lower-boundary slip.",
    misconceptionTag: "half_in_time",
  },
  {
    topicKey: topicKeyOf("interview-games"),
    trackId: "interview-games",
    levelId: "ig-1",
    itemsPerTopic: 2,
    startTier: "medium",
    label: "EV Decision Games / Market-Making",
    probes:
      "Mode-vs-mean confusion (most-likely value read as the average); netting payoffs without probability-weighting; ignoring option value.",
    misconceptionTag: "mode_vs_mean",
  },
  /* ------------------------ GATED (prerequisite-driven) -------------------- */
  {
    // GATED on Core Probability, continuous favourable-measure ratio.
    topicKey: topicKeyOf("probability", "Geometric Probability"),
    trackId: "probability",
    levelId: "geo-1",
    itemsPerTopic: 1,
    startTier: "medium",
    label: "Geometric Probability",
    probes:
      "Using r (distance) instead of r² (area); taking a length ratio where an area ratio is needed; mis-drawing the favourable region.",
    misconceptionTag: "length_not_area",
    gatedOnTopicKey: topicKeyOf("probability", "Core Probability"),
  },
  {
    // GATED on Expected Value, expected extremes / min-max of draws.
    topicKey: topicKeyOf("probability", "Order Statistics"),
    trackId: "probability",
    levelId: "os-1",
    itemsPerTopic: 1,
    startTier: "medium",
    label: "Order Statistics",
    probes:
      "Using a single draw's mean for the max/min; nth-power tail slips; confusing the median with the mean of an exponential.",
    misconceptionTag: "single_draw_mean",
    gatedOnTopicKey: topicKeyOf("probability", "Expected Value"),
  },
  {
    // GATED on Expected Value, second moments, covariance, CLT tails.
    topicKey: topicKeyOf("probability", "Variance, Covariance & the CLT"),
    trackId: "probability",
    levelId: "vc-1",
    itemsPerTopic: 2,
    startTier: "medium",
    label: "Variance, Covariance & the CLT",
    probes:
      "Var(aX) = a·Var(X) (missing the a²); adding SDs instead of variances; ignoring covariance in Var(X+Y); mis-scaling a CLT tail.",
    misconceptionTag: "variance_scaling",
    gatedOnTopicKey: topicKeyOf("probability", "Expected Value"),
  },
  {
    // GATED on Expected Value. Kelly sizing (numeric → MCQ).
    topicKey: topicKeyOf("probability", "Betting & Sizing"),
    trackId: "probability",
    levelId: "bs-1",
    itemsPerTopic: 1,
    startTier: "medium",
    label: "Betting & Sizing (Kelly)",
    probes:
      "Betting the win probability rather than the Kelly edge/odds fraction; forgetting to subtract q; wrong odds→b conversion.",
    misconceptionTag: "kelly_bet_prob",
    gatedOnTopicKey: topicKeyOf("probability", "Expected Value"),
  },
  {
    // GATED on Conditional, first-step analysis rewards prior fluency.
    topicKey: topicKeyOf("probability", "Markov Chains"),
    trackId: "probability",
    levelId: "mc-1",
    itemsPerTopic: 2,
    startTier: "medium",
    label: "Markov Chains (first-step analysis)",
    probes:
      "Dropping the leading +1 step in E[s] = 1 + ΣP·E[s']; unweighted geometric follow-on waits; confusing the minimum with the expected number of steps.",
    misconceptionTag: "dropped_plus_one",
    gatedOnTopicKey: topicKeyOf("probability", "Conditional Probability"),
  },
  {
    // GATED on Interview Games, strategic reasoning on top of EV.
    topicKey: topicKeyOf("probability", "Game Theory & Puzzles"),
    trackId: "probability",
    levelId: "gt-1",
    itemsPerTopic: 1,
    startTier: "medium",
    label: "Game Theory & Puzzles",
    probes:
      "Choosing a dominated strategy; assuming cooperation off the equilibrium path; mispricing a mixed-strategy value.",
    misconceptionTag: "dominated_strategy",
    gatedOnTopicKey: topicKeyOf("interview-games"),
  },
  {
    // GATED on Rates/Algebra, clean-number geometry (numeric → MCQ).
    topicKey: topicKeyOf("math-questions", "Geometry & Derivations"),
    trackId: "math-questions",
    levelId: "mq-5",
    itemsPerTopic: 1,
    startTier: "medium",
    label: "Geometry & Derivations",
    probes:
      "Clock-angle without the hour-hand creep (|30h − 5.5m|); floor instead of ceiling for whole-unit coverage; radius without completing the square.",
    misconceptionTag: "clock_no_creep",
    gatedOnTopicKey: topicKeyOf("math-questions", "Rates, Algebra & Word Problems"),
  },
];

/**
 * COURSE-MODE (Case A) BLUEPRINT, assesses the UT M362K / M362M course spine
 * (Intro to Probability + Intro to Stochastic Processes) INSTEAD of the
 * quant-interview set, including the seven now-first-class ex-"Extra Relevant
 * Knowledge" topics (MGF / Gamma / Joint / Limit Theorems / Branching / CTMC /
 * Markov Chain Structure) and Conditional Expectation. It deliberately DROPS the
 * quant-only topics (Mental Math, Interview Games, Betting & Sizing, Game Theory,
 * and the applied-math Rates/Number-Theory/Geometry word-problem spine) that
 * Case B keeps.
 *
 * Same two-stage shape as the interview blueprint (a base breadth pass with Core
 * Probability as the index-0 ROUTER, then a prerequisite-gated depth pass), and
 * the SAME ≤ 30-item guarantee: 9 always-on base items (four 2-item slots + one
 * 1-item breadth slot) + 16 gated items = 25 nominal; worst case adds one
 * tiebreak per 2-item BASE slot (4) ⇒ 29 (< 31). Every gated slot gates on a
 * BASE topic so its prerequisite is materialized in the base plan. Each slot
 * re-uses an EXISTING quiz/numeric generator (no new content); numeric levels
 * surface as MCQ via their authored `commonErrors` (see `items.ts`).
 */
export const COURSE_DIAGNOSTIC_BLUEPRINT: DiagnosticSlot[] = [
  /* ---------------------------- BASE (always-on) --------------------------- */
  {
    // slot 0. ROUTER (must stay index 0, mirrors ROUTER_SLOT_INDEX).
    topicKey: topicKeyOf("probability", "Core Probability"),
    trackId: "probability",
    levelId: "pr-1",
    itemsPerTopic: 2,
    startTier: "medium",
    label: "Core Probability",
    probes:
      "Axioms, sample space, inclusion–exclusion, independence, the M362K ch. 2 foundation.",
    misconceptionTag: "union_rule_no_overlap",
  },
  {
    topicKey: topicKeyOf("probability", "Conditional Probability"),
    trackId: "probability",
    levelId: "cp-1",
    itemsPerTopic: 2,
    startTier: "medium",
    label: "Conditional Probability & Bayes",
    probes: "Reversed conditional, base-rate neglect, reduced sample space (M362K ch. 3).",
    misconceptionTag: "reversed_conditional",
  },
  {
    topicKey: topicKeyOf("probability", "Expected Value"),
    trackId: "probability",
    levelId: "ev-1",
    itemsPerTopic: 2,
    startTier: "medium",
    label: "Expected Value",
    probes: "Probability-weighted sums; forgetting losing outcomes (M362K chs. 4/7).",
    misconceptionTag: "unweighted_average",
  },
  {
    topicKey: topicKeyOf("probability", "Continuous Distributions"),
    trackId: "probability",
    levelId: "cd-1",
    itemsPerTopic: 2,
    startTier: "medium",
    label: "Continuous Distributions",
    probes: "PDF/CDF integration; Uniform/Exponential/Normal densities (M362K ch. 5).",
    misconceptionTag: "memoryless_uniform",
  },
  {
    // 1-item BREADTH probe.
    topicKey: topicKeyOf("probability", "Combinatorial Analysis"),
    trackId: "probability",
    levelId: "ca-1",
    itemsPerTopic: 1,
    startTier: "medium",
    label: "Combinatorial Analysis",
    probes: "Ordered vs unordered counts; with/without replacement (M362K ch. 1).",
    misconceptionTag: "ordered_vs_unordered",
  },
  /* ------------------------ GATED (prerequisite-driven) -------------------- */
  {
    topicKey: topicKeyOf("probability", "Geometric Probability"),
    trackId: "probability",
    levelId: "geo-1",
    itemsPerTopic: 1,
    startTier: "medium",
    label: "Geometric Probability",
    probes: "Favourable measure ÷ total; length vs area.",
    misconceptionTag: "length_not_area",
    gatedOnTopicKey: topicKeyOf("probability", "Core Probability"),
  },
  {
    topicKey: topicKeyOf("probability", "Order Statistics"),
    trackId: "probability",
    levelId: "os-1",
    itemsPerTopic: 1,
    startTier: "medium",
    label: "Order Statistics",
    probes: "Min/max/median of several draws; expected extremes.",
    misconceptionTag: "single_draw_mean",
    gatedOnTopicKey: topicKeyOf("probability", "Expected Value"),
  },
  {
    topicKey: topicKeyOf("probability", "Variance, Covariance & the CLT"),
    trackId: "probability",
    levelId: "vc-1",
    itemsPerTopic: 2,
    startTier: "medium",
    label: "Variance, Covariance & the CLT",
    probes: "Var(aX)=a²Var(X); adding SDs; covariance in Var(X+Y); CLT tails (M362K chs. 7–8).",
    misconceptionTag: "variance_scaling",
    gatedOnTopicKey: topicKeyOf("probability", "Expected Value"),
  },
  {
    topicKey: topicKeyOf("probability", "Poisson Distribution & Process"),
    trackId: "probability",
    levelId: "po-1",
    itemsPerTopic: 1,
    startTier: "medium",
    label: "Poisson Distribution & Process",
    probes: "Rare-event counts, E[X]=λ, exponential interarrivals (M362K ch. 4.7).",
    misconceptionTag: "poisson_mean_variance",
    gatedOnTopicKey: topicKeyOf("probability", "Expected Value"),
  },
  {
    topicKey: topicKeyOf("probability", "Conditional Expectation"),
    trackId: "probability",
    levelId: "ce-1",
    itemsPerTopic: 1,
    startTier: "medium",
    label: "Conditional Expectation & the Tower Rule",
    probes: "E[X]=E[E[X|Y]]; law of total expectation/variance (M362M ch. 1).",
    misconceptionTag: "tower_rule_dropped",
    gatedOnTopicKey: topicKeyOf("probability", "Expected Value"),
  },
  {
    topicKey: topicKeyOf("probability", "Markov Chains"),
    trackId: "probability",
    levelId: "mc-1",
    itemsPerTopic: 2,
    startTier: "medium",
    label: "Markov Chains (first-step analysis)",
    probes: "First-step recursions, gambler's ruin, stationary πP=π (M362M).",
    misconceptionTag: "dropped_plus_one",
    gatedOnTopicKey: topicKeyOf("probability", "Conditional Probability"),
  },
  {
    topicKey: topicKeyOf("probability", "Brownian Motion"),
    trackId: "probability",
    levelId: "bm-1",
    itemsPerTopic: 1,
    startTier: "medium",
    label: "Brownian Motion",
    probes: "Drift + √t variance scaling; continuous-time limit of a random walk (M362M).",
    misconceptionTag: "variance_linear_in_time",
    gatedOnTopicKey: topicKeyOf("probability", "Continuous Distributions"),
  },
  {
    topicKey: topicKeyOf("probability", "Moment Generating Functions"),
    trackId: "probability",
    levelId: "ek-mgf",
    itemsPerTopic: 1,
    startTier: "medium",
    label: "Moment Generating Functions",
    probes: "Moments from M'(0)/M''(0); MGF method for independent sums (M362K).",
    misconceptionTag: "mgf_moment_slip",
    gatedOnTopicKey: topicKeyOf("probability", "Expected Value"),
  },
  {
    topicKey: topicKeyOf("probability", "Gamma Distribution"),
    trackId: "probability",
    levelId: "ek-gamma",
    itemsPerTopic: 1,
    startTier: "medium",
    label: "Gamma Distribution",
    probes: "Gamma(k,λ) as a sum of k iid Exp(λ); mean k/λ, variance k/λ² (M362K).",
    misconceptionTag: "gamma_param_slip",
    gatedOnTopicKey: topicKeyOf("probability", "Continuous Distributions"),
  },
  {
    topicKey: topicKeyOf("probability", "Joint Distributions"),
    trackId: "probability",
    levelId: "ek-joint",
    itemsPerTopic: 1,
    startTier: "medium",
    label: "Joint Distributions",
    probes: "Joint densities, marginals, double integrals over a region (M362K chs. 6–7).",
    misconceptionTag: "marginal_slip",
    gatedOnTopicKey: topicKeyOf("probability", "Continuous Distributions"),
  },
  {
    topicKey: topicKeyOf("probability", "Limit Theorems"),
    trackId: "probability",
    levelId: "ek-limit",
    itemsPerTopic: 1,
    startTier: "medium",
    label: "Limit Theorems",
    probes: "Chebyshev, the (weak) LLN, and the formal CLT (M362K ch. 8).",
    misconceptionTag: "chebyshev_slip",
    gatedOnTopicKey: topicKeyOf("probability", "Expected Value"),
  },
  {
    topicKey: topicKeyOf("probability", "Branching Processes"),
    trackId: "probability",
    levelId: "ek-branching",
    itemsPerTopic: 1,
    startTier: "medium",
    label: "Branching Processes",
    probes: "Galton–Watson mean growth μⁿ; extinction as the smallest fixed point (M362M).",
    misconceptionTag: "extinction_fixed_point",
    gatedOnTopicKey: topicKeyOf("probability", "Expected Value"),
  },
  {
    topicKey: topicKeyOf("probability", "Continuous-Time Markov Chains"),
    trackId: "probability",
    levelId: "ek-ctmc",
    itemsPerTopic: 1,
    startTier: "medium",
    label: "Continuous-Time Markov Chains",
    probes: "Exponential holding times, flow balance, the M/M/1 queue (M362M).",
    misconceptionTag: "ctmc_balance_slip",
    gatedOnTopicKey: topicKeyOf("probability", "Conditional Probability"),
  },
  {
    topicKey: topicKeyOf("probability", "Markov Chain Structure"),
    trackId: "probability",
    levelId: "ek-markov-pn",
    itemsPerTopic: 1,
    startTier: "medium",
    label: "Markov Chain Structure",
    probes: "n-step Pⁿ / Chapman–Kolmogorov and state classification (M362M).",
    misconceptionTag: "pn_composition_slip",
    gatedOnTopicKey: topicKeyOf("probability", "Conditional Probability"),
  },
];

/**
 * The diagnostic blueprint for a given Goal Mode: Case A ("course") assesses the
 * UT course spine ({@link COURSE_DIAGNOSTIC_BLUEPRINT}); Case B ("interview", the
 * default) keeps the quant-interview set ({@link DIAGNOSTIC_BLUEPRINT}). Both put
 * Core Probability at index 0 as the ROUTER, so `ROUTER_SLOT_INDEX` is shared.
 */
export function blueprintForMode(mode: GoalMode): DiagnosticSlot[] {
  return mode === "course" ? COURSE_DIAGNOSTIC_BLUEPRINT : DIAGNOSTIC_BLUEPRINT;
}

/** The blueprint index of the ROUTER slot whose early items set the global tier. */
export const ROUTER_SLOT_INDEX = 0;

/**
 * Total NOMINAL diagnostic items across all slots (base + every gated slot, no
 * tiebreaks) = 14 base + 9 gated = 23. The experienced count varies: gated
 * probes appear only when their prerequisite passed, and split base slots add a
 * tiebreak 3rd item, so a run lands between ~14 and a worst case of 29 (≤ 30).
 */
export function diagnosticItemCount(
  blueprint: DiagnosticSlot[] = DIAGNOSTIC_BLUEPRINT,
): number {
  return blueprint.reduce((n, s) => n + s.itemsPerTopic, 0);
}

/**
 * The provable UPPER BOUND on items a single run can show: every gated slot
 * opens AND every 2-item base slot splits (adding one tiebreak each). Kept as a
 * pure helper so a test can assert it stays ≤ 30.
 */
export function diagnosticMaxItemCount(
  blueprint: DiagnosticSlot[] = DIAGNOSTIC_BLUEPRINT,
): number {
  const baseTiebreaks = blueprint.filter(
    (s) => !s.gatedOnTopicKey && s.itemsPerTopic >= 2,
  ).length;
  return diagnosticItemCount(blueprint) + baseTiebreaks;
}

/** The always-on (non-gated) base item count shown on every run. */
export function diagnosticBaseItemCount(
  blueprint: DiagnosticSlot[] = DIAGNOSTIC_BLUEPRINT,
): number {
  return blueprint
    .filter((s) => !s.gatedOnTopicKey)
    .reduce((n, s) => n + s.itemsPerTopic, 0);
}

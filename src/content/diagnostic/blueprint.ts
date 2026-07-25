import type { Difficulty } from "@/types/content";
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
 * (RESEARCH_ASSESSMENT §1.9, §3) — numeric levels are surfaced as MCQ by
 * turning their authored `commonErrors` into distractors (see `items.ts`).
 *
 * The redesign raises quality to ~8 always-on-topic × 2 items plus a GATED
 * Markov probe (shown only when the Conditional-Probability item was answered
 * correctly) and an adaptive tiebreak 3rd item on any topic whose two items
 * split (both injected at runtime by `run.ts`). Pelánek spillover stays OFF.
 */

export interface DiagnosticSlot {
  /** `topicKeyOf(trackId, section)` — the Phase-1 mastery bucket this seeds. */
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
 * ~7 always-on core topics × 2 items ⇒ 14 items, plus a gated Markov probe
 * (2 items) ⇒ 16 nominal; the run injects the Markov probe only when Conditional
 * is passed and adds a tiebreak 3rd item on split topics, so an experienced run
 * lands around ~16–22 items (~8–11 min).
 */
export const DIAGNOSTIC_BLUEPRINT: DiagnosticSlot[] = [
  {
    // slot 0 — ROUTER: the first 1–2 items set the global starting tier.
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
    // NEW: Combinatorial Analysis (numeric level → MCQ via commonErrors).
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
    // Deduped from the two former MQ slots — both mq-2 and mq-4 now live under
    // the single "Number Theory & Counting" section, so they map to one topic.
    topicKey: topicKeyOf("math-questions", "Number Theory & Counting"),
    trackId: "math-questions",
    levelId: "mq-4",
    itemsPerTopic: 2,
    startTier: "medium",
    label: "Number Theory & Counting",
    probes:
      "Doubling 'half-in-time' trap (¼-covered on day D−2k, NOT D/4); summing a range vs reaching for n² outside 1,3,5,…; multiples-in-interval lower-boundary slip; floor-then-multiply packing over-count.",
    misconceptionTag: "half_in_time",
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
  {
    // GATED Markov probe (numeric level → MCQ). Shown ONLY when the Conditional
    // item was answered correctly (first-step analysis rewards prior fluency).
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
];

/** The blueprint index of the ROUTER slot whose early items set the global tier. */
export const ROUTER_SLOT_INDEX = 0;

/**
 * Total NOMINAL diagnostic items across all slots (always-on × 2 + the gated
 * Markov × 2 = 16). The experienced count varies: the Markov probe is only
 * shown when Conditional is passed, and split topics add a tiebreak 3rd item,
 * so a typical strong run lands around ~16–22.
 */
export function diagnosticItemCount(): number {
  return DIAGNOSTIC_BLUEPRINT.reduce((n, s) => n + s.itemsPerTopic, 0);
}

/** The always-on (non-gated) base item count shown on every run. */
export function diagnosticBaseItemCount(): number {
  return DIAGNOSTIC_BLUEPRINT.filter((s) => !s.gatedOnTopicKey).reduce(
    (n, s) => n + s.itemsPerTopic,
    0,
  );
}

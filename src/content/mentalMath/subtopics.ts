import { topicKeyOf } from "@/lib/mastery/topicKey";

/**
 * MENTAL ARITHMETIC — SUBTOPIC TAXONOMY (RESOLVED DECISIONS §10.9, §10.10).
 *
 * Decision §10.9 makes Mental Arithmetic a first-class SCORED, drilled, gated KST
 * node (it already is: `mental-math::_core` in `@/lib/roadmap/skillGraph` with
 * weight 3, a scored numeric probe `mm-1` in `@/content/remediation/prereqDAG`,
 * and it counts toward the Stage-6 content gate in `@/lib/pipeline/gates`). It
 * also asks for SUBTOPIC granularity so each mental-math problem is attributable
 * and drillable at the sub-skill level.
 *
 * ── REPRESENTATION CHOICE (documented per the deliverable) ───────────────────
 * The mastery engine keys buckets by `topicKeyOf(trackId, section)`. Mental Math
 * MUST stay the single node `mental-math::_core` — the Stage-6 gate and the whole
 * skill graph read that exact key, and splitting it into per-section sub-nodes
 * would mean `mental-math::_core` never receives evidence and could never be
 * mastered. So subtopics are modeled as the SECOND allowed option in the spec: a
 * SUBTOPIC TAG carried on each item (the question's `concept` field) that MAPS TO
 * the single Mental Arithmetic node — NOT as separate sub-nodes. Every
 * mental-math generator already stamps a `concept`; this module is the canonical
 * registry those concepts must resolve to, plus the map to the owning KST node.
 *
 * This keeps attribution precise (each item names its subtopic) without breaking
 * the single-node gate, and gives the diagnosis / weakness report a stable,
 * enumerable set of mental-math sub-skills to drill.
 */

/** Canonical mental-arithmetic subtopic ids (stable machine keys). */
export type MentalMathSubtopic =
  | "additive-arithmetic"
  | "multiplication"
  | "division"
  | "percentages"
  | "fractions-decimals"
  | "ratios-odds-probability"
  | "squares-products"
  | "series-sums"
  | "digit-counting";

/**
 * Canonical subtopic id → learner-facing label. Covers the decision-§10.9 list
 * (multi-digit multiplication, division, percentages, fractions↔decimals,
 * ratios/odds→probability) plus the additive-arithmetic floor the mental-math
 * track opens on. "Fast sequence arithmetic" from the illustrative list is NOT a
 * mental-math subtopic here: it is the separate `sequences::…` KST node (an
 * `external` skill-graph stub — see §5.4's taxonomy, "Sequences / pattern
 * recognition → Sequences"), so it stays attributable to its own node rather
 * than being double-counted under Mental Arithmetic.
 */
export const MENTAL_MATH_SUBTOPICS: Record<MentalMathSubtopic, string> = {
  "additive-arithmetic": "Multi-digit addition & subtraction",
  multiplication: "Multi-digit multiplication",
  division: "Division",
  percentages: "Percentages",
  "fractions-decimals": "Fractions ↔ decimals",
  "ratios-odds-probability": "Ratios / odds → probability",
  "squares-products": "Squares & near-square products (a² − b²)",
  "series-sums": "Series sums (triangular, odds, ranges)",
  "digit-counting": "Digit counting",
};

/**
 * The concrete `concept` strings the mental-math generators stamp on their items
 * (both the quiz and the free-response numeric families), mapped to the canonical
 * subtopic each belongs to. Keep this in lockstep with the `concept:` fields in
 * `@/content/mentalMath/generators` (asserted in `mentalMath.test.ts`).
 */
export const MENTAL_MATH_CONCEPT_TO_SUBTOPIC: Record<string, MentalMathSubtopic> =
  {
    Addition: "additive-arithmetic",
    Subtraction: "additive-arithmetic",
    Multiplication: "multiplication",
    Division: "division",
    Percentages: "percentages",
    "Fraction↔decimal": "fractions-decimals",
    "Odds↔probability": "ratios-odds-probability",
    "Squares & products": "squares-products",
    "Series sums": "series-sums",
    "Digit counting": "digit-counting",
  };

/** The single KST node every mental-math subtopic attributes to (`mental-math::_core`). */
export const MENTAL_MATH_TOPIC_KEY = topicKeyOf("mental-math");

/**
 * Resolve a mental-math item's `concept` to its canonical subtopic id, or
 * `undefined` for an unrecognised / missing concept (an ORPHAN subtopic tag —
 * asserted absent by the attribution test).
 */
export function mentalMathSubtopicOf(
  concept: string | undefined,
): MentalMathSubtopic | undefined {
  if (!concept) return undefined;
  return MENTAL_MATH_CONCEPT_TO_SUBTOPIC[concept];
}

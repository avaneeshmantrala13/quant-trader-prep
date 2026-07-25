import { topicKeyOf } from "@/lib/mastery/topicKey";
import { MISCONCEPTION } from "@/lib/tutor/misconception";

/**
 * The static prerequisite DAG for bounded backtracking (PHASE_4 §2/§5).
 *
 * Nodes are Phase-1 topicKeys (`topicKeyOf(trackId, section)`) so the mastery a
 * probe writes lands in the SAME bucket the policy reads. Edges point DOWN a
 * node to its prerequisites ("is prerequisite of"): descending = moving to a
 * node in `prereqs`. The conceptual chain is
 *
 *   L0 arithmetic  →  L1 meaning / sample space  →  counting  →  conditioning
 *                                                              →  expectation
 *
 * collapsed onto the app's real section-level topics (the mastery layer is
 * section-granular, COORDINATION §6.4). Two nodes are FLOORS (Vygotsky: stop
 * dropping, teach here): the L0 mental-arithmetic leaf and the L1
 * "meaning of probability / sample space" node.
 *
 * `MISCONCEPTION_EDGE` maps a misconception TAG (the canonical Phase-2 tags in
 * `@/lib/tutor/misconception`, i.e. the string AFTER the `topicKey::` prefix a
 * misconception KEY carries) to the prerequisite topicKey it implicates
 * (Doignon & Falmagne KST: the misconception names the missing precedence).
 *
 * Research: Doignon & Falmagne (precedence DAG / outer fringe); Bloom 1984
 * (remediate the specific missing prerequisite).
 */

export interface PrereqNode {
  /** Node identity — a Phase-1 topicKey (`topicKeyOf(trackId, section)`). */
  topicKey: string;
  label: string;
  /** Parent topicKeys — the prerequisites of this node (edges "is prerequisite of"). */
  prereqs: string[];
  /** L0 / "meaning of probability": stop dropping, teach here (do not descend below). */
  floor?: boolean;
  /** The closest existing foundational level to draw probe/corrective items from. */
  levelRef: { trackId: string; levelId: string };
}

/* -- Node topicKeys (all resolve to REAL mastery buckets + levels) ---------- */

/** L0 — Mental arithmetic. Mental Math serves as the arithmetic floor (PHASE_4 §5 gap note). */
export const L0_ARITHMETIC = topicKeyOf("mental-math"); // `mental-math::_core`
/** L1 — Meaning of probability, sample space, P(A∪B)/P(A∩B), independence (pr-1). FLOOR. */
export const L1_MEANING = topicKeyOf("probability", "Core Probability");
/** Counting / combinatorics — supports reduced-sample-space counting. */
export const COUNTING = topicKeyOf("probability", "Combinatorial Analysis");
/** Conditioning + Bayes. */
export const CONDITIONAL = topicKeyOf("probability", "Conditional Probability");
/** Expected value. */
export const EXPECTED_VALUE = topicKeyOf("probability", "Expected Value");

export const PREREQ_DAG: Record<string, PrereqNode> = {
  [L0_ARITHMETIC]: {
    topicKey: L0_ARITHMETIC,
    label: "Mental Arithmetic (L0)",
    prereqs: [],
    floor: true,
    levelRef: { trackId: "mental-math", levelId: "mm-1" },
  },
  [L1_MEANING]: {
    topicKey: L1_MEANING,
    label: "Meaning of Probability & Sample Space (L1)",
    // Depends only on arithmetic, but is itself a floor: we teach the meaning
    // here rather than dropping to pure arithmetic (ZPD).
    prereqs: [L0_ARITHMETIC],
    floor: true,
    levelRef: { trackId: "probability", levelId: "pr-1" },
  },
  [COUNTING]: {
    topicKey: COUNTING,
    label: "Counting & Combinatorics",
    prereqs: [L0_ARITHMETIC],
    levelRef: { trackId: "probability", levelId: "ca-1" },
  },
  [CONDITIONAL]: {
    topicKey: CONDITIONAL,
    label: "Conditional Probability & Bayes",
    prereqs: [L1_MEANING, COUNTING],
    levelRef: { trackId: "probability", levelId: "cp-1" },
  },
  [EXPECTED_VALUE]: {
    topicKey: EXPECTED_VALUE,
    label: "Expected Value",
    prereqs: [L1_MEANING, COUNTING],
    levelRef: { trackId: "probability", levelId: "ev-1" },
  },
};

/**
 * misconception TAG → prerequisite topicKey to descend to (PHASE_4 §5). Keyed on
 * the canonical Phase-2 tags actually emitted by the content generators (strip
 * the `topicKey::` prefix from a misconception KEY to get the tag via
 * {@link misconceptionTagOf}). Every value is a node in {@link PREREQ_DAG}.
 *
 *  - reversed conditional / base-rate / likelihood-as-posterior / total-prob
 *    weighting / memoryless-uniform ⇒ the gap is in the MEANING of probability
 *    (marginals, conditioning set-up) ⇒ descend to L1.
 *  - ordered-vs-unordered / faces-not-objects ⇒ the gap is in COUNTING the
 *    reduced sample space ⇒ descend to Counting.
 */
export const MISCONCEPTION_EDGE: Record<string, string> = {
  [MISCONCEPTION.reversedConditional]: L1_MEANING,
  [MISCONCEPTION.baseRateNeglect]: L1_MEANING,
  [MISCONCEPTION.likelihoodAsPosterior]: L1_MEANING,
  [MISCONCEPTION.outcomeApproach]: L1_MEANING,
  [MISCONCEPTION.gamblersFallacy]: L1_MEANING,
  [MISCONCEPTION.conjunctionFallacy]: L1_MEANING,
  [MISCONCEPTION.equalWeightMixture]: L1_MEANING,
  [MISCONCEPTION.memorylessUniform]: L1_MEANING,
  [MISCONCEPTION.orderedVsUnordered]: COUNTING,
  [MISCONCEPTION.facesNotObjects]: COUNTING,
};

/** Look up a node (undefined if the topicKey is not in the DAG). */
export function prereqNode(topicKey: string): PrereqNode | undefined {
  return PREREQ_DAG[topicKey];
}

/**
 * Strip the `${topicKey}::` prefix from a namespaced misconception KEY to recover
 * the TAG that {@link MISCONCEPTION_EDGE} is keyed on. A bare tag (no prefix) is
 * returned unchanged; `undefined`/empty ⇒ `undefined`.
 */
export function misconceptionTagOf(
  misconceptionKeyOrTag: string | undefined,
): string | undefined {
  if (!misconceptionKeyOrTag) return undefined;
  const idx = misconceptionKeyOrTag.lastIndexOf("::");
  return idx >= 0
    ? misconceptionKeyOrTag.slice(idx + 2)
    : misconceptionKeyOrTag;
}

/**
 * Topic/family-aware hint content (PHASE_2 §5, Subtask B4).
 *
 * The generic "simulate it" (rung 4) hint was uselessly vague. `simLinkFor`
 * makes it genuinely useful:
 *
 *  - `simLinkFor` — resolves a question's context to the single most relevant
 *    Simulations-tab sim (a real `/simulations#<id>` deep link), so rung 4 can
 *    say EXACTLY which sim to open and what to set/observe.
 *
 * (Rung 2's "guided plan of attack" now lives in `./planOfAttack` + `./plans/*`;
 * it replaced the old "restate & visualize" copy that lived here.)
 *
 * INVARIANT (upheld by construction + asserted by the ladder tests): this helper
 * never references the item's own answer/numbers — it uses only generic
 * illustrations. No React here.
 */

import { MISCONCEPTION } from "./misconception";
import { SIM_BY_ID, simAnchorHref } from "@/lib/simulations/catalog";

export interface HintContext {
  /** `Level.section` topic string. */
  section?: string;
  /** `question.family` — the generator (template) name. */
  family?: string;
  misconceptionTag?: string;
}

export interface SimLink {
  simId: string;
  title: string;
  href: string;
  /** Short imperative "what to set/observe" line for this sim. */
  blurb: string;
}

/** Per-sim imperative blurb: what to set and what to watch (answer-free). */
const SIM_BLURBS: Record<string, string> = {
  "coin-flips":
    "flip with any bias and watch the running proportion settle — streaks don't change the next flip.",
  "dice-rolls":
    "roll many times and watch how often each face turns up settle toward its true long-run frequency.",
  "sample-space":
    "lay every equally-likely outcome out as a grid, pick your event, and read its probability by counting cells.",
  "venn-two-events":
    "drag P(A), P(B) and their overlap to watch P(A∪B) update — add the two areas, then subtract the overlap once.",
  "two-independent-events":
    "set P(A) and P(B) and simulate to see how often BOTH happen (it's P(A)·P(B), not P(A)+P(B)).",
  binomial:
    "set n and p, run the trials repeatedly, and watch the histogram of successes build the binomial shape.",
  clt:
    "average many draws from a lumpy source and watch the distribution of the sample mean turn into a bell curve.",
  "order-statistics":
    "draw n values repeatedly and watch where the minimum, maximum, or median concentrate.",
  "expected-value":
    "set the payoffs and watch the running average converge to E[X] over many plays.",
  kelly:
    "compare under-, full-, and over-Kelly staking to see which grows the bankroll fastest in the long run.",
  "markov-chain":
    "set the transition probabilities and watch the state distribution settle into its stationary distribution.",
  "geometric-dartboard":
    "throw uniformly-random darts and watch the fraction landing inside the shape estimate its area ratio.",
  "game-theory-matrix":
    "adjust the 2×2 payoffs to find the game's value and each player's optimal mixed strategy.",
  "bayes-natural-frequency":
    "enter the base rate and test accuracy as counts out of 1000 to see why a positive test is usually a false alarm.",
};

/** Generic fallback blurb for any sim without a bespoke line above. */
const FALLBACK_BLURB =
  "set the parameters, run the trials, and watch the empirical result settle onto the true probability.";

/** misconceptionTag → sim id (highest priority). */
const SIM_BY_MISCONCEPTION: Record<string, string> = {
  [MISCONCEPTION.gamblersFallacy]: "coin-flips",
  [MISCONCEPTION.outcomeApproach]: "dice-rolls",
  [MISCONCEPTION.baseRateNeglect]: "bayes-natural-frequency",
  [MISCONCEPTION.reversedConditional]: "bayes-natural-frequency",
  [MISCONCEPTION.likelihoodAsPosterior]: "bayes-natural-frequency",
  [MISCONCEPTION.conjunctionFallacy]: "two-independent-events",
};

/** question.family → sim id (second priority). */
const SIM_BY_FAMILY: Record<string, string> = {
  genIntersectionIndep: "two-independent-events",
  genUnion: "venn-two-events",
  genAtLeastOne: "two-independent-events",
  genBayes: "bayes-natural-frequency",
  genConditional: "bayes-natural-frequency",
  genExpectedValue: "expected-value",
  genBinomial: "binomial",
  genCombinations: "sample-space",
  genGeometric: "expected-value",
  // Phase-2 converted free-response families (reported by section sub-workers).
  // Reduced-sample-space counting → the "count the cells" sim.
  genTableNumeric: "sample-space",
  genBothNumeric: "sample-space",
  genGivenSumNumeric: "sample-space",
  genAllOnNumeric: "sample-space",
  // Math Questions counting families (section-less track → needs a family map).
  genColdStorageNumeric: "sample-space",
  genGridRectanglesNumeric: "sample-space",
  genWordArrangementsNumeric: "sample-space",
  genRoundRobinNumeric: "sample-space",
  // Limit-theorem families (ek-limit stays quiz, but the ladder still applies).
  genChebyshev: "clt",
  genCltStatement: "clt",
  genLlnStatement: "clt",
  genCltCondition: "clt",
  // Batch-2: Core Probability converted free-response families.
  genUnionNumeric: "venn-two-events",
  genIntersectionIndepNumeric: "two-independent-events",
  genAtLeastOneNumeric: "two-independent-events",
  genCombinationsNumeric: "sample-space",
  genConditionalNumeric: "bayes-natural-frequency",
  genBayesNumeric: "bayes-natural-frequency",
  genExpectedValueNumeric: "expected-value",
  genBinomialNumeric: "binomial",
  genGeometricNumeric: "expected-value",
  // Batch-2: Interview Games converted EV families.
  genReRollDieNumeric: "expected-value",
  genFairValueNumeric: "expected-value",
};

/** Level.section → sim id (third priority). */
const SIM_BY_SECTION: Record<string, string> = {
  "Core Probability": "coin-flips",
  "Conditional Probability": "bayes-natural-frequency",
  "Expected Value": "expected-value",
  "Betting & Sizing": "kelly",
  "Markov Chains": "markov-chain",
  "Order Statistics": "order-statistics",
  "Variance, Covariance & the CLT": "clt",
  "Geometric Probability": "geometric-dartboard",
  "Combinatorial Analysis": "sample-space",
  "Game Theory & Puzzles": "game-theory-matrix",
};

/** The final, guaranteed-valid default when nothing else resolves. */
const DEFAULT_SIM_ID = "coin-flips";

/**
 * Map a question's context → the single most relevant Simulations-tab sim.
 * Priority: misconceptionTag → family → section → sensible default. Always
 * returns a sim id that EXISTS in `SIM_BY_ID`, with title/href from the catalog
 * and a short imperative `blurb` telling the learner what to set/observe.
 */
export function simLinkFor(ctx: HintContext): SimLink {
  const { section, family, misconceptionTag } = ctx;
  const candidate =
    (misconceptionTag && SIM_BY_MISCONCEPTION[misconceptionTag]) ||
    (family && SIM_BY_FAMILY[family]) ||
    (section && SIM_BY_SECTION[section]) ||
    DEFAULT_SIM_ID;
  // Guard against any drift: only surface an id the catalog actually contains.
  const simId = SIM_BY_ID[candidate] ? candidate : DEFAULT_SIM_ID;
  return {
    simId,
    title: SIM_BY_ID[simId].title,
    href: simAnchorHref(simId),
    blurb: SIM_BLURBS[simId] ?? FALLBACK_BLURB,
  };
}

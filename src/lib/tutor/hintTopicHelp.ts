/**
 * Topic/family-aware hint content (PHASE_2 §5, Subtask B4).
 *
 * The generic "simulate it" (rung 4) hint was uselessly vague. `simLinkFor`
 * makes it genuinely useful:
 *
 *  - `simLinkFor` — resolves a question's context to the single most relevant
 *    Simulations-tab sim (a real `/simulations#<id>` deep link), so rung 4 can
 *    say EXACTLY which sim to open and what to set/observe. It returns `null`
 *    when no sim is a confident match, so rung 4 falls back to its inline
 *    confront / generic elicitation text instead of MISDIRECTING the learner to
 *    an unrelated sim.
 *
 * SELF-MAINTAINING COVERAGE: the section→sim table is DERIVED by inverting each
 * `SimMeta.topics` in the catalog (the catalog is the single source of truth for
 * which sim illustrates which `Level.section`). A small explicit override table
 * disambiguates the sections that several sims legitimately claim, and an
 * explicit no-link set records the sections we intentionally do NOT link (no sim
 * fits — e.g. mental-math / word-problem tracks). Adding a sim + tagging its
 * `topics` is therefore enough to wire it into the ladder; nothing here needs
 * hand-editing per section.
 *
 * (Rung 2's "guided plan of attack" now lives in `./planOfAttack` + `./plans/*`;
 * it replaced the old "restate & visualize" copy that lived here.)
 *
 * INVARIANT (upheld by construction + asserted by the ladder tests): this helper
 * never references the item's own answer/numbers — it uses only generic
 * illustrations. No React here.
 */

import { MISCONCEPTION } from "./misconception";
import { SIM_BY_ID, SIMULATIONS, simAnchorHref } from "@/lib/simulations/catalog";

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
  "joint-density-integral":
    "drag a rectangle over the joint-density heatmap and watch the double integral — the chance BOTH variables land in the box — update, with a Monte-Carlo scatter converging onto it.",
  "expected-value":
    "set the payoffs and watch the running average converge to E[X] over many plays.",
  "coupon-collector":
    "draw coupons at random and watch how many draws it takes to collect the whole set track the theoretical mean.",
  kelly:
    "compare under-, full-, and over-Kelly staking to see which grows the bankroll fastest in the long run.",
  "markov-chain":
    "set the transition probabilities and watch the state distribution settle into its stationary distribution.",
  "gamblers-ruin":
    "set the bias, starting stake, and target, then watch the empirical ruin frequency match the closed-form probability.",
  "stock-random-walk":
    "set the up/down step probabilities, make a buy/sell/hold call, and watch the per-step drift (EV) and the distribution of final P&L decide the right action.",
  "stock-regime-markov":
    "tune the bull/bear switching probabilities and watch how the long-run mix of regimes sets the stock's overall drift.",
  "poker-pot-odds":
    "compare your pot odds to your equity and watch the EV of calling — and the empirical win rate over many hands — decide call vs fold.",
  "poker-hand-equity":
    "run two all-in hands over many deals and watch the empirical win/tie equity converge to each hand's true probability.",
  "monty-hall":
    "play many rounds of stay-vs-switch and watch the switch strategy win about two-thirds of the time.",
  "bayes-natural-frequency":
    "enter the base rate and test accuracy as counts out of 1000 to see why a positive test is usually a false alarm.",
  "geometric-dartboard":
    "throw uniformly-random darts and watch the fraction landing inside the shape estimate its area ratio.",
  "game-theory-matrix":
    "adjust the 2×2 payoffs to find the game's value and each player's optimal mixed strategy.",
  "trading-floor-live":
    "quote a two-sided market round by round against an informed counterparty, manage inventory under the clock, and read the calibration debrief vs the benchmark desk.",
  "basketball-book":
    "make a two-sided market on the game's final total, tune your spread and inventory skew, and get scored on P&L and drawdown vs the desk.",
  "marble-winner-markets":
    "quote correlated winner markets and renormalize your book to stay arbitrage-free (de-vig) — or leak a Dutch book to the arbitrageur.",
  "etf-creation-redemption":
    "make a market on an ETF while its components drift under latency, sizing your spread to cover the NAV move or get arbitraged.",
};

/** Generic fallback blurb for any sim without a bespoke line above. */
const FALLBACK_BLURB =
  "set the parameters, run the trials, and watch the empirical result settle onto the true probability.";

/**
 * misconceptionTag → sim id (highest priority). COMPLETE for every canonical
 * `MISCONCEPTION.*` tag that has a genuinely illustrative sim — a leaking tag
 * here is what silently misrouted items to coin-flips before. Tags with no
 * fitting sim (e.g. `memorylessUniform`) are intentionally absent and fall
 * through to family/section resolution.
 */
const SIM_BY_MISCONCEPTION: Record<string, string> = {
  [MISCONCEPTION.gamblersFallacy]: "coin-flips",
  [MISCONCEPTION.outcomeApproach]: "dice-rolls",
  [MISCONCEPTION.baseRateNeglect]: "bayes-natural-frequency",
  [MISCONCEPTION.reversedConditional]: "bayes-natural-frequency",
  [MISCONCEPTION.likelihoodAsPosterior]: "bayes-natural-frequency",
  [MISCONCEPTION.conjunctionFallacy]: "two-independent-events",
  // Free-response arithmetic error modes — previously all leaked to coin-flips.
  [MISCONCEPTION.andMeansAdd]: "two-independent-events", // P(A AND B): fixes the reported bug
  [MISCONCEPTION.orMeansAddNoOverlap]: "venn-two-events",
  [MISCONCEPTION.complementConfusion]: "venn-two-events",
  [MISCONCEPTION.atLeastOneNaive]: "two-independent-events",
  [MISCONCEPTION.orderedVsUnordered]: "sample-space",
  [MISCONCEPTION.facesNotObjects]: "dice-rolls",
  [MISCONCEPTION.forgotDivideByTwo]: "sample-space",
  [MISCONCEPTION.nVsNMinusOne]: "clt",
  [MISCONCEPTION.equalWeightMixture]: "expected-value",
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
  // Joint-distribution generators (Bucket 2) → the joint-density double-integral.
  genJointNorm: "joint-density-integral",
  genJointMean: "expected-value",
  genJointSum: "joint-density-integral",
  genTransform: "joint-density-integral",
  genJointMarginal: "joint-density-integral",
  genJointConditional: "joint-density-integral",
  genJointIndependence: "two-independent-events",
  genJointCovariance: "joint-density-integral",
  genSumDensityRect: "joint-density-integral",
};

/**
 * Sections claimed by MULTIPLE sims (via their `topics`) resolve ambiguously
 * under plain inversion, so we pick the single best default here. The other
 * claimants stay reachable through the misconception/family maps (e.g.
 * Conditional Probability defaults to `bayes-natural-frequency`, while
 * `monty-hall` / `venn-two-events` / `poker-pot-odds` remain reachable). A few
 * unambiguous sections are listed too, purely to pin the choice against future
 * catalog reordering.
 */
const SECTION_SIM_OVERRIDES: Record<string, string> = {
  "Core Probability": "coin-flips",
  "Conditional Probability": "bayes-natural-frequency",
  "Combinatorial Analysis": "sample-space",
  "Expected Value": "expected-value",
  "Markov Chains": "markov-chain",
  "No-Arbitrage": "marble-winner-markets",
};

/**
 * Sections that intentionally have NO sim link: their material (mental-math,
 * word problems, pure algebra/number theory derivations, brainteaser technique
 * drills, pattern recognition, and a few advanced distributions with no bespoke
 * visualization) is not illustrated by any Simulations-tab sim. For these, rung
 * 4 renders its inline confront / generic elicitation text — we never misdirect
 * to an unrelated sim (and never silently to coin-flips).
 */
const EXPLICIT_NO_LINK_SECTIONS = new Set<string>([
  // NEW build-swarm sections with no matching sim.
  "Sequences & Pattern Recognition",
  "Rates, Algebra & Word Problems",
  "Geometry & Derivations",
  // Brainteaser tracks (no probability sim fits).
  "Core Puzzles",
  "Techniques Toolkit",
  // Advanced distributions/processes without a bespoke sim.
  "Moment Generating Functions",
  "Gamma Distribution",
  "Continuous Distributions",
  "Poisson Distribution & Process",
  "Branching Processes",
]);

/**
 * `Level.section` → sim id (third priority), DERIVED from the catalog. Invert
 * every `SimMeta.topics` (first sim to claim a section in catalog order wins),
 * then let the explicit overrides settle multi-claim sections and the no-link
 * set remove sections we deliberately leave unlinked. This is the single place
 * coverage is decided, and it stays in sync with the catalog automatically.
 */
const SIM_BY_SECTION: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const sim of SIMULATIONS) {
    for (const topic of sim.topics) {
      if (!(topic in map)) map[topic] = sim.id;
    }
  }
  for (const [section, simId] of Object.entries(SECTION_SIM_OVERRIDES)) {
    map[section] = simId;
  }
  for (const section of EXPLICIT_NO_LINK_SECTIONS) {
    delete map[section];
  }
  return map;
})();

/** Build a `SimLink` for a catalog id (assumes the id exists). */
function linkFor(simId: string): SimLink {
  return {
    simId,
    title: SIM_BY_ID[simId].title,
    href: simAnchorHref(simId),
    blurb: SIM_BLURBS[simId] ?? FALLBACK_BLURB,
  };
}

/**
 * Map a question's context → the single most relevant Simulations-tab sim, or
 * `null` when nothing resolves confidently. Priority: misconceptionTag → family
 * → section (derived from the catalog). Never defaults to a coin: an unresolved
 * context returns `null` so rung 4 keeps its inline confront / generic
 * elicitation instead of misdirecting the learner.
 */
export function simLinkFor(ctx: HintContext): SimLink | null {
  const { section, family, misconceptionTag } = ctx;
  const candidate =
    (misconceptionTag && SIM_BY_MISCONCEPTION[misconceptionTag]) ||
    (family && SIM_BY_FAMILY[family]) ||
    (section && SIM_BY_SECTION[section]) ||
    null;
  // Guard against any drift: only surface an id the catalog actually contains.
  if (!candidate || !SIM_BY_ID[candidate]) return null;
  return linkFor(candidate);
}

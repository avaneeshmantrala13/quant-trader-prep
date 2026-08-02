import type { Level } from "@/types/content";
import { bettingSizingLevels } from "./bettingSizing/levels";
import { gameTheoryLevels } from "./gameTheory/levels";
import { gamePuzzleLevels } from "./gamePuzzle/levels";
import { expectedValueLevels } from "./expectedValue/levels";
import { conditionalProbabilityLevels } from "./conditionalProbability/levels";
import { conditionalExpectationLevels } from "./conditionalExpectation/levels";
import { markovChainsLevels } from "./markovChains/levels";
import { combinatorialAnalysisLevels } from "./combinatorialAnalysis/levels";
import { geometricProbabilityLevels } from "./geometricProbability/levels";
import { orderStatisticsLevels } from "./orderStatistics/levels";
import { varianceCovarianceCltLevels } from "./varianceCovarianceClt/levels";
// UT M362K/M362M coverage additions (see datasets/UT_TOPICS_BUILD_PLAN.md).
import { poissonLevels } from "./poisson/levels"; // Bucket 1
import { continuousDistributionsLevels } from "./continuousDistributions/levels"; // Bucket 1
import { brownianMotionLevels } from "./brownianMotion/levels"; // Bucket 1
// Bucket 2 — seven FIRST-CLASS course-completeness topics (each its own section
// / mastery bucket / skill-graph node / remediation-DAG node), formerly folded
// into a single "Extra Relevant Knowledge" bucket.
import { mgfLevels } from "./mgf/levels"; // → "Moment Generating Functions"
import { gammaLevels } from "./gammaDistribution/levels"; // → "Gamma Distribution"
import { jointDistributionsLevels } from "./jointDistributions/levels"; // → "Joint Distributions"
import { branchingLevels } from "./branchingProcesses/levels"; // → "Branching Processes"
import { ctmcLevels } from "./continuousTimeMarkov/levels"; // → "Continuous-Time Markov Chains"
import { limitTheoremsLevels } from "./limitTheorems/levels"; // → "Limit Theorems"
import { markovStructureLevels } from "./markovStructure/levels"; // → "Markov Chain Structure"

/**
 * Probability & Statistics — subcategory aggregator.
 *
 * Taxonomy: Category → Subcategory → Schema.
 *   Category    = "Probability & Statistics" (rides the Probability/Math track)
 *   Subcategory = one topic folder each (e.g. `bettingSizing/`)
 *   Schema      = the parametric question factories inside a subcategory
 *
 * DIFFICULTY ORDER: the subcategory blocks below are concatenated in
 * EASIEST → HARDEST order so the Probability/Math track's section dividers ramp
 * up difficulty (Core Probability, defined in `../probability/levels.ts`, is
 * always prepended at the front as the foundation). The order — and the
 * rationale for each topic — is documented in `CONTENT_NOTES.md`. A downstream
 * topic-selector reads section order directly from this level array, so the
 * export order below is the source of truth for "Level 1 … Level N".
 *
 * The former heterogeneous "General" subcategory has been DISSOLVED: every one
 * of its families was re-homed into a coherent topic (Combinatorial Analysis,
 * Geometric Probability, Order Statistics, Variance/Covariance & the CLT,
 * Markov Chains, Game Theory & Puzzles, Conditional Probability). Shared exact
 * solvers live in `./coreSolvers.ts` and generator scaffolding in
 * `./coreScaffold.ts`.
 *
 * SECTION CONSOLIDATION: the two small "game"-flavoured families — Game Theory
 * (strategic equilibria) and Game Puzzle (betting/odds puzzles) — are merged
 * into ONE labeled segment, `section: "Game Theory & Puzzles"` (retagged in
 * their own `levels.ts`). Because a section divider renders wherever `section`
 * changes, the merged levels must be CONTIGUOUS and ramp Easy→Hard. The two
 * source arrays each ramp Easy→Hard independently, so we interleave them by
 * difficulty. The re-homed optimizing-agents / market-making levels slot into
 * the hard run; the three open-ended "Desk" flashcard levels cap the segment.
 */
const gameTheoryAndPuzzleLevels: Level[] = [
  gameTheoryLevels[0], // gt-1 Dominant Strategies             (easy,   quiz)
  gamePuzzleLevels[0], // gp-1 Rig the Bags                    (easy,   numeric)
  gameTheoryLevels[1], // gt-2 Sequential Games                (medium, quiz)
  gameTheoryLevels[2], // gt-3 Position & Prediction           (medium, quiz)
  gameTheoryLevels[3], // gt-4 Zero-Sum Mixed Strategies       (hard,   numeric)
  gameTheoryLevels[4], // gt-5 Volunteer's Dilemma             (hard,   numeric)
  gamePuzzleLevels[1], // gp-2 Spotting Arbitrage              (hard,   numeric)
  gameTheoryLevels[5], // gt-spread Optimal Market-Making Spread (hard, numeric)
  gameTheoryLevels[6], // gt-agents Optimizing Agents          (hard,   numeric)
  gameTheoryLevels[7], // gt-6 Reasoning Desk                  (hard,   flashcard)
  gamePuzzleLevels[2], // gp-3 Betting Strategy Desk           (hard,   flashcard)
];

/**
 * Bucket 2 — **course-completeness topics**: UT M362K/M362M material that no
 * surveyed firm tests (per FIRM_TIMED_ASSESSMENTS), appended at the very END so
 * the trader-prep spine stays uncluttered while the course is complete. These
 * are now SEVEN FIRST-CLASS topics — each block carries its OWN `section`
 * (`Moment Generating Functions`, `Gamma Distribution`, `Joint Distributions`,
 * `Branching Processes`, `Continuous-Time Markov Chains`, `Limit Theorems`,
 * `Markov Chain Structure`), so each is an independent mastery bucket /
 * skill-graph node / remediation-DAG node (no longer folded into one shared
 * "Extra Relevant Knowledge" bucket). Each block's levels are CONTIGUOUS so the
 * section divider renders once per topic; the blocks ramp gentle → hard.
 */
const courseCompletionLevels: Level[] = [
  ...mgfLevels, // Moment Generating Functions (quiz)
  ...gammaLevels, // Gamma Distribution (numeric)
  ...jointDistributionsLevels, // Joint Distributions (numeric)
  ...branchingLevels, // Branching Processes (numeric)
  ...ctmcLevels, // Continuous-Time Markov Chains + queues (numeric)
  ...limitTheoremsLevels, // Limit Theorems: LLN/CLT + Chebyshev (quiz)
  ...markovStructureLevels, // Markov Chain Structure: Pⁿ / classification
];

/**
 * Probability & Statistics subcategories in EASIEST → HARDEST order. Core
 * Probability (the parametric on-ramp + hard interview problems) is prepended
 * separately in `../probability/levels.ts`.
 *
 *   1. Combinatorial Analysis         — elementary counting; low concept load.
 *   2. Geometric Probability          — a single idea (favourable measure ÷ total).
 *   3. Conditional Probability        — conditioning / Bayes; computationally light.
 *   4. Expected Value                 — the broad EV toolkit; builds on the above.
 *   4b. Conditional Expectation       — E[X|Y], tower rule, random sums (M362M). [ADD]
 *   5. Poisson Distribution & Process — discrete rare-event counts (uses E[X]=λ). [Bucket 1]
 *   6. Betting & Sizing               — Kelly: a focused application of EV + odds.
 *   7. Order Statistics               — continuous order stats (min, 1/n!, median).
 *   8. Continuous Distributions       — density integration, Uniform/Exp/Normal. [Bucket 1]
 *   9. Variance, Covariance & the CLT — second moments, CLT tails, concentration.
 *  10. Markov Chains                  — state recursions, ruin, stationary (πP=π). [+Bucket 1]
 *  11. Brownian Motion                — drift + √t variance scaling (advanced). [Bucket 1]
 *  12. Game Theory & Puzzles          — equilibria, mixed strategies, market making.
 *  13. Moment Generating Functions     — course completeness (M362K). [Bucket 2]
 *  14. Gamma Distribution              — course completeness (M362K). [Bucket 2]
 *  15. Joint Distributions             — course completeness (M362K). [Bucket 2]
 *  16. Branching Processes             — course completeness (M362M). [Bucket 2]
 *  17. Continuous-Time Markov Chains   — course completeness (M362M). [Bucket 2]
 *  18. Limit Theorems                  — course completeness (M362K). [Bucket 2]
 *  19. Markov Chain Structure          — course completeness (M362M). [Bucket 2]
 *
 * Placement rationale (UT_TOPICS_BUILD_PLAN.md): Poisson follows Expected Value
 * (it uses E[X]=λ); Continuous Distributions precedes Variance/CLT so the Normal
 * density is taught before the CLT reuses Φ(z); Brownian Motion caps the process
 * spine after Markov Chains; the stationary-distribution level lives inside the
 * existing Markov Chains section; the seven Bucket-2 course-completeness topics
 * are last, each its own section.
 */
export const probabilityStatsSubcategoryLevels: Level[] = [
  ...combinatorialAnalysisLevels,
  ...geometricProbabilityLevels,
  ...conditionalProbabilityLevels,
  ...expectedValueLevels,
  ...conditionalExpectationLevels,
  ...poissonLevels,
  ...bettingSizingLevels,
  ...orderStatisticsLevels,
  ...continuousDistributionsLevels,
  ...varianceCovarianceCltLevels,
  ...markovChainsLevels,
  ...brownianMotionLevels,
  ...gameTheoryAndPuzzleLevels,
  ...courseCompletionLevels,
];

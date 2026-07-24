import type { Level } from "@/types/content";
import { bettingSizingLevels } from "./bettingSizing/levels";
import { gameTheoryLevels } from "./gameTheory/levels";
import { gamePuzzleLevels } from "./gamePuzzle/levels";
import { expectedValueLevels } from "./expectedValue/levels";
import { conditionalProbabilityLevels } from "./conditionalProbability/levels";
import { markovChainsLevels } from "./markovChains/levels";
import { combinatorialAnalysisLevels } from "./combinatorialAnalysis/levels";
import { geometricProbabilityLevels } from "./geometricProbability/levels";
import { orderStatisticsLevels } from "./orderStatistics/levels";
import { varianceCovarianceCltLevels } from "./varianceCovarianceClt/levels";

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
  gameTheoryLevels[6], // gt-agents Optimizing Agents          (hard,   quiz)
  gameTheoryLevels[7], // gt-6 Reasoning Desk                  (hard,   flashcard)
  gamePuzzleLevels[2], // gp-3 Betting Strategy Desk           (hard,   flashcard)
];

/**
 * Probability & Statistics subcategories in EASIEST → HARDEST order. Core
 * Probability (the parametric on-ramp + hard interview problems) is prepended
 * separately in `../probability/levels.ts`.
 *
 *   1. Combinatorial Analysis        — elementary counting; low concept load.
 *   2. Geometric Probability         — a single idea (favourable measure ÷ total).
 *   3. Conditional Probability       — conditioning / Bayes; computationally light.
 *   4. Expected Value                — the broad EV toolkit; builds on the above.
 *   5. Betting & Sizing              — Kelly: a focused application of EV + odds.
 *   6. Order Statistics              — continuous order stats (min, 1/n!, median).
 *   7. Variance, Covariance & the CLT — second moments, CLT tails, concentration.
 *   8. Markov Chains                 — state recursions, hitting times, ruin.
 *   9. Game Theory & Puzzles         — equilibria, mixed strategies, market making.
 */
export const probabilityStatsSubcategoryLevels: Level[] = [
  ...combinatorialAnalysisLevels,
  ...geometricProbabilityLevels,
  ...conditionalProbabilityLevels,
  ...expectedValueLevels,
  ...bettingSizingLevels,
  ...orderStatisticsLevels,
  ...varianceCovarianceCltLevels,
  ...markovChainsLevels,
  ...gameTheoryAndPuzzleLevels,
];

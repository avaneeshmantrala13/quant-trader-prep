import type { Level } from "@/types/content";
import { mixNumeric } from "../coreScaffold";
import { genExpMedian, genMinInterval, genOrdering } from "./generators";

/**
 * Probability & Statistics — **Order Statistics**: a focused topic (re-homed
 * from the former "General" grab-bag) on the distribution of the minimum, the
 * probability of a specific ordering, and the median (the central order
 * statistic) of a continuous distribution. One `numeric` Candy-Crush level.
 *
 * Every level sets `section: "Order Statistics"`. Exact/precise solvers live in
 * `../coreSolvers`; generators + per-family distractor taxonomy in
 * `./generators.ts`. All playable items are freshly generated.
 */
const SECTION = "Order Statistics";

export const orderStatisticsLevels: Level[] = [
  {
    id: "os-1",
    title: "Minimums, Orderings & Medians",
    subtitle: "nth-power tails, 1/n! & ln2/λ",
    blurb:
      "Order statistics: P(minimum of n uniforms lands in an interval) via nth-power tails, P(a specific ordering) = 1/n!, and the exponential median ln2/λ.",
    section: SECTION,
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 5,
    numericGenerator: mixNumeric([genMinInterval, genOrdering, genExpMedian]),
    lesson: {
      paragraphs: [
        "The minimum of n iid uniforms is easy through its tail: P(min > x) = P(all > x) = ((b−x)/(b−a))ⁿ. So P(min ∈ [lo, hi]) = P(all > lo) − P(all > hi) — a difference of two nth powers. Don't confuse this with a single uniform's interval probability; the exponent n is the whole point. For strict orderings of n iid continuous variables, all n! orderings are equally likely (ties have probability 0), so any ONE specified order has probability 1/n! — not the ½-per-comparison 1/2^{n−1}.",
        "The median is the central order statistic. For an exponential Exp(λ), the median solves 1 − e^{−λm} = ½, giving m = ln2/λ — strictly below the mean 1/λ because the exponential is right-skewed. The recurring traps are reporting the mean for the median, and forgetting the exponent n on the minimum's tail probabilities.",
      ],
      keyIdea: "P(min ∈ [lo,hi]) = ((b−lo)/(b−a))ⁿ − ((b−hi)/(b−a))ⁿ; one ordering = 1/n!; Exp median = ln2/λ.",
      whyInterviewers:
        "Order-statistic questions reward the 'all orderings equally likely' insight and the min's nth-power tail over brute-force integration.",
    },
  },
];

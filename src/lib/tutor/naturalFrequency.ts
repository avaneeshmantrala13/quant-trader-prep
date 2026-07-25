/**
 * Natural-frequency trees (PHASE_2 §5, rung 2).
 *
 * Research anchor: Gigerenzer & Hoffrage 1995 — presenting a Bayesian problem as
 * NATURAL FREQUENCIES ("8 of 1000 …") instead of probabilities raises correct
 * Bayesian reasoning from ~16% to ~46%. This module converts a
 * prevalence/sensitivity/false-positive-rate (or any P(A), P(B|A), P(B|¬A)) into
 * whole-count branches out of a round `total`, and LEAVES THE FINAL DIVISION
 * BLANK so the learner performs the last step themselves (answer-withholding).
 */

export interface NaturalFrequencyTree {
  /** The round population the counts are expressed out of (e.g. 1000). */
  total: number;
  /** One branch per hypothesis: how many are in it and how many of those test +. */
  branches: { label: string; count: number; positive: number }[];
  /** The Bayes ratio with the final division deliberately left for the learner. */
  finalRatioBlank: string;
}

/**
 * Convert prevalence/sensitivity/fpr to natural-frequency counts out of `total`.
 *
 * With `total = 1000`, prior 1%, sens 80%, fpr 9.6% ⇒ 10 sick (8 test +),
 * 990 healthy (95 test +), and `finalRatioBlank = "8 / (8 + 95)"` — the learner
 * still has to divide, which is the whole point (Gigerenzer & Hoffrage 1995).
 */
export function naturalFrequencyTree(p: {
  prior: number;
  sens: number;
  fpr: number;
  total?: number;
}): NaturalFrequencyTree {
  const total = p.total ?? 1000;
  const withCond = Math.round(p.prior * total);
  const without = total - withCond;
  const truePos = Math.round(withCond * p.sens);
  const falsePos = Math.round(without * p.fpr);
  return {
    total,
    branches: [
      { label: "have it", count: withCond, positive: truePos },
      { label: "don't have it", count: without, positive: falsePos },
    ],
    finalRatioBlank: `${truePos} / (${truePos} + ${falsePos})`,
  };
}

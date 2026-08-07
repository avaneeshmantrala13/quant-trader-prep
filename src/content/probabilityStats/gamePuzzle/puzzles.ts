import Fraction from "fraction.js";

/**
 * Exact solvers for the Probability & Statistics → Game Puzzle subcategory
 * (betting / odds puzzles).
 *
 * Families:
 *   • Probability optimization, "Rig the Bags" (law of total probability):
 *     split tokens across two bags to maximize P(draw gold). VERIFIABLE scalar.
 *   • Arbitrage / value betting, convert quoted odds to implied probability;
 *     a set of mutually-exclusive outcomes whose implied probabilities sum
 *     below 1 admits an arbitrage. The implied-probability SUM is a verifiable
 *     scalar (arb ⇔ sum < 1); the full staking plan is open-ended (flashcard).
 *   • Parimutuel, open-ended, bet against known opponents (flashcard only).
 *
 * All arithmetic is exact rational via `fraction.js`.
 */

export const F = (n: number | string | bigint, d?: number | bigint): Fraction =>
  d === undefined ? new Fraction(n as never) : new Fraction(n as never, d);

export function fracText(f: Fraction): string {
  return f.toFraction(false);
}

export function decText(f: Fraction, dp: number): string {
  return f.valueOf().toFixed(dp);
}

/* ========================================================================== */
/*  Family: Rig the Bags, probability optimization (law of total prob)       */
/* ========================================================================== */

export interface BagSplit {
  g1: number;
  b1: number;
  g2: number;
  b2: number;
}

/** P(draw gold) = ½·(g1/(g1+b1)) + ½·(g2/(g2+b2)) for a two-bag split (exact). */
export function bagWinProb(split: BagSplit): Fraction {
  const { g1, b1, g2, b2 } = split;
  const n1 = g1 + b1;
  const n2 = g2 + b2;
  if (n1 < 1 || n2 < 1) throw new Error("each bag must hold ≥ 1 token");
  const f1 = F(g1, n1);
  const f2 = F(g2, n2);
  return F(1, 2).mul(f1).add(F(1, 2).mul(f2));
}

/**
 * Exhaustive optimum over ALL valid two-bag splits of `gold` gold + `black`
 * black tokens (each bag ≥ 1 token). Independent brute-force verifier, does
 * not assume the closed-form "one gold alone" trick.
 */
export function rigBagsOptimum(
  gold: number,
  black: number,
): { best: Fraction; split: BagSplit } {
  let best: Fraction | null = null;
  let bestSplit: BagSplit | null = null;
  for (let g1 = 0; g1 <= gold; g1++) {
    for (let b1 = 0; b1 <= black; b1++) {
      const n1 = g1 + b1;
      const n2 = gold - g1 + (black - b1);
      if (n1 < 1 || n2 < 1) continue;
      const p = bagWinProb({ g1, b1, g2: gold - g1, b2: black - b1 });
      if (best === null || p.valueOf() > best.valueOf()) {
        best = p;
        bestSplit = { g1, b1, g2: gold - g1, b2: black - b1 };
      }
    }
  }
  if (best === null || bestSplit === null)
    throw new Error("no valid split");
  return { best, split: bestSplit };
}

/** Closed form for the optimum: one gold token alone in a bag. */
export function rigBagsClosedForm(gold: number, black: number): Fraction {
  if (gold < 1) throw new Error("need at least one gold token");
  // Bag 1: the lone gold token (fraction 1). Bag 2: the rest.
  return bagWinProb({ g1: 1, b1: 0, g2: gold - 1, b2: black });
}

/* ========================================================================== */
/*  Family: Arbitrage, implied probability from decimal odds                 */
/* ========================================================================== */

/** Implied (break-even) probability of a decimal-odds quote o: 1/o (exact). */
export function impliedFromDecimal(decimalOdds: string): Fraction {
  return F(1).div(F(decimalOdds));
}

/**
 * Sum of implied probabilities across mutually-exclusive outcomes. An
 * arbitrage exists iff this sum is strictly below 1 (you can stake so every
 * outcome returns more than the total staked). Above 1 is the bookmaker's
 * "overround"; exactly 1 is a fair book.
 */
export function impliedProbabilitySum(decimalOdds: string[]): Fraction {
  return decimalOdds.reduce((acc, o) => acc.add(impliedFromDecimal(o)), F(0));
}

export function hasArbitrage(decimalOdds: string[]): boolean {
  return impliedProbabilitySum(decimalOdds).valueOf() < 1;
}

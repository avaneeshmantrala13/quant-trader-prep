import Fraction from "fraction.js";

/**
 * Exact game-theory solvers for the Probability & Statistics → Game Theory
 * subcategory.
 *
 * Category → Subcategory → Family:
 *   Probability & Statistics → Game Theory → {dominant strategy / PD,
 *   backward induction, Hotelling, zero-sum 2×2 & 3×2 mixed strategy,
 *   Volunteer's Dilemma, beauty contest, + 3 reasoning-only families}.
 *
 * Every scalar ground-truth (mixed-strategy VALUE of a game, a Volunteer's
 * Dilemma probability, a payoff at a subgame-perfect equilibrium) is computed
 * with exact rationals via `fraction.js` — never floating point — so the
 * generator's answer key and the verifier agree bit-for-bit and every
 * distractor is a re-derived, named misconception rather than an arbitrary
 * offset.
 */

/** Convenience Fraction constructor. */
export const F = (n: number | string | bigint, d?: number | bigint): Fraction =>
  d === undefined ? new Fraction(n as never) : new Fraction(n as never, d);

/** "n/d", or "n" when the denominator is 1. */
export function fracText(f: Fraction): string {
  return f.toFraction(false);
}

/** Decimal string with fixed places (for value-of-game / probability display). */
export function decText(f: Fraction, dp: number): string {
  return f.valueOf().toFixed(dp);
}

/* ========================================================================== */
/*  Family: Simultaneous / dominant strategy (Prisoner's Dilemma)             */
/* ========================================================================== */

/**
 * A symmetric 2×2 game described by the four payoffs to YOU. A Prisoner's
 * Dilemma requires the strict ordering T > R > P > S.
 *   R = reward   (both Cooperate)
 *   S = sucker   (you Cooperate, opponent Defects)
 *   T = temptation (you Defect, opponent Cooperates)
 *   P = punishment (both Defect)
 */
export interface PdPayoffs {
  R: number;
  S: number;
  T: number;
  P: number;
}

/** True iff (R,S,T,P) form a strict Prisoner's Dilemma (T>R>P>S). */
export function isPrisonersDilemma({ R, S, T, P }: PdPayoffs): boolean {
  return T > R && R > P && P > S;
}

/**
 * Solve a symmetric PD by dominance. "Defect" is strictly dominant (T>R and
 * P>S), so the unique Nash equilibrium is (Defect, Defect) with payoff P.
 */
export function pdEquilibriumPayoff(pd: PdPayoffs): number {
  if (!isPrisonersDilemma(pd))
    throw new Error("payoffs are not a strict Prisoner's Dilemma");
  return pd.P;
}

/* ========================================================================== */
/*  Family: Sequential / backward induction (entry game)                      */
/* ========================================================================== */

/**
 * A three-stage entry game. Payoffs are written (challenger, incumbent).
 *   Challenger: StayOut → (cOut,iOut) | Enter →
 *     Incumbent: Fight → (cFight,iFight) | Accommodate →
 *       Challenger: Hold → (cHold,iHold) | Expand → (cExpand,iExpand)
 */
export interface EntryGame {
  cOut: number;
  iOut: number;
  cFight: number;
  iFight: number;
  cHold: number;
  iHold: number;
  cExpand: number;
  iExpand: number;
}

export interface EntrySolution {
  /** Challenger's final move on the accommodate branch. */
  lastMove: "Expand" | "Hold";
  /** Incumbent's move after entry. */
  incumbentMove: "Fight" | "Accommodate";
  /** Challenger's opening move. */
  firstMove: "Enter" | "StayOut";
  /** Challenger's payoff at the subgame-perfect equilibrium. */
  challengerPayoff: number;
  /** True iff the "I'll fight" threat is non-credible (fighting hurts incumbent). */
  threatNonCredible: boolean;
}

/** Backward induction on the entry game → subgame-perfect equilibrium. */
export function solveEntryGame(g: EntryGame): EntrySolution {
  // Stage 1: challenger's last move (only reached after Accommodate).
  const lastMove = g.cExpand > g.cHold ? "Expand" : "Hold";
  const cAfterAccommodate = lastMove === "Expand" ? g.cExpand : g.cHold;
  const iAfterAccommodate = lastMove === "Expand" ? g.iExpand : g.iHold;

  // Stage 2: incumbent picks Fight vs Accommodate given the challenger's reply.
  const incumbentMove = iAfterAccommodate > g.iFight ? "Accommodate" : "Fight";
  const cAfterIncumbent =
    incumbentMove === "Accommodate" ? cAfterAccommodate : g.cFight;

  // Stage 3: challenger enters iff that beats staying out.
  const firstMove = cAfterIncumbent > g.cOut ? "Enter" : "StayOut";
  const challengerPayoff = firstMove === "Enter" ? cAfterIncumbent : g.cOut;

  return {
    lastMove,
    incumbentMove,
    firstMove,
    challengerPayoff,
    // The threat to Fight is non-credible when, at the actual decision node,
    // accommodating pays the incumbent strictly more than fighting.
    threatNonCredible: iAfterAccommodate > g.iFight,
  };
}

/* ========================================================================== */
/*  Family: Spatial competition (Hotelling / median voter)                    */
/* ========================================================================== */

/**
 * Two vendors on a segment [0, L] with `customers` buyers spread uniformly.
 * Unique Nash equilibrium: both locate at the median (L/2) and split the
 * market, so each serves customers/2. Requires an even customer count for a
 * clean integer.
 */
export function hotellingShare(customers: number): number {
  if (customers % 2 !== 0) throw new Error("use an even customer count");
  return customers / 2;
}

/* ========================================================================== */
/*  Family: Zero-sum 2×2 & 3×2 (mixed strategy, minimax value)                */
/* ========================================================================== */

/** Row-player payoffs of a 2×2 zero-sum game: rows Top/Bottom × cols L/R. */
export interface ZeroSum2x2 {
  /** Top-Left, Top-Right, Bottom-Left, Bottom-Right (payoff to the ROW player). */
  a: number;
  b: number;
  c: number;
  d: number;
}

/**
 * A pure saddle point exists iff the row maximin equals the column minimax.
 * When it does, the game has a pure value and mixing is unnecessary (we then
 * reject the instance so every generated item genuinely requires a mixed
 * strategy).
 */
export function saddleValue2x2(m: ZeroSum2x2): number | null {
  const rowMin = [Math.min(m.a, m.b), Math.min(m.c, m.d)];
  const maximin = Math.max(rowMin[0], rowMin[1]);
  const colMax = [Math.max(m.a, m.c), Math.max(m.b, m.d)];
  const minimax = Math.min(colMax[0], colMax[1]);
  return maximin === minimax ? maximin : null;
}

export interface MixedSolution {
  /** Row player's probability of playing Top (exact). */
  pTop: Fraction;
  /** Column player's probability of playing Left (exact). */
  qLeft: Fraction;
  /** The exact value of the game (row player's guaranteed expected payoff). */
  value: Fraction;
}

/**
 * Solve a saddle-free 2×2 zero-sum game via the indifference principle:
 *   p(Top) = (d − c)/(a − b − c + d),  q(Left) = (d − b)/(a − b − c + d),
 *   value  = (a·d − b·c)/(a − b − c + d).
 * Throws if the game has a pure saddle point (mixing not required).
 */
export function solveMixed2x2(m: ZeroSum2x2): MixedSolution {
  if (saddleValue2x2(m) !== null)
    throw new Error("game has a pure saddle point; no mixing required");
  const denom = m.a - m.b - m.c + m.d;
  if (denom === 0) throw new Error("degenerate 2×2 (zero denominator)");
  const pTop = F(m.d - m.c, denom);
  const qLeft = F(m.d - m.b, denom);
  const value = F(m.a * m.d - m.b * m.c, denom);
  return { pTop, qLeft, value };
}

/** Row-player payoffs of a 3×2 zero-sum game (rows Top/Middle/Bottom × L/R). */
export interface ZeroSum3x2 {
  rows: [[number, number], [number, number], [number, number]];
}

export interface DominanceSolution extends MixedSolution {
  /** Index (0/1/2) of the strictly dominated row that was deleted. */
  deletedRow: number;
  /** The surviving 2×2 after deletion. */
  reduced: ZeroSum2x2;
  /**
   * Payoff the deleted (dominated) row would have earned against the opponent's
   * optimal mix — strictly below the value, confirming deletion was safe.
   */
  deletedRowValue: Fraction;
}

/**
 * Solve a 3×2 zero-sum game by first eliminating a strictly dominated row
 * (a row beaten by another row in BOTH columns), then solving the resulting
 * saddle-free 2×2 by mixing.
 */
export function solveDominance3x2(g: ZeroSum3x2): DominanceSolution {
  const rows = g.rows;
  // Find a strictly dominated row (some other row is strictly larger in both cols).
  let deletedRow = -1;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (i === j) continue;
      if (rows[j][0] > rows[i][0] && rows[j][1] > rows[i][1]) {
        deletedRow = i;
        break;
      }
    }
    if (deletedRow >= 0) break;
  }
  if (deletedRow < 0)
    throw new Error("no strictly dominated row to eliminate");
  const survivors = [0, 1, 2].filter((i) => i !== deletedRow);
  const [r0, r1] = survivors;
  const reduced: ZeroSum2x2 = {
    a: rows[r0][0],
    b: rows[r0][1],
    c: rows[r1][0],
    d: rows[r1][1],
  };
  const sol = solveMixed2x2(reduced);
  // What the discarded row would have paid against q(Left): row·(q, 1−q).
  const q = sol.qLeft;
  const del = rows[deletedRow];
  const deletedRowValue = q.mul(del[0]).add(F(1).sub(q).mul(del[1]));
  return { ...sol, deletedRow, reduced, deletedRowValue };
}

/* ========================================================================== */
/*  Family: Volunteer's Dilemma (symmetric mixed equilibrium)                 */
/* ========================================================================== */

/**
 * N players; any single volunteer produces a benefit `b` to everyone, but the
 * volunteer pays a cost `c` (0 < c < b). In the symmetric mixed equilibrium
 * each player volunteers with probability p solving (1−p)^(N−1) = c/b, so
 *   1 − p = (c/b)^(1/(N−1))  and  P(nobody volunteers) = (1−p)^N = (c/b)^(N/(N−1)).
 *
 * To keep the ground truth an EXACT rational we take the base probability of
 * NOT volunteering, `notVolunteerBase = 1 − p = 1/m`, as the free parameter and
 * derive the consistent ratio c/b = (1/m)^(N−1). The caller supplies (N, m, b)
 * and we return the exact p, the required cost c, and P(nobody).
 */
export interface VolunteerSetup {
  N: number;
  /** 1 − p = 1/m (m ≥ 2). Keeps p and P(nobody) exact rationals. */
  m: number;
  /** Benefit b to everyone once someone volunteers. */
  b: number;
}

export interface VolunteerSolution {
  /** Probability each player volunteers (exact). */
  p: Fraction;
  /** Integer cost c consistent with the chosen (N, m, b): c = b·(1/m)^(N−1). */
  c: number;
  /** c/b as an exact fraction. */
  ratio: Fraction;
  /** P(nobody volunteers) = (1/m)^N (exact). */
  pNobody: Fraction;
}

export function solveVolunteer({ N, m, b }: VolunteerSetup): VolunteerSolution {
  if (N < 2) throw new Error("need at least 2 players");
  if (m < 2) throw new Error("m must be ≥ 2");
  const notVol = F(1, m); // 1 − p
  const p = F(1).sub(notVol);
  const ratio = notVol.pow(N - 1); // c/b = (1/m)^(N−1)
  const cFrac = ratio.mul(b);
  if (Number(cFrac.d) !== 1)
    throw new Error("chosen (N, m, b) does not yield an integer cost c");
  const c = Number(cFrac.n);
  const pNobody = notVol.pow(N); // (1/m)^N
  return { p, c, ratio, pNobody };
}

/* ========================================================================== */
/*  Family: Beauty contest (iterated dominance → equilibrium 0)               */
/* ========================================================================== */

/**
 * Keynesian beauty contest: everyone writes an integer in [0, max]; the winner
 * is closest to `target` × (average). Iterated elimination of dominated
 * strategies collapses to the unique Nash equilibrium 0. Level-k play gives the
 * distractor ladder L0 = max/2, Lk = target^k · (max/2).
 */
export function beautyEquilibrium(): number {
  return 0;
}

/** The level-k guess ladder (rounded) used for distractors, L0..Ldepth. */
export function beautyLevelLadder(
  max: number,
  target: Fraction,
  depth: number,
): number[] {
  const ladder: number[] = [];
  let g = max / 2; // L0
  for (let k = 0; k <= depth; k++) {
    ladder.push(Math.round(g));
    g = target.valueOf() * g;
  }
  return ladder;
}

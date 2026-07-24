import Fraction from "fraction.js";

/**
 * Exact solvers for the Probability & Statistics → Expected Value subcategory.
 *
 * Expected Value is NOT a single repeating formula — it is a cluster of ~25
 * solution-method "families" (optimal stopping, coupon collector, Wald's
 * identity, indicators + linearity, order statistics, geometric /
 * memorylessness, first-step recursion, gambler's-ruin durations, geometric
 * probability by area, divergent-EV sentinels, …). So this file is organised by
 * FAMILY, each with an EXACT solver. All arithmetic is exact rational via
 * `fraction.js` (never floats) wherever the ground truth is rational; the
 * genuinely irrational / procedure / divergent families are routed to `quiz` or
 * `flashcard` (no forced scalar) instead of numeric grading.
 *
 * None of the 85 source-dataset questions are user-facing — they live only in
 * `./expectedValue.test.ts` as hidden fixtures (`SEED_ANSWERS`), and this
 * solver is asserted to reproduce them there.
 */

export const F = (n: number | string | bigint, d?: number | bigint): Fraction =>
  d === undefined ? new Fraction(n as never) : new Fraction(n as never, d);

export function fracText(f: Fraction): string {
  return f.toFraction(false);
}

export function decText(f: Fraction, dp: number): string {
  return f.valueOf().toFixed(dp);
}

/** Smallest decimal places d (≤ cap) making f·10^d an exact integer, else cap. */
export function exactDecimals(f: Fraction, cap = 6): number {
  for (let d = 0; d <= cap; d++) {
    if (Number(f.mul(10 ** d).d) === 1) return d;
  }
  return cap;
}

/* ========================================================================== */
/*  Harmonic numbers — the backbone of coupon-collector & records families    */
/* ========================================================================== */

/** Exact H_n = Σ_{k=1..n} 1/k (rational). H_0 = 0. */
export function harmonic(n: number): Fraction {
  if (n < 0 || !Number.isInteger(n)) throw new Error("n must be a nonneg int");
  let h = F(0);
  for (let k = 1; k <= n; k++) h = h.add(F(1, k));
  return h;
}

/* ========================================================================== */
/*  FAMILY — Coupon collector (indicator + linearity of geometric waits)      */
/* ========================================================================== */

/**
 * Expected draws (with replacement) to collect ALL n distinct coupons:
 *   E = n·H_n = Σ_{k=1..n} n/(n−k+1).
 * The classic trap is dropping the final 1/(n−k) = 1/1 = n term (the last,
 * hardest coupon), which costs the largest single wait.
 */
export function couponCollectorAll(n: number): Fraction {
  if (n < 1) throw new Error("need ≥ 1 coupon type");
  return F(n).mul(harmonic(n));
}

/**
 * Expected draws to collect k of n distinct coupons (0 ≤ k ≤ n):
 *   E = Σ_{i=0..k−1} n/(n−i) = n·(H_n − H_{n−k}).
 */
export function couponCollectorPartial(n: number, k: number): Fraction {
  if (n < 1 || k < 0 || k > n) throw new Error("need 0 ≤ k ≤ n, n ≥ 1");
  let e = F(0);
  for (let i = 0; i < k; i++) e = e.add(F(n, n - i));
  return e;
}

/* ========================================================================== */
/*  FAMILY — Geometric waiting time & memorylessness                          */
/* ========================================================================== */

/** E[trials to first success] for a geometric(p): 1/p (support {1,2,…}). */
export function geometricEV(p: Fraction): Fraction {
  if (p.valueOf() <= 0 || p.valueOf() > 1) throw new Error("need 0 < p ≤ 1");
  return F(1).div(p);
}

/**
 * Memorylessness: given you have already waited `elapsed` failures for a
 * geometric(p) process, the EXPECTED TOTAL number of trials counted from the
 * very start, conditioned on no success yet, is `elapsed + 1/p` — the elapsed
 * time does NOT shrink the remaining wait (1/p), it just adds on. The classic
 * error is reporting 1/p and forgetting to add the elapsed m.
 */
export function geometricMemorylessTotal(p: Fraction, elapsed: number): Fraction {
  return F(elapsed).add(geometricEV(p));
}

/* ========================================================================== */
/*  FAMILY — Optimal stopping / re-roll a die                                 */
/* ========================================================================== */

/**
 * Expected final value of an N-sided die with up to `rerolls` optional
 * re-rolls, playing optimally (keep iff the current face ≥ EV of continuing).
 * With 0 rerolls it is the plain mean (N+1)/2; each extra reroll raises the
 * continuation value. Exact rational throughout.
 */
export function rerollDieEV(N: number, rerolls: number): Fraction {
  if (N < 1 || rerolls < 0) throw new Error("need N ≥ 1, rerolls ≥ 0");
  // Continuation value with r rerolls remaining, computed bottom-up.
  let cont = F(N + 1, 2); // r = 0: just take the roll → mean
  for (let r = 1; r <= rerolls; r++) {
    // With r rerolls: for each face x, keep max(x, cont_{r-1}); average over faces.
    let sum = F(0);
    for (let x = 1; x <= N; x++) {
      sum = sum.add(F(x).valueOf() >= cont.valueOf() ? F(x) : cont);
    }
    cont = sum.div(F(N));
  }
  return cont;
}

/* ========================================================================== */
/*  FAMILY — Order statistics (discrete: max/min of dice)                     */
/* ========================================================================== */

/**
 * E[max of `dice` independent fair N-sided dice] via P(max ≥ k):
 *   E[max] = Σ_{k=1..N} P(max ≥ k) = Σ_{k=1..N} [1 − ((k−1)/N)^dice].
 * Exact rational (e.g. two d6 → 161/36).
 */
export function maxOfDiceEV(N: number, dice: number): Fraction {
  if (N < 1 || dice < 1) throw new Error("need N ≥ 1, dice ≥ 1");
  let e = F(0);
  for (let k = 1; k <= N; k++) {
    e = e.add(F(1).sub(F(k - 1, N).pow(dice)));
  }
  return e;
}

/**
 * E[min of `dice` independent fair N-sided dice] via P(min ≥ k):
 *   E[min] = Σ_{k=1..N} P(min ≥ k) = Σ_{k=1..N} ((N−k+1)/N)^dice.
 */
export function minOfDiceEV(N: number, dice: number): Fraction {
  if (N < 1 || dice < 1) throw new Error("need N ≥ 1, dice ≥ 1");
  let e = F(0);
  for (let k = 1; k <= N; k++) {
    e = e.add(F(N - k + 1, N).pow(dice));
  }
  return e;
}

/* ========================================================================== */
/*  FAMILY — Continuous order statistics / spacings (uniform (0,1))           */
/* ========================================================================== */

/**
 * E[k-th smallest of n i.i.d. Uniform(0,1)] = k/(n+1). Consequently n points
 * split (0,1) into n+1 equal expected spacings of 1/(n+1). Exact rational.
 */
export function uniformOrderStatEV(k: number, n: number): Fraction {
  if (n < 1 || k < 1 || k > n) throw new Error("need 1 ≤ k ≤ n");
  return F(k, n + 1);
}

/* ========================================================================== */
/*  FAMILY — Wald's identity (random sum)                                      */
/* ========================================================================== */

/**
 * Wald: for a random number N of i.i.d. terms (N a stopping time, independent
 * of the future terms), E[Σ_{i=1..N} X_i] = E[N]·E[X]. The classic error is
 * using the wrong count (e.g. E[N]−1, or the max count) or adding instead of
 * multiplying.
 */
export function waldEV(expectedCount: Fraction, expectedTerm: Fraction): Fraction {
  return expectedCount.mul(expectedTerm);
}

/* ========================================================================== */
/*  FAMILY — Indicators + linearity                                            */
/* ========================================================================== */

/**
 * Expected number of records (running maxima) in a random permutation of n
 * distinct values: E = H_n (item i is a record w.p. 1/i, sum by linearity).
 */
export function expectedRecords(n: number): Fraction {
  return harmonic(n);
}

/**
 * Expected number of fixed points of a uniformly random permutation of n
 * elements = 1 (each position is fixed w.p. 1/n; n·(1/n) = 1), for every n ≥ 1.
 */
export function expectedFixedPoints(_n: number): Fraction {
  return F(1);
}

/**
 * Expected number of DISTINCT coupons seen after m draws (with replacement)
 * from n types: E = n·(1 − ((n−1)/n)^m) by indicators (type present w.p.
 * 1 − ((n−1)/n)^m). Exact rational.
 */
export function expectedDistinctAfterDraws(n: number, m: number): Fraction {
  if (n < 1 || m < 0) throw new Error("need n ≥ 1, m ≥ 0");
  return F(n).mul(F(1).sub(F(n - 1, n).pow(m)));
}

/**
 * Expected number of adjacent equal pairs ("matches") in a line of m i.i.d.
 * draws from n symbols: (m−1)·(1/n) by indicators over the m−1 adjacent gaps.
 */
export function expectedAdjacentMatches(n: number, m: number): Fraction {
  if (n < 1 || m < 1) throw new Error("need n ≥ 1, m ≥ 1");
  return F(m - 1).mul(F(1, n));
}

/* ========================================================================== */
/*  FAMILY — Variance / E[X²] (second moments)                                 */
/* ========================================================================== */

/** E[X] of a fair N-sided die. */
export function dieMean(N: number): Fraction {
  return F(N + 1, 2);
}

/** E[X²] of a fair N-sided die = (N+1)(2N+1)/6. */
export function dieSecondMoment(N: number): Fraction {
  return F((N + 1) * (2 * N + 1), 6);
}

/** Var(X) of a fair N-sided die = (N²−1)/12 = E[X²] − (E[X])². */
export function dieVariance(N: number): Fraction {
  return dieSecondMoment(N).sub(dieMean(N).pow(2));
}

/* ========================================================================== */
/*  FAMILY — Gambler's-ruin / symmetric random-walk durations                  */
/* ========================================================================== */

/**
 * Expected duration (number of fair ±1 steps) of a symmetric random walk that
 * starts at i and stops at 0 or N: E = i·(N − i). The classic error is the
 * hitting PROBABILITY i/N (a different question) or i·N (dropping the −i).
 */
export function symmetricWalkDuration(i: number, N: number): Fraction {
  if (i < 0 || i > N || N < 1) throw new Error("need 0 ≤ i ≤ N, N ≥ 1");
  return F(i * (N - i));
}

/**
 * Probability a symmetric ±1 walk from i reaches N before 0 = i/N (exact).
 * (Included as the sibling scalar so a distractor can be re-derived exactly.)
 */
export function symmetricWalkReachProb(i: number, N: number): Fraction {
  if (i < 0 || i > N || N < 1) throw new Error("need 0 ≤ i ≤ N, N ≥ 1");
  return F(i, N);
}

/* ========================================================================== */
/*  FAMILY — Geometric probability (EV / probability by area)                  */
/* ========================================================================== */

/**
 * P(|X − Y| ≤ t) for X, Y i.i.d. Uniform(0, L), by the area of the band
 * |x−y| ≤ t inside the L×L square: 1 − ((L−t)/L)². Exact rational for rational
 * inputs. (The "two people meet within t minutes of a window L" chestnut.)
 */
export function meetWithinProb(L: Fraction, t: Fraction): Fraction {
  if (t.valueOf() < 0 || t.valueOf() > L.valueOf())
    throw new Error("need 0 ≤ t ≤ L");
  const gap = L.sub(t).div(L);
  return F(1).sub(gap.pow(2));
}

/* ========================================================================== */
/*  FAMILY — First-step recursion (expected waits for coin patterns)           */
/* ========================================================================== */

/**
 * Expected number of fair-coin flips to first see the pattern HH…H (a run of
 * `k` heads), fair coin: E = 2^{k+1} − 2 = Σ_{j=1..k} 2^j. Exact integer.
 * (First-step / state recursion; the run-of-two case gives the classic 6.)
 */
export function expectedFlipsRunOfHeads(k: number): Fraction {
  if (k < 1) throw new Error("need k ≥ 1");
  return F(2 ** (k + 1) - 2);
}

/**
 * Expected flips to first see the 2-pattern "HT" (distinct symbols) with a fair
 * coin = 4, vs "HH" = 6 — overlap makes same-symbol patterns wait longer. This
 * returns the general fair-coin expected wait for "HT"-type (no self-overlap)
 * length-2 patterns: 4.
 */
export function expectedFlipsHT(): Fraction {
  return F(4);
}

/* ========================================================================== */
/*  FAMILY — Divergent EV (St. Petersburg-type sentinels)                      */
/* ========================================================================== */

/**
 * Sentinel for a DIVERGENT expected value. The dataset marks a few games whose
 * EV is +∞ (a "tripling die", a "widening wheel", St. Petersburg): the naive
 * finite partial sums tempt a finite answer, but Σ diverges. We NEVER surface a
 * numeric target for these — they are represented as `quiz`/`flashcard` where
 * "infinite / diverges" is the correct choice. This constant is the internal
 * sentinel used by the solver/fixture (NOT a graded numeric value).
 */
export const DIVERGENT = Number.POSITIVE_INFINITY;

/**
 * St.-Petersburg-style series: each round k occurs with probability `prob`^k and
 * pays `payoff`^k, contributing (prob·payoff)^k to the EV. The full series
 * Σ_{k≥1} (prob·payoff)^k DIVERGES iff prob·payoff ≥ 1 (each term stays ≥ a
 * positive constant), otherwise it converges to a finite geometric sum. Returns
 * the finite partial sum of the first `terms` rounds (the tempting finite
 * analog to show as a distractor) and the divergence verdict.
 */
export function stPetersburgSeries(
  prob: Fraction,
  payoff: Fraction,
  terms: number,
): { partial: Fraction; perTerm: Fraction; diverges: boolean } {
  const perTerm = prob.mul(payoff); // common ratio of the EV series
  let partial = F(0);
  for (let k = 1; k <= terms; k++) partial = partial.add(perTerm.pow(k));
  return { partial, perTerm, diverges: perTerm.valueOf() >= 1 };
}

/**
 * Convergent geometric-EV closed form Σ_{k≥1} r^k = r/(1−r) for r < 1 (e.g. the
 * classic doubling-prize game with r = ½ summing to a finite $1-per-term total).
 * Used to build the tempting FINITE distractor for divergent-EV questions.
 */
export function convergentGeometricEV(r: Fraction): Fraction {
  if (r.valueOf() >= 1) throw new Error("series diverges; no finite EV");
  return r.div(F(1).sub(r));
}

/* ========================================================================== */
/*  FAMILY — First-step recursion: patterns of die/coin faces                  */
/* ========================================================================== */

/**
 * Expected trials to see the SAME symbol twice in a row, per-trial success
 * probability p: E = (1 + p)/p². (Self-overlap makes it longer than a distinct
 * pair.) Fair die → p = 1/6 → 42; a d8 → p = 1/8 → 72.
 */
export function expectedTrialsPairSame(p: Fraction): Fraction {
  if (p.valueOf() <= 0 || p.valueOf() > 1) throw new Error("need 0 < p ≤ 1");
  return F(1).add(p).div(p.pow(2));
}

/**
 * Expected trials to see ordered pair "A then B" (distinct symbols) with
 * per-trial probabilities a and b (a+b ≤ 1): E = 1/(a·b). Fair die "a 5 right
 * after a 6" → 1/((1/6)(1/6)) = 36. Derived from the exact 2-state chain.
 */
export function expectedTrialsOrderedPair(a: Fraction, b: Fraction): Fraction {
  if (a.valueOf() <= 0 || b.valueOf() <= 0)
    throw new Error("need a, b > 0");
  return F(1).div(a.mul(b));
}

/**
 * Expected trials to a success that only counts on an EVEN-numbered trial
 * (successes on odd trials are wasted), per-trial success probability p:
 * E = 2/p. Fair die targeting a 6 → 12.
 */
export function expectedTrialsSuccessOnEven(p: Fraction): Fraction {
  if (p.valueOf() <= 0 || p.valueOf() > 1) throw new Error("need 0 < p ≤ 1");
  return F(2).div(p);
}

/* ========================================================================== */
/*  FAMILY — Negative binomial / sum of geometrics                             */
/* ========================================================================== */

/** E[trials to the r-th success], per-trial success prob p: r/p. */
export function negBinomialEV(r: number, p: Fraction): Fraction {
  if (r < 1) throw new Error("need r ≥ 1");
  return F(r).div(p);
}

/**
 * Geometric-sum game value: each round pays `perRound` in expectation and
 * continues (independently) with probability `pContinue` < 1. Total EV =
 * perRound / (1 − pContinue). (Roll-and-spin carnival game family.)
 */
export function geometricSumEV(perRound: Fraction, pContinue: Fraction): Fraction {
  if (pContinue.valueOf() < 0 || pContinue.valueOf() >= 1)
    throw new Error("need 0 ≤ pContinue < 1");
  return perRound.div(F(1).sub(pContinue));
}

/* ========================================================================== */
/*  FAMILY — Optimal stopping: bust game & one costly reroll                   */
/* ========================================================================== */

/**
 * Fixed-point value of a "keep or reroll, one face busts to 0" game on a fair
 * N-sided die: V = (1/N)·[ Σ_{k ≠ bust, k kept} k + (#rerolled)·V ], threshold
 * "keep k iff k ≥ V". Solved EXACTLY by scanning the integer threshold and
 * checking self-consistency. `bustFace = 0` means no bust face. (Bust on Ten →
 * V = 6 for N = 10, bust = 10.)
 */
export function dieBustGameValue(N: number, bustFace: number): Fraction {
  if (N < 1) throw new Error("need N ≥ 1");
  for (let t = 1; t <= N + 1; t++) {
    const kept: number[] = [];
    let rerolled = 0;
    for (let k = 1; k <= N; k++) {
      if (k === bustFace) continue; // bust always yields 0, never kept/rerolled
      if (k >= t) kept.push(k);
      else rerolled++;
    }
    const keptSum = kept.reduce((a, b) => a + b, 0);
    // V = keptSum / (N − rerolled)   (bust + rerolled fractions moved over)
    const V = F(keptSum, N - rerolled);
    // Self-consistent iff the threshold "keep k ≥ V" reproduces this keep-set:
    // every kept face ≥ V and every rerolled face < V.
    const okKept = kept.every((k) => F(k).valueOf() >= V.valueOf());
    const okReroll = (() => {
      for (let k = 1; k <= N; k++) {
        if (k === bustFace || k >= t) continue;
        if (F(k).valueOf() >= V.valueOf()) return false;
      }
      return true;
    })();
    if (okKept && okReroll) return V;
  }
  throw new Error("no consistent threshold found");
}

/**
 * Expected net payout of a fair N-sided die with ONE optional reroll costing
 * `fee` (net = reroll face − fee): keep first roll v iff v ≥ (mean − fee).
 * Exact rational. fee = 0 → the plain one-reroll value (d8 → 5.5); fee = 2 on a
 * d10 → 5.95.
 */
export function oneRerollFeeEV(N: number, fee: Fraction): Fraction {
  if (N < 1) throw new Error("need N ≥ 1");
  const rerollValue = dieMean(N).sub(fee); // value of choosing to reroll
  let sum = F(0);
  for (let v = 1; v <= N; v++) {
    sum = sum.add(F(v).valueOf() >= rerollValue.valueOf() ? F(v) : rerollValue);
  }
  return sum.div(F(N));
}

/**
 * Optimal-stopping value of a continuous one-reroll uniform draw on [0, M]:
 * keep iff v ≥ M/2, else take a fresh mandatory draw (mean M/2). Closed form
 * E = 5M/8. (Voucher Swap: M = 200 → 125.)
 */
export function oneRerollUniformEV(M: Fraction): Fraction {
  return M.mul(F(5, 8));
}

/* ========================================================================== */
/*  FAMILY — Geometric probability by area (two-window overlap)                */
/* ========================================================================== */

/**
 * P(two independent uniform-start events overlap) when event 1 starts uniformly
 * in [0, D] and lasts `a`, event 2 starts uniformly in [0, D] and lasts `b`:
 *   P = 1 − ((D−a)² + (D−b)²) / (2D²)
 * (the two non-overlap triangles). Exact rational for rational inputs. Flowers
 * in Bloom: D = 30, a = 9, b = 12 → 517.5/900 = 0.575.
 */
export function overlapProbTwoWindows(D: Fraction, a: Fraction, b: Fraction): Fraction {
  const t1 = D.sub(a).pow(2);
  const t2 = D.sub(b).pow(2);
  return F(1).sub(t1.add(t2).div(D.pow(2).mul(2)));
}

/* ========================================================================== */
/*  FAMILY — EV over a distribution: |difference| & max of two dice            */
/* ========================================================================== */

/** E[|X − Y|] for two independent fair N-sided dice (exact). d6 → 35/18. */
export function absDiffTwoDiceEV(N: number): Fraction {
  let sum = F(0);
  for (let x = 1; x <= N; x++)
    for (let y = 1; y <= N; y++) sum = sum.add(F(Math.abs(x - y)));
  return sum.div(F(N * N));
}

/**
 * E[higher of two fair N-sided dice, paid only when the two DIFFER, else 0]
 * (exact). d6 → 140/36 = 35/9. Computed by enumeration.
 */
export function higherWhenDifferEV(N: number): Fraction {
  let sum = F(0);
  for (let x = 1; x <= N; x++)
    for (let y = 1; y <= N; y++) if (x !== y) sum = sum.add(F(Math.max(x, y)));
  return sum.div(F(N * N));
}

/* ========================================================================== */
/*  FAMILY — Continuous convolution / sum of uniforms                          */
/* ========================================================================== */

/** E[sum of `k` i.i.d. Uniform(0, L)] = k·L/2 (linearity). Two U(0,1) → 1. */
export function sumOfUniformsEV(k: number, L: Fraction): Fraction {
  if (k < 1) throw new Error("need k ≥ 1");
  return F(k).mul(L).div(F(2));
}

/* ========================================================================== */
/*  FAMILY — Elementary probability scalars (for exact distractor derivation)  */
/* ========================================================================== */

/** P(two independent fair N-dice rolls match) = 1/N (NOT 1/N² — classic trap). */
export function twoDiceMatchProb(N: number): Fraction {
  return F(1, N);
}

/** P(sum of two fair N-dice equals `s`) exact. */
export function twoDiceSumProb(N: number, s: number): Fraction {
  let count = 0;
  for (let x = 1; x <= N; x++)
    for (let y = 1; y <= N; y++) if (x + y === s) count++;
  return F(count, N * N);
}

/** P(all `n` fair coin flips show the same face) = 2/2^n = 1/2^{n−1}. */
export function allSameCoinsProb(n: number): Fraction {
  if (n < 1) throw new Error("need n ≥ 1");
  return F(1, 2 ** (n - 1));
}

/* ========================================================================== */
/*  FAMILY — Sum of geometrics with shrinking success set ("convert all")      */
/* ========================================================================== */

/**
 * Expected uniform draws (from `N` slots, one slot converted per success) to
 * convert ALL `r` initially-unconverted slots: Σ_{j=1..r} N/j = N·H_r. (Three
 * Blue Orbs: N = 3, r = 2 → 3·(1 + 1/2) = 4.5.)
 */
export function convertAllEV(N: number, r: number): Fraction {
  if (N < 1 || r < 0 || r > N) throw new Error("need 0 ≤ r ≤ N");
  return F(N).mul(harmonic(r));
}

/* ========================================================================== */
/*  FAMILY — Symmetric spacings (expected wait to the first "marker")          */
/* ========================================================================== */

/**
 * Expected number of cards turned to reach the FIRST of `c` markers uniformly
 * shuffled among a deck of `D` cards: the c markers split the D−c others into
 * c+1 equal gaps, so E = (D − c)/(c + 1) + 1 = (D + 1)/(c + 1). (First Ace:
 * D = 52, c = 4 → 53/5 = 10.6.)
 */
export function firstMarkerSpacingEV(D: number, c: number): Fraction {
  if (c < 1 || c > D) throw new Error("need 1 ≤ c ≤ D");
  return F(D + 1, c + 1);
}

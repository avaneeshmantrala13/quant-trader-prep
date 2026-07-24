import Fraction from "fraction.js";

/**
 * EXACT solvers for the six ORIGINAL house brainteasers, so each can be turned
 * into an infinitely-generatable flashcard family (see `./generators.ts`). This
 * mirrors the drill-topic pattern (e.g. `probabilityStats/expectedValue/ev.ts`):
 * every answer is produced by an exact method — rational arithmetic via
 * `fraction.js`, exact backward-induction DP, or an exact rational linear solve —
 * never by floating-point guessing. Each solver is independently re-derived and
 * cross-checked (brute force / Monte-Carlo) in `./brainteasers.test.ts`.
 *
 * The four continuous-payoff families (Backup Dealer, Walking the Offer Down,
 * Round-Trip) are exact RATIONAL; the Fading Buyer answer is genuinely
 * irrational (2 − √3-style), so it is returned as a real number plus its closed
 * form. The two discrete families (Adjacent Cross, Inventory Cap) are exact
 * rational (linearity / stationary distribution).
 */

export const F = (n: number | string | bigint, d?: number | bigint): Fraction =>
  d === undefined ? new Fraction(n as never) : new Fraction(n as never, d);

/** "a/b" (or "n") exact fraction text, e.g. 1/3, 5/8, 2. */
export function fracText(f: Fraction): string {
  return f.toFraction(false);
}

/** Fixed-decimal text of a rational. */
export function decText(f: Fraction, dp: number): string {
  return f.valueOf().toFixed(dp);
}

/* ========================================================================== */
/*  FAMILY 1 — The Backup Dealer (order statistics: min + max cancellation)    */
/* ========================================================================== */

/**
 * Two i.i.d. quotes Uniform[a, b]; you aim for the cheaper quote but reach it
 * only with probability `pFill` (else you pay the dearer quote). Expected price
 *   = pFill·E[min] + (1 − pFill)·E[max].
 * For Uniform[a, b]: E[min] = a + (b−a)/3, E[max] = a + 2(b−a)/3, so
 *   E[price] = a + (b−a)·(2 − pFill)/3.
 * At pFill = 1/2 this collapses EXACTLY to the midpoint (a+b)/2 — the "aha":
 * the 50/50 backup cancels the advantage of shopping for the minimum. Exact
 * rational.
 */
export function backupDealerExpectedPrice(
  a: Fraction,
  b: Fraction,
  pFill: Fraction,
): Fraction {
  const span = b.sub(a);
  return a.add(span.mul(F(2).sub(pFill)).div(F(3)));
}

/** E[min of two i.i.d. Uniform[a,b]] = a + (b−a)/3 (exact). */
export function uniformPairMin(a: Fraction, b: Fraction): Fraction {
  return a.add(b.sub(a).div(F(3)));
}

/** E[max of two i.i.d. Uniform[a,b]] = a + 2(b−a)/3 (exact). */
export function uniformPairMax(a: Fraction, b: Fraction): Fraction {
  return a.add(b.sub(a).mul(F(2)).div(F(3)));
}

/* ========================================================================== */
/*  FAMILY 2 — The Adjacent Cross (linearity of expectation)                   */
/* ========================================================================== */

/**
 * Expected number of adjacent "buy immediately followed by sell" pairs in a
 * uniformly random row of `n` buys and `m` sells. By linearity over the
 * (n+m−1) adjacent slots, each a cross w.p. (n/(n+m))·(m/(n+m−1)):
 *   E = (n+m−1)·(n/(n+m))·(m/(n+m−1)) = n·m/(n+m).
 * Exact rational; dependence between overlapping slots washes out.
 */
export function adjacentCrossExpected(n: number, m: number): Fraction {
  if (n < 1 || m < 1) throw new Error("need n ≥ 1, m ≥ 1");
  return F(n * m, n + m);
}

/**
 * Brute-force ground truth: average adjacent B→S count over ALL C(n+m, n)
 * distinct arrangements of n buys (1) and m sells (0). Exact rational.
 * (Used by the verification test for small n, m.)
 */
export function adjacentCrossBruteForce(n: number, m: number): Fraction {
  let total = 0; // crosses summed over all arrangements
  let count = 0; // number of arrangements
  const N = n + m;
  const arr: number[] = [];
  // Enumerate all C(N, n) bit patterns with exactly n ones (buys), counting the
  // adjacent buy(1)→sell(0) crosses in each completed arrangement.
  const build = (pos: number, onesLeft: number) => {
    if (pos === N) {
      if (onesLeft !== 0) return;
      let c = 0;
      for (let i = 0; i + 1 < N; i++) if (arr[i] === 1 && arr[i + 1] === 0) c++;
      total += c;
      count++;
      return;
    }
    if (N - pos > onesLeft) {
      arr[pos] = 0;
      build(pos + 1, onesLeft);
    }
    if (onesLeft > 0) {
      arr[pos] = 1;
      build(pos + 1, onesLeft - 1);
    }
  };
  build(0, n);
  return F(total, count);
}

/* ========================================================================== */
/*  FAMILY 3 — Walking the Offer Down (sequential posted pricing)              */
/* ========================================================================== */

/**
 * Optimal declining-ask schedule and revenue for a myopic buyer with value
 * V ~ Uniform[0, M], given `rounds` (k) sequential take-it-or-leave-it asks.
 *
 * With prices p_0 = M ≥ p_1 > … > p_k, revenue R = Σ_i p_i·(p_{i−1} − p_i).
 * The first-order conditions give an ARITHMETIC schedule p_i = M·(k+1−i)/(k+1),
 * and the optimum revenue is R* = M·k/(2(k+1)). (k = 1 → M/4; k = 2 → M/3 with
 * prices 2M/3, M/3 — the "second lower ask beats a single ask" aha.) The
 * schedule/revenue are computed here EXACTLY from that optimization; the test
 * cross-checks against a grid search and Monte-Carlo. Exact rational.
 */
export function walkOfferDown(
  M: Fraction,
  rounds: number,
): { prices: Fraction[]; revenue: Fraction; singleAskRevenue: Fraction } {
  if (rounds < 1) throw new Error("need rounds ≥ 1");
  const k = rounds;
  const prices: Fraction[] = [];
  for (let i = 1; i <= k; i++) prices.push(M.mul(F(k + 1 - i, k + 1)));
  const revenue = M.mul(F(k, 2 * (k + 1)));
  // Single-ask optimum: p = M/2, revenue M/4.
  const singleAskRevenue = M.mul(F(1, 4));
  return { prices, revenue, singleAskRevenue };
}

/**
 * Exact revenue of an ARBITRARY declining schedule (top value M, prices
 * strictly decreasing) for the myopic uniform buyer:
 *   R = Σ_i p_i·(p_{i−1} − p_i), with p_0 = M.
 * Used by the test's grid search to confirm the closed-form schedule is optimal.
 */
export function walkOfferRevenueForSchedule(M: Fraction, prices: Fraction[]): Fraction {
  let r = F(0);
  let prev = M;
  for (const p of prices) {
    r = r.add(p.mul(prev.sub(p)));
    prev = p;
  }
  return r;
}

/* ========================================================================== */
/*  FAMILY 4 — The Fading Buyer (optimal stopping, threshold = continuation)   */
/* ========================================================================== */

/**
 * Offers ~ Uniform[0, M] arrive one at a time; on each reject the deal collapses
 * (payoff 0) with probability `qCollapse`, else another offer arrives. The
 * optimal policy is a fixed threshold t = continuation value; with c = 1 −
 * qCollapse the fixed-point t² − (2M/c)·t + M² = 0 gives
 *   t* = (M/c)·(1 − √(1 − c²)),   W = t* ÷ c = (M/c²)·(1 − √(1 − c²)).
 * (M = 1, qCollapse = 1/2 → t* = 2 − √3 ≈ 0.2679, W = 4 − 2√3 ≈ 0.5359.)
 * The answer is genuinely IRRATIONAL, so this returns floating-point values
 * (verified by Monte-Carlo + a threshold scan). `c` MUST satisfy 0 < c < 1.
 */
export function fadingBuyer(
  M: number,
  qCollapse: number,
): { threshold: number; ev: number } {
  const c = 1 - qCollapse;
  if (c <= 0 || c >= 1) throw new Error("need 0 < qCollapse < 1");
  const root = 1 - Math.sqrt(1 - c * c);
  const threshold = (M / c) * root;
  const ev = threshold / c; // W = t/c
  return { threshold, ev };
}

/**
 * Exact expected payoff of PLAYING a fixed threshold `t` in the Fading Buyer
 * game (offers ~ U[0, M], per-reject survival probability c = 1 − qCollapse):
 *   W(t) = E[x·1{x≥t}] + P(x<t)·c·W(t)
 * ⇒ W(t) = [ (M² − t²)/(2M) ] / (1 − (t/M)·c).
 * Used by the test to confirm the solver's threshold maximizes the payoff.
 */
export function fadingBuyerValueOfThreshold(
  M: number,
  qCollapse: number,
  t: number,
): number {
  const c = 1 - qCollapse;
  const acceptContribution = (M * M - t * t) / (2 * M); // ∫_t^M (x/M) dx
  const rejectProb = t / M;
  return acceptContribution / (1 - rejectProb * c);
}

/* ========================================================================== */
/*  FAMILY 5 — The Round-Trip (two-sided optimal stopping, backward induction) */
/* ========================================================================== */

/** E[max(x, c)] for x ~ Uniform[0,1], c clamped to [0,1]: = (1 + c²)/2. */
function expMaxWithConst(c: Fraction): Fraction {
  if (c.valueOf() <= 0) return F(1, 2);
  if (c.valueOf() >= 1) return c;
  return F(1).add(c.pow(2)).div(F(2));
}

/**
 * E[max(a − x, b)] for x ~ Uniform[0,1], with the crossover x* = a − b clamped
 * to [0,1]:  ∫_0^{x*} (a − x) dx + b·(1 − x*). Exact rational.
 */
function expMaxLinearConst(a: Fraction, b: Fraction): Fraction {
  let xStar = a.sub(b);
  if (xStar.valueOf() < 0) xStar = F(0);
  if (xStar.valueOf() > 1) xStar = F(1);
  // ∫_0^{x*}(a − x)dx = a·x* − x*²/2
  const buyPart = a.mul(xStar).sub(xStar.pow(2).div(F(2)));
  const waitPart = b.mul(F(1).sub(xStar));
  return buyPart.add(waitPart);
}

/**
 * Exact backward-induction solution of the one-round-trip problem over `days`
 * i.i.d. Uniform[0, M] closing prices: buy on one day, sell on a strictly later
 * day, decided online. Returns the max expected profit and the optimal
 * thresholds (all scaled by M). For U[0,1]:
 *   S_t = E[max(x, S_{t+1})]  (sell-side value of holding entering day t),
 *   F_t = E[max(S_{t+1} − x, F_{t+1})]  (value of being flat entering day t),
 *   with S_days = 1/2, F_days = 0; answer = F_1.
 * (days = 3 → 1/4; the two-sided entry/exit stopping "aha".) Exact rational.
 */
export function roundTrip(
  M: Fraction,
  days: number,
): {
  profit: Fraction;
  sellThresholds: Fraction[]; // sell (if holding) on day t iff price ≥ this
  buyThresholds: Fraction[]; // buy (if flat) on day t iff price ≤ this
} {
  if (days < 2) throw new Error("need days ≥ 2");
  // Work in U[0,1]; scale linearly by M at the end.
  const S: Fraction[] = new Array(days + 2).fill(F(0));
  const Fv: Fraction[] = new Array(days + 2).fill(F(0));
  S[days] = F(1, 2); // holding on last day → sell at E[x] = 1/2
  Fv[days] = F(0); // flat on last day → cannot complete a round trip
  const sellThresholds: Fraction[] = new Array(days + 1).fill(F(0));
  const buyThresholds: Fraction[] = new Array(days + 1).fill(F(0));
  sellThresholds[days] = F(0); // must sell (any price)
  for (let t = days - 1; t >= 1; t--) {
    // Holding entering day t: sell now (x) or hold for S[t+1].
    S[t] = expMaxWithConst(S[t + 1]);
    sellThresholds[t] = S[t + 1]; // sell iff x ≥ S[t+1]
    // Flat entering day t: buy now (profit S[t+1] − x) or stay flat (F[t+1]).
    Fv[t] = expMaxLinearConst(S[t + 1], Fv[t + 1]);
    buyThresholds[t] = S[t + 1].sub(Fv[t + 1]); // buy iff x ≤ S[t+1] − F[t+1]
  }
  return {
    profit: Fv[1].mul(M),
    sellThresholds: sellThresholds.slice(1).map((f) => f.mul(M)),
    buyThresholds: buyThresholds.slice(1).map((f) => f.mul(M)),
  };
}

/* ========================================================================== */
/*  FAMILY 6 — The Inventory Cap (stationary distribution via exact linear solve) */
/* ========================================================================== */

/**
 * Exact rational Gaussian elimination solving A·x = b for a square rational
 * system. Throws on a singular matrix. Small sizes only (≤ ~10) — used for the
 * stationary distribution of the inventory chain.
 */
export function solveLinearExact(A: Fraction[][], b: Fraction[]): Fraction[] {
  const n = b.length;
  // Augmented matrix [A | b] (Fractions are immutable, so sharing refs is safe).
  const M: Fraction[][] = [];
  for (let i = 0; i < n; i++) {
    M[i] = [];
    for (let j = 0; j < n; j++) M[i][j] = A[i][j];
    M[i][n] = b[i];
  }
  for (let col = 0; col < n; col++) {
    // Find a pivot row with a non-zero entry in this column.
    let pivot = -1;
    for (let r = col; r < n; r++) {
      if (M[r][col].valueOf() !== 0) {
        pivot = r;
        break;
      }
    }
    if (pivot === -1) throw new Error("singular matrix");
    [M[col], M[pivot]] = [M[pivot], M[col]];
    // Normalize pivot row.
    const p = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] = M[col][j].div(p);
    // Eliminate this column from all other rows.
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (factor.valueOf() === 0) continue;
      for (let j = col; j <= n; j++) {
        M[r][j] = M[r][j].sub(factor.mul(M[col][j]));
      }
    }
  }
  return M.map((row) => row[n]);
}

/**
 * Inventory chain on states {−cap, …, +cap}. Each customer moves inventory +1
 * with probability `pUp` and −1 with probability 1 − pUp; a move that would
 * exceed the cap is REJECTED and inventory holds (a "sticky" boundary). Returns
 * the exact stationary distribution (indexed −cap..+cap) and the exact long-run
 * rejection rate = π(+cap)·pUp + π(−cap)·(1 − pUp).
 *
 * The stationary distribution is obtained by an EXACT rational linear solve of
 * the balance equations πP = π with Σπ = 1. (cap = 1, pUp = 1/2 → uniform π and
 * rejection 1/3; in general for pUp = 1/2 rejection = 1/(2·cap+1).)
 */
export function inventoryCap(
  cap: number,
  pUp: Fraction,
): { stationary: Fraction[]; rejectionRate: Fraction } {
  if (cap < 1) throw new Error("need cap ≥ 1");
  const pDown = F(1).sub(pUp);
  const size = 2 * cap + 1; // states index 0..size-1 ↔ inventory −cap..+cap
  // Transition matrix P[i][j] = P(i → j).
  const P: Fraction[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => F(0)),
  );
  for (let s = 0; s < size; s++) {
    const inv = s - cap;
    // Up move.
    if (inv + 1 <= cap) P[s][s + 1] = P[s][s + 1].add(pUp);
    else P[s][s] = P[s][s].add(pUp); // rejected → hold
    // Down move.
    if (inv - 1 >= -cap) P[s][s - 1] = P[s][s - 1].add(pDown);
    else P[s][s] = P[s][s].add(pDown); // rejected → hold
  }
  // Solve πP = π, Σπ = 1. Build (Pᵀ − I) with the last equation replaced by Σ=1.
  const A: Fraction[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => F(0)),
  );
  const b: Fraction[] = Array.from({ length: size }, () => F(0));
  for (let i = 0; i < size - 1; i++) {
    for (let j = 0; j < size; j++) {
      // (Pᵀ − I)[i][j] = P[j][i] − (i==j)
      A[i][j] = P[j][i].sub(i === j ? F(1) : F(0));
    }
    b[i] = F(0);
  }
  // Normalization row: Σ π = 1.
  for (let j = 0; j < size; j++) A[size - 1][j] = F(1);
  b[size - 1] = F(1);
  const stationary = solveLinearExact(A, b);
  const rejectionRate = stationary[size - 1].mul(pUp).add(stationary[0].mul(pDown));
  return { stationary, rejectionRate };
}

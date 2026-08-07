/**
 * lib/oa/hardContent/solvers.ts — EXACT, deterministic verifiers for the hard,
 * firm-accurate Timed-OA archetypes (calibrated to the verified 2026 research in
 * `datasets/OPTIVER_2026_DEEP.md`, `JANE_STREET_2026_DEEP.md`,
 * `TOP_FIRMS_2026_DEEP_A.md`). NOTHING here is hardcoded per instance: each
 * function COMPUTES the exact answer from the parameters via exact rational
 * arithmetic (`fraction.js`), exact enumeration, exact DP, or an exact rational
 * linear solve, so every generated question is correct-by-construction and
 * re-derivable from its seed alone.
 *
 * The difficulty anchor (verified 3273/4096 ≈ 0.7991) is `pathIntersectProb(3,4)`.
 *
 * These are PURE (no rng, no I/O). The generators in `./generators.ts` sample
 * parameters from a seeded `Rng` and call these to obtain the ground truth; the
 * tests in `./solvers.test.ts` cross-check the exact outputs against the research
 * ledger AND against fixed-seed Monte-Carlo simulations.
 */
import Fraction from "fraction.js";

/** Exact Fraction constructor (never floating point). */
export const F = (n: number | string, d?: number): Fraction =>
  d === undefined ? new Fraction(n as never) : new Fraction(n as never, d);

/* ========================================================================== */
/*  Small exact combinatorics                                                  */
/* ========================================================================== */

/** Exact binomial C(n,k) as a Number (exact for the interview-scale ranges). */
export function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let num = 1n;
  let den = 1n;
  for (let i = 0; i < kk; i++) {
    num *= BigInt(n - i);
    den *= BigInt(i + 1);
  }
  return Number(num / den);
}

/** Exact harmonic number H_n = Σ_{k=1}^n 1/k as a Fraction. */
export function harmonic(n: number): Fraction {
  let h = F(0);
  for (let k = 1; k <= n; k++) h = h.add(F(1, k));
  return h;
}

/* ========================================================================== */
/*  Exact rational linear solver (for absorbing-chain hitting times)           */
/* ========================================================================== */

/**
 * Solve the square rational linear system `A x = b` by Gauss–Jordan elimination
 * over exact `Fraction`s. `A` is `n×n` (row-major), `b` length `n`. Returns the
 * exact solution vector. Throws on a singular system. Small `n` only (≤ ~12).
 */
export function solveLinearRational(A: Fraction[][], b: Fraction[]): Fraction[] {
  const n = b.length;
  // Augmented matrix [A | b], reusing the passed exact Fractions (immutable ops).
  const M: Fraction[][] = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    // Find a pivot row with nonzero entry in this column.
    let pivot = -1;
    for (let r = col; r < n; r++) {
      if (M[r][col].compare(0) !== 0) {
        pivot = r;
        break;
      }
    }
    if (pivot === -1) throw new Error("singular linear system");
    if (pivot !== col) {
      const tmp = M[pivot];
      M[pivot] = M[col];
      M[col] = tmp;
    }
    // Normalize the pivot row so M[col][col] = 1.
    const p = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] = M[col][j].div(p);
    // Eliminate this column from all other rows.
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (factor.compare(0) === 0) continue;
      for (let j = col; j <= n; j++) {
        M[r][j] = M[r][j].sub(factor.mul(M[col][j]));
      }
    }
  }
  return M.map((row) => row[n]);
}

/* ========================================================================== */
/*  Archetype A / B1 — lattice random-walk PATH INTERSECTION (the ANCHOR)      */
/* ========================================================================== */

/**
 * EXACT probability that the two monotone lattice walks EVER share a vertex:
 * A starts (0,0) stepping right/up (½,½); B starts (bx,by) stepping left/down
 * (½,½). Enumerates all `2^s × 2^s` step-sequence pairs (`s = bx+by`), builds
 * each walk's x-coordinate on every shared anti-diagonal `k = 0..s`, and counts
 * pairs that coincide on some diagonal (equal x on the same diagonal ⇒ same
 * vertex). Denominator `4^s`. Correct-by-construction; verified `(3,4)→3273/4096`.
 */
export function pathIntersectProb(bx: number, by: number): Fraction {
  const s = bx + by;
  const total = 1 << s; // 2^s
  // A's x-coordinate on diagonal k, for each A step-sequence.
  const aDiag: Int16Array[] = [];
  for (let seq = 0; seq < total; seq++) {
    const arr = new Int16Array(s + 1);
    let x = 0;
    arr[0] = 0;
    for (let i = 0; i < s; i++) {
      if (seq & (1 << i)) x++; // R ⇒ x+1, U ⇒ x same
      arr[i + 1] = x;
    }
    aDiag.push(arr);
  }
  // B's x-coordinate on diagonal k, for each B step-sequence.
  const bDiag: Int16Array[] = [];
  for (let seq = 0; seq < total; seq++) {
    const arr = new Int16Array(s + 1);
    arr[s] = bx;
    let x = bx;
    for (let j = 1; j <= s; j++) {
      if (seq & (1 << (j - 1))) x--; // L ⇒ x-1, D ⇒ x same
      arr[s - j] = x;
    }
    bDiag.push(arr);
  }
  let count = 0;
  for (const a of aDiag) {
    for (const b of bDiag) {
      for (let k = 0; k <= s; k++) {
        if (a[k] === b[k]) {
          count++;
          break;
        }
      }
    }
  }
  return F(count, total * total);
}

/**
 * The SAME-TIME meeting probability (the parity-trap distractor): the walkers
 * occupy the same vertex at the same STEP index. Zero when `bx+by` is odd
 * (the anchor's trap); else `C(s, bx)/2^s`. Verified `(5,7)→792/4096`.
 */
export function sameTimeMeetProb(bx: number, by: number): Fraction {
  const s = bx + by;
  if (s % 2 !== 0) return F(0);
  return F(binom(s, bx), 1 << s);
}

/* ========================================================================== */
/*  Archetype D / C2 — gambler's ruin (fair + biased)                          */
/* ========================================================================== */

/**
 * Probability a ±1 walk started at `a` (0 < a < N) reaches `N` before `0`, with
 * up-probability `p`. Fair (`p=½`) ⇒ `a/N`; biased ⇒ `(1−r^a)/(1−r^N)`,
 * `r=(1−p)/p`. Exact. Verified fair `a=3,N=10 → 3/10`.
 */
export function ruinReachProb(a: number, N: number, p: Fraction): Fraction {
  if (p.compare(F(1, 2)) === 0) return F(a, N);
  const r = F(1).sub(p).div(p);
  return F(1).sub(r.pow(a)).div(F(1).sub(r.pow(N)));
}

/**
 * Expected number of steps until a ±1 walk started at `a` is absorbed at `0` or
 * `N`, up-probability `p`. Fair ⇒ `a(N−a)`; biased ⇒
 * `a/(q−p) − (N/(q−p))·(1−r^a)/(1−r^N)`. Exact. Verified fair `a=3,N=10 → 21`.
 */
export function ruinExpectedDuration(a: number, N: number, p: Fraction): Fraction {
  if (p.compare(F(1, 2)) === 0) return F(a * (N - a));
  const q = F(1).sub(p);
  const r = q.div(p);
  const qmp = q.sub(p); // q − p
  const reach = F(1).sub(r.pow(a)).div(F(1).sub(r.pow(N)));
  return F(a).div(qmp).sub(F(N).div(qmp).mul(reach));
}

/* ========================================================================== */
/*  Archetype E / C1 — expected flips to a coin/​symbol pattern                 */
/* ========================================================================== */

/**
 * Expected number of fair `m`-symbol trials until a target `pattern` (array of
 * symbol indices) first appears, via the correlation (Conway) identity:
 * `E = Σ_{i: prefix_i == suffix_i} m^i`. Exact integer. Verified fair coin
 * (m=2): HH→6, HT→4, HHH→14, HTH→10.
 */
export function expectedWaitForPattern(pattern: number[], m: number): number {
  const L = pattern.length;
  let e = 0;
  for (let i = 1; i <= L; i++) {
    // prefix of length i == suffix of length i ?
    let match = true;
    for (let j = 0; j < i; j++) {
      if (pattern[j] !== pattern[L - i + j]) {
        match = false;
        break;
      }
    }
    if (match) e += m ** i;
  }
  return e;
}

/* ========================================================================== */
/*  Archetype F — optimal stopping / secretary (best-choice)                   */
/* ========================================================================== */

/**
 * Best-choice (secretary) problem for `n` candidates: for a reject-first-`r`
 * threshold rule, win probability `P(r) = (r/n)·Σ_{j=r}^{n−1} 1/j` (with
 * `P(0)=1/n`). Returns the optimal `r*` and its exact win probability.
 * Verified `n=5 → r=2, P=13/30`; converges to `1/e`.
 */
export function secretaryOptimal(n: number): { r: number; prob: Fraction } {
  let bestR = 0;
  let bestP = F(1, n); // r = 0: always take the first ⇒ 1/n
  for (let r = 1; r <= n - 1; r++) {
    let sum = F(0);
    for (let j = r; j <= n - 1; j++) sum = sum.add(F(1, j));
    const p = F(r, n).mul(sum);
    if (p.compare(bestP) > 0) {
      bestP = p;
      bestR = r;
    }
  }
  return { r: bestR, prob: bestP };
}

/* ========================================================================== */
/*  Archetype C / D1 — expected hitting / return time on a graph               */
/* ========================================================================== */

/**
 * Exact expected number of steps for a simple random walk (uniform over
 * neighbours) on graph `adj` (adjacency lists) to first reach any vertex in
 * `targets`, starting from `start` (which must not be a target). Solves
 * `(I−Q)E = 1` exactly. Verified cube antipode → 10, 6-cycle distance-3 → 9.
 */
export function expectedHittingTime(
  adj: number[][],
  start: number,
  targets: number[],
): Fraction {
  const target = new Set(targets);
  const transient = adj.map((_, i) => i).filter((i) => !target.has(i));
  const idx = new Map<number, number>();
  transient.forEach((v, i) => idx.set(v, i));
  const n = transient.length;
  const A: Fraction[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => F(0)),
  );
  const b: Fraction[] = Array.from({ length: n }, () => F(1));
  for (let i = 0; i < n; i++) {
    const v = transient[i];
    const deg = adj[v].length;
    A[i][i] = A[i][i].add(1); // (I − Q): identity term
    for (const w of adj[v]) {
      if (target.has(w)) continue; // absorbing: contributes nothing to E
      const j = idx.get(w)!;
      A[i][j] = A[i][j].sub(F(1, deg)); // − Q_{ij}
    }
  }
  const E = solveLinearRational(A, b);
  return E[idx.get(start)!];
}

/**
 * Exact expected RETURN time to `start` on graph `adj`: one step out, then the
 * hitting time back. `1 + (1/deg)·Σ_{neighbours w} h(w→start)`. For a
 * vertex-transitive graph this equals the vertex count `n`. Verified hexagon→6.
 */
export function expectedReturnTime(adj: number[][], start: number): Fraction {
  const deg = adj[start].length;
  let acc = F(1);
  for (const w of adj[start]) {
    if (w === start) continue;
    acc = acc.add(expectedHittingTime(adj, w, [start]).mul(F(1, deg)));
  }
  return acc;
}

/** Adjacency list of the cycle graph `C_n` (vertices 0..n−1). */
export function cycleGraph(n: number): number[][] {
  return Array.from({ length: n }, (_, i) => [(i + 1) % n, (i + n - 1) % n]);
}

/** Adjacency list of the 3-cube `Q3` (8 vertices; 0 and 7 are antipodal). */
export function cubeGraph(): number[][] {
  const adj: number[][] = Array.from({ length: 8 }, () => []);
  for (let v = 0; v < 8; v++) {
    for (let bit = 0; bit < 3; bit++) adj[v].push(v ^ (1 << bit));
  }
  return adj;
}

/** Adjacency list of the complete graph `K_n`. */
export function completeGraph(n: number): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => j).filter((j) => j !== i),
  );
}

/* ========================================================================== */
/*  Archetype H — coupon collector                                             */
/* ========================================================================== */

/** Expected trials to collect all `n` coupon types = `n·H_n`. Exact (die→14.7). */
export function couponCollectorEV(n: number): Fraction {
  return harmonic(n).mul(n);
}

/* ========================================================================== */
/*  Archetype D3 — coupon collector with a FRAGILE last face (reset)           */
/* ========================================================================== */

/**
 * Expected rolls to collect all `n` faces when, having already collected `n−1`
 * distinct faces, rolling any already-seen face (prob `(n−1)/n`) RESETS progress
 * to 0. Closed form `E = n·(a + 1)` with `a = Σ_{k=0}^{n−2} n/(n−k)`. Exact.
 * Verified `n=7 → 1701/20 = 85.05` (vs plain coupon-collector 7·H₇ ≈ 18.15).
 */
export function resetCollectorEV(n: number): Fraction {
  let a = F(0);
  for (let k = 0; k <= n - 2; k++) a = a.add(F(n, n - k));
  return a.add(1).mul(n);
}

/* ========================================================================== */
/*  Archetype C1 (Citadel) — hidden-composition Bayes                          */
/* ========================================================================== */

/**
 * A bag of `N` stones, each black/white, with the number black `K` uniform on
 * `{0..N}`. After drawing `m` black WITHOUT replacement, the posterior
 * predictive probability the next draw is black. Exact. Verified
 * `N=4,m=2 → 3/4`; `N=6,m=3 → 4/5`. (Contrast the iid-fair model → ½.)
 */
export function hiddenCompositionNextSame(N: number, m: number): Fraction {
  // w_K ∝ Π_{i=0}^{m-1} (K−i)/(N−i)  (uniform prior over K cancels in the ratio)
  let numer = F(0); // Σ_K w_K · (K−m)/(N−m)
  let denom = F(0); // Σ_K w_K
  for (let K = 0; K <= N; K++) {
    let w = F(1);
    let ok = true;
    for (let i = 0; i < m; i++) {
      if (K - i < 0) {
        ok = false;
        break;
      }
      w = w.mul(F(K - i, N - i));
    }
    if (!ok) continue;
    denom = denom.add(w);
    numer = numer.add(w.mul(F(K - m, N - m)));
  }
  return numer.div(denom);
}

/* ========================================================================== */
/*  Archetype I (Optiver) — Bayesian update, fair vs biased coin               */
/* ========================================================================== */

/**
 * A coin is fair (`P(H)=½`) or biased (`P(H)=pB`), equally likely a priori.
 * After observing `k` heads in a row, returns the posterior P(biased) and the
 * predictive P(next head). Exact. Verified `pB=3/4,k=3 → post 27/35, pred 97/140`.
 */
export function coinBiasPosterior(
  pB: Fraction,
  k: number,
): { posteriorBiased: Fraction; predictiveHead: Fraction } {
  const likFair = F(1, 2).pow(k);
  const likBiased = pB.pow(k);
  const posteriorBiased = likBiased.div(likBiased.add(likFair));
  const posteriorFair = F(1).sub(posteriorBiased);
  const predictiveHead = posteriorFair.mul(F(1, 2)).add(posteriorBiased.mul(pB));
  return { posteriorBiased, predictiveHead };
}

/* ========================================================================== */
/*  Dice distributions — sum convolution + order statistics                    */
/* ========================================================================== */

/** PMF of the sum of `d` fair `f`-sided dice, as an integer count array. */
function diceSumCounts(d: number, f: number): number[] {
  let dist = [1]; // sum 0 with 1 way (empty)
  for (let i = 0; i < d; i++) {
    const next = new Array<number>(dist.length + f).fill(0);
    for (let s = 0; s < dist.length; s++) {
      if (dist[s] === 0) continue;
      for (let face = 1; face <= f; face++) next[s + face] += dist[s];
    }
    dist = next;
  }
  return dist;
}

/** Exact probability that `d` fair `f`-sided dice sum to `target`. */
export function diceSumProb(d: number, f: number, target: number): Fraction {
  const counts = diceSumCounts(d, f);
  const c = counts[target] ?? 0;
  return F(c, f ** d);
}

/** Exact E[max of `m` fair `f`-sided dice] = Σ k·(kᵐ−(k−1)ᵐ)/fᵐ. */
export function maxOfDiceEV(m: number, f: number): Fraction {
  let ev = F(0);
  const denom = f ** m;
  for (let k = 1; k <= f; k++) {
    ev = ev.add(F(k * (k ** m - (k - 1) ** m), denom));
  }
  return ev;
}

/** Exact E[min of `m` fair `f`-sided dice] = Σ k·((f−k+1)ᵐ−(f−k)ᵐ)/fᵐ. */
export function minOfDiceEV(m: number, f: number): Fraction {
  let ev = F(0);
  const denom = f ** m;
  for (let k = 1; k <= f; k++) {
    ev = ev.add(F(k * ((f - k + 1) ** m - (f - k) ** m), denom));
  }
  return ev;
}

/** Exact P(die1 > die2) for two fair `f`-sided dice = (1 − 1/f)/2 = (f−1)/(2f). */
export function probStrictlyGreater(f: number): Fraction {
  return F(f - 1, 2 * f);
}

/* ========================================================================== */
/*  Archetype I1 (IMC) — order-flow Bayes on a dice-sum quote                   */
/* ========================================================================== */

/**
 * A market-maker quotes an ask on the sum of `d` fair `f`-sided dice; a FULLY
 * informed counterparty lifts iff `sum > ask`. Returns the posterior mean
 * `E[sum | sum > ask]`. Exact. Verified `d=2,f=6,ask=8 → 10`.
 */
export function informedLiftPosteriorMean(
  d: number,
  f: number,
  ask: number,
): Fraction {
  const counts = diceSumCounts(d, f);
  let num = F(0);
  let den = F(0);
  for (let s = 0; s < counts.length; s++) {
    if (s <= ask) continue;
    if (counts[s] === 0) continue;
    den = den.add(F(counts[s], 1));
    num = num.add(F(s * counts[s], 1));
  }
  return num.div(den);
}

/* ========================================================================== */
/*  Archetype S1 (SIG) — one optional reroll / keep-the-higher EV              */
/* ========================================================================== */

/**
 * Uniform draw on `{1..n}`. With ONE optional reroll (reroll iff the first draw
 * is below the fresh-draw mean, then forced to keep the second), the exact game
 * value: `P(X≥t)·E[X|X≥t] + P(X<t)·E[X]`, `t = ⌈(n+1)/2⌉`. Exact.
 * Verified `n=6 → 17/4 = 4.25`; `n=13 → 112/13`.
 */
export function oneRerollEV(n: number): Fraction {
  const mean = F(n + 1, 2);
  const t = Math.ceil((n + 1) / 2); // reroll iff first < mean ⇔ first < t
  let keepSum = F(0);
  let keepCount = 0;
  for (let v = 1; v <= n; v++) {
    if (v >= t) {
      keepSum = keepSum.add(F(v, 1));
      keepCount++;
    }
  }
  const pKeep = F(keepCount, n);
  const pReroll = F(n - keepCount, n);
  const eKeep = keepCount > 0 ? keepSum.div(keepCount) : F(0);
  return pKeep.mul(eKeep).add(pReroll.mul(mean));
}

/** Exact E[max of two uniform `{1..n}` draws] = Σ k·(2k−1)/n². Verified n=13→119/13. */
export function keepHigherOfTwoEV(n: number): Fraction {
  let ev = F(0);
  for (let k = 1; k <= n; k++) ev = ev.add(F(k * (2 * k - 1), n * n));
  return ev;
}

/* ========================================================================== */
/*  Archetype D2 (DRW) — coin-driven step-landing recurrence                   */
/* ========================================================================== */

/**
 * Landing probabilities for a walk that advances +1 (Heads, prob ½) or +2
 * (Tails, prob ½): `pₙ = ½ p_{n−1} + ½ p_{n−2}`, `p₀=1, p₁=½`. Closed form
 * `2/3 + (1/3)(−1/2)ⁿ`. Exact. Verified `p₄=11/16, p₁₀=683/1024`.
 */
export function stepLandingProb(n: number): Fraction {
  const p: Fraction[] = [F(1), F(1, 2)];
  for (let i = 2; i <= n; i++) {
    p[i] = p[i - 1].mul(F(1, 2)).add(p[i - 2].mul(F(1, 2)));
  }
  return p[n];
}

/* ========================================================================== */
/*  Archetype S2 (SIG) — Kelly bet sizing                                      */
/* ========================================================================== */

/**
 * Kelly-optimal fraction for a bet paying net odds `b:1` with win probability
 * `p`: `f* = (p(b+1) − 1)/b`. Exact. Verified `p=3/5,b=1 → 1/5`.
 */
export function kellyFraction(p: Fraction, b: number): Fraction {
  return p.mul(F(b + 1, 1)).sub(1).div(F(b, 1));
}

/* ========================================================================== */
/*  Archetype I3 (IMC) — asymmetric EV bet                                     */
/* ========================================================================== */

/** Break-even win probability for a bet paying `+W` (win) / `−L` (lose): L/(W+L). */
export function breakEvenProb(W: number, L: number): Fraction {
  return F(L, W + L);
}

/** Expected value of a bet paying `+W` w.p. `p`, `−L` otherwise: pW − (1−p)L. */
export function asymmetricBetEV(p: Fraction, W: number, L: number): Fraction {
  return p.mul(F(W, 1)).sub(F(1).sub(p).mul(F(L, 1)));
}

/* ========================================================================== */
/*  De-vig — fair probability of a leg on an overround book                    */
/* ========================================================================== */

/**
 * De-vigged fair probability of leg 0 given decimal odds (each a "a/b" or whole
 * string, exact): `(1/o₀) / Σ(1/oᵢ)`. Exact.
 */
export function deVigFairProb(oddsNum: number[], oddsDen: number[]): Fraction {
  // implied_i = den_i / num_i  (since decimal odds o = num/den ⇒ 1/o = den/num)
  const implied = oddsNum.map((_, i) => F(oddsDen[i], oddsNum[i]));
  const booksum = implied.reduce((s, x) => s.add(x), F(0));
  return implied[0].div(booksum);
}

/* ========================================================================== */
/*  Archetype B2 — constrained lattice-path COUNTING (avoid a point)           */
/* ========================================================================== */

/**
 * Number of monotone lattice paths from `(0,0)` to `(a,b)` that AVOID the
 * forbidden vertex `(px,py)`: `C(a+b,a) − C(px+py,px)·C((a−px)+(b−py), a−px)`.
 * Exact integer.
 */
export function pathsAvoidingPoint(
  a: number,
  b: number,
  px: number,
  py: number,
): number {
  const total = binom(a + b, a);
  const through = binom(px + py, px) * binom(a - px + (b - py), a - px);
  return total - through;
}

/** The n-th Catalan number `C_n = C(2n,n)/(n+1)` (monotone paths not crossing the diagonal). */
export function catalan(n: number): number {
  return binom(2 * n, n) / (n + 1);
}

/* ========================================================================== */
/*  Archetype B / meeting time of two walkers on an n-cycle                    */
/* ========================================================================== */

/**
 * Two independent symmetric walkers on an `n`-cycle start a gap `g` apart. The
 * gap changes by ±2 (prob ¼ each) or 0 (prob ½) per tick, so its PARITY is
 * invariant: if `g` is ODD they NEVER meet (returns `null`). If `g` is even,
 * returns the exact expected ticks to meet via an absorbing chain on the even
 * gap residues. Verified opposite start on `C_8` (g=4) → 8; general `4|n`,
 * opposite → `n²/8`.
 */
export function cycleMeetingTime(n: number, g: number): Fraction | null {
  const gap = ((g % n) + n) % n;
  if (gap % 2 !== 0) return null; // odd gap ⇒ never meet (parity trap)
  if (gap === 0) return F(0);
  // States: even gaps 2,4,...,  represented as gap value in {0,2,...}. Absorbing
  // at 0 (and equivalently n, but gap is taken mod n and 0 is the meet). Build
  // the chain over even residues in {0..n-1}; transitions ±2 mod n, prob ¼/¼,
  // stay ½.
  const evens: number[] = [];
  for (let v = 0; v < n; v += 2) evens.push(v);
  // Guard: if n is odd there are no consistent even residues wrapping to 0;
  // this function is intended for even n.
  const transient = evens.filter((v) => v !== 0);
  const idx = new Map<number, number>();
  transient.forEach((v, i) => idx.set(v, i));
  const size = transient.length;
  const A: Fraction[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => F(0)),
  );
  const b: Fraction[] = Array.from({ length: size }, () => F(1));
  const up = (v: number) => ((v + 2) % n + n) % n;
  const down = (v: number) => ((v - 2) % n + n) % n;
  for (let i = 0; i < size; i++) {
    const v = transient[i];
    A[i][i] = A[i][i].add(F(1, 2)); // (1 − ½) self-stay ⇒ I − ½ on diagonal
    for (const w of [up(v), down(v)]) {
      if (w === 0) continue; // absorbing
      const j = idx.get(w)!;
      A[i][j] = A[i][j].sub(F(1, 4));
    }
  }
  const E = solveLinearRational(A, b);
  return E[idx.get(gap)!];
}

/* ========================================================================== */
/*  Formatting helpers (exact fraction → display)                              */
/* ========================================================================== */

/** Fraction as a rounded decimal string with `dp` places (trailing zeros kept). */
export function fracDecimal(f: Fraction, dp = 4): string {
  return f.valueOf().toFixed(dp);
}

/** Fraction as an exact "a/b" (or integer) string. */
export function fracExact(f: Fraction): string {
  return f.toFraction();
}

/** Number of a Fraction (for tolerant compares in tests). */
export function toNum(f: Fraction): number {
  return f.valueOf();
}

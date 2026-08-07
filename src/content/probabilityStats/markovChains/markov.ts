import Fraction from "fraction.js";

/**
 * Exact solvers for the Probability & Statistics → Markov Chain Probability
 * subcategory.
 *
 * Every question in the source dataset is an absorbing-Markov-chain setup solved
 * by FIRST-STEP ANALYSIS. E[s] = 1 + Σ P(s→s')·E[s'] with E = 0 at absorbing
 * states for expected hitting times, or the analogous h[s] = Σ P(s→s')·h[s']
 * (h = 1 at the target, 0 at ruin) for gambler's-ruin / reach-a-target
 * probabilities. This file is organised by the three families the dataset
 * spans:
 *   1. Expected hitting time (absorbing chains): coin-pattern waits, small
 *      random walks on a line / cube / octagon / 2-D grid, spinners, two-state
 *      return times, and the birthday-repeat back-recursion.
 *   2. Gambler's ruin / reaching a target (incl. bold play + the semi-infinite
 *      Drunkard's-Walk, which is PIECEWISE).
 *   3. Pattern races (which of two coin patterns appears first), via Conway's
 *      leading-number / autocorrelation algorithm.
 *
 * All arithmetic is EXACT rational via `fraction.js` (never floats) except the
 * intentionally-large 2-D grid (11×11) and 2000-song birthday back-recursion,
 * which are solved with a fast float linear solve / iteration and reproduce the
 * documented rounded answers (29.24, 56.72). A general exact linear solver
 * (`solveLinearFraction`) backs the graph walks and bold play, and a matching
 * float solver (`solveLinearFloat`) backs the big grid.
 *
 * NONE of the 16 source-dataset questions are user-facing, they live only in
 * `./markovChains.test.ts` as hidden fixtures, and this solver is asserted to
 * reproduce every documented answer there.
 */

export const F = (n: number | string | bigint, d?: number | bigint): Fraction =>
  d === undefined ? new Fraction(n as never) : new Fraction(n as never, d);

export function fracText(f: Fraction): string {
  return f.toFraction(false);
}

export function decText(f: Fraction | number, dp: number): string {
  const v = typeof f === "number" ? f : f.valueOf();
  return v.toFixed(dp);
}

/** Smallest decimal places d (≤ cap) making f·10^d an exact integer, else cap. */
export function exactDecimals(f: Fraction, cap = 6): number {
  for (let d = 0; d <= cap; d++) {
    if (Number(f.mul(10 ** d).d) === 1) return d;
  }
  return cap;
}

/* ========================================================================== */
/*  Generic exact + float linear solvers (Gaussian elimination)                */
/* ========================================================================== */

/** Solve A·x = b exactly over the rationals. `A` is n×n, `b` is length n. */
export function solveLinearFraction(A: Fraction[][], b: Fraction[]): Fraction[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = -1;
    for (let r = col; r < n; r++) {
      if (M[r][col].valueOf() !== 0) {
        piv = r;
        break;
      }
    }
    if (piv === -1) throw new Error("singular system");
    [M[col], M[piv]] = [M[piv], M[col]];
    const pv = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] = M[col][j].div(pv);
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

/** Float analogue of `solveLinearFraction`, for the large 2-D grid solve. */
export function solveLinearFloat(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    [M[col], M[piv]] = [M[piv], M[col]];
    const pv = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (factor === 0) continue;
      for (let j = col; j <= n; j++) M[r][j] -= factor * M[col][j];
    }
  }
  return M.map((row) => row[n]);
}

/* ========================================================================== */
/*  Generic absorbing-chain first-step analysis (exact)                        */
/* ========================================================================== */

export interface Edge {
  p: Fraction;
  to: number;
}

/**
 * Expected number of steps to absorption from `start`, via first-step analysis
 * E[i] = 1 + Σ P(i→j)·E[j] with E = 0 on absorbing states. States are the
 * integers 0…n−1; `edges(i)` lists the transitions out of transient state i
 * (probabilities summing to 1), `isAbsorbing(i)` marks the E = 0 states.
 * Solves (I − Q)·t = 1 over the rationals. Exact.
 */
export function expectedAbsorptionTime(
  n: number,
  edges: (i: number) => Edge[],
  isAbsorbing: (i: number) => boolean,
  start: number,
): Fraction {
  if (isAbsorbing(start)) return F(0);
  const idx = new Map<number, number>();
  const transient: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!isAbsorbing(i)) {
      idx.set(i, transient.length);
      transient.push(i);
    }
  }
  const m = transient.length;
  const A: Fraction[][] = Array.from({ length: m }, () =>
    Array.from({ length: m }, () => F(0)),
  );
  const b: Fraction[] = Array.from({ length: m }, () => F(1));
  for (let r = 0; r < m; r++) {
    const i = transient[r];
    A[r][r] = A[r][r].add(F(1));
    for (const e of edges(i)) {
      if (!isAbsorbing(e.to)) {
        const c = idx.get(e.to)!;
        A[r][c] = A[r][c].sub(e.p);
      }
    }
  }
  const t = solveLinearFraction(A, b);
  return t[idx.get(start)!];
}

/**
 * Absorption PROBABILITY from `start`: h[i] = Σ P(i→j)·h[j], with h = the
 * boundary value on absorbing states (1 at the target, 0 at ruin). Solves
 * (I − Q)·h = c over the rationals, where c collects the weighted boundary
 * values. Exact. Used for gambler's ruin (incl. bold play).
 */
export function absorptionProbability(
  n: number,
  edges: (i: number) => Edge[],
  isAbsorbing: (i: number) => boolean,
  boundaryValue: (i: number) => Fraction,
  start: number,
): Fraction {
  if (isAbsorbing(start)) return boundaryValue(start);
  const idx = new Map<number, number>();
  const transient: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!isAbsorbing(i)) {
      idx.set(i, transient.length);
      transient.push(i);
    }
  }
  const m = transient.length;
  const A: Fraction[][] = Array.from({ length: m }, () =>
    Array.from({ length: m }, () => F(0)),
  );
  const b: Fraction[] = Array.from({ length: m }, () => F(0));
  for (let r = 0; r < m; r++) {
    const i = transient[r];
    A[r][r] = A[r][r].add(F(1));
    for (const e of edges(i)) {
      if (isAbsorbing(e.to)) {
        b[r] = b[r].add(e.p.mul(boundaryValue(e.to)));
      } else {
        const c = idx.get(e.to)!;
        A[r][c] = A[r][c].sub(e.p);
      }
    }
  }
  const h = solveLinearFraction(A, b);
  return h[idx.get(start)!];
}

/* ========================================================================== */
/*  FAMILY 1. Expected hitting time (absorbing chains)                        */
/* ========================================================================== */

/**
 * Expected number of trials to see a RUN of `n` consecutive successes, each
 * success independent with probability `p` (0 < p < 1). First-step recursion
 * s_k = 1 + p·s_{k+1} + (1−p)·s_0 collapses to the closed form
 * (1 − pⁿ)/(pⁿ·(1 − p)). For a fair coin (p = ½) this is 2^{n+1} − 2 (HHH → 14,
 * 4-coin parking meter → 30). Exact.
 */
export function runWaitExpected(p: Fraction, n: number): Fraction {
  if (n < 1) throw new Error("need n ≥ 1");
  const pn = p.pow(n) as Fraction;
  return F(1).sub(pn).div(pn.mul(F(1).sub(p)));
}

/**
 * Expected trials for TWO successes in a row, each w.p. `p`: (1 + p)/p²
 * (= `runWaitExpected(p, 2)`, kept explicit because the +1 term is the whole
 * teaching point, the trap is the geometric 1/p²). For p = 3/8 → 88/9 ≈ 9.78.
 * Exact.
 */
export function twoInARowExpected(p: Fraction): Fraction {
  return F(1).add(p).div(p.pow(2) as Fraction);
}

/**
 * Two-state chain: you are in state S which repeats w.p. `pStayS`; otherwise you
 * move to the other state O, which repeats w.p. `pStayO`. Expected steps until
 * the next visit to S. First-step: E_O = 1/(1 − pStayO); E_S = 1 + (1 − pStayS)·E_O.
 * (Animal Migrations: pStayS = 0.9, pStayO = 0.6 → 1.25.) Exact.
 */
export function twoStateReturnExpected(pStayS: Fraction, pStayO: Fraction): Fraction {
  const eO = F(1).div(F(1).sub(pStayO));
  return F(1).add(F(1).sub(pStayS).mul(eO));
}

/**
 * Expected spins for a spinner (region probabilities `probs`, summing to 1) to
 * land on TWO DISTINCT regions. After the first spin lands in region r, the
 * wait for anything different is geometric with mean 1/(1 − P(r)); averaging
 * over the first region gives 1 + Σ_r P(r)/(1 − P(r)). (P = 1/3, 1/4, 5/12 →
 * ≈ 2.55.) Exact.
 */
export function spinnerTwoDistinctExpected(probs: Fraction[]): Fraction {
  return probs.reduce((acc, p) => acc.add(p.div(F(1).sub(p))), F(1));
}

/**
 * Symmetric ±1 walk on a path of `sites` interior positions in a row (a walker
 * at site `startSite`, 1-indexed, steps to either neighbour w.p. ½ and is
 * absorbed on stepping off either end). Expected steps = startSite·(sites + 1 −
 * startSite), the gambler's-ruin duration i·(N − i) with N = sites + 1.
 * (Jumping Toad: 2 sites, start 1 → 2.) Exact.
 */
export function lineWalkExpected(sites: number, startSite: number): Fraction {
  if (startSite < 1 || startSite > sites) throw new Error("need 1 ≤ startSite ≤ sites");
  return F(startSite * (sites + 1 - startSite));
}

/**
 * Random walk on the corners of a CUBE from a start corner to the diametrically
 * opposite corner (each step to a uniformly random neighbour, 1/3 each; 1 unit
 * per step). Solved on the symmetry-reduced distance chain d ∈ {0,1,2,3} (3
 * absorbing). Returns the expected steps from the start (d = 0) = 10. Exact.
 */
export function cubeWalkExpected(): Fraction {
  // States 0..3 = distance from start; 3 = opposite corner (absorbing).
  const edges = (d: number): Edge[] => {
    if (d === 0) return [{ p: F(1), to: 1 }];
    if (d === 1) return [{ p: F(1, 3), to: 0 }, { p: F(2, 3), to: 2 }];
    if (d === 2) return [{ p: F(2, 3), to: 1 }, { p: F(1, 3), to: 3 }];
    return [];
  };
  return expectedAbsorptionTime(4, edges, (d) => d === 3, 0);
}

/**
 * Random walk on a regular polygon with `sides` corners (even), each minute
 * clockwise w.p. `pCW`, counter-clockwise w.p. `pCCW`, or stay w.p. the
 * remainder. Expected minutes to reach the diametrically opposite corner
 * (distance `sides/2`). Solved on the distance chain d ∈ {0…sides/2}. (Octagon,
 * CW = CCW = 2/5, stay 1/5 → 20.) Exact.
 */
export function polygonOppositeExpected(
  sides: number,
  pCW: Fraction,
  pCCW: Fraction,
): Fraction {
  if (sides % 2 !== 0 || sides < 4) throw new Error("need an even polygon, ≥ 4 sides");
  const half = sides / 2;
  const pStay = F(1).sub(pCW).sub(pCCW);
  const edges = (d: number): Edge[] => {
    const out: Edge[] = [{ p: pStay, to: d }];
    if (d === 0) {
      // both directions lead to distance 1
      out.push({ p: pCW.add(pCCW), to: 1 });
    } else {
      out.push({ p: pCW, to: d + 1 });
      out.push({ p: pCCW, to: d - 1 });
    }
    return out;
  };
  return expectedAbsorptionTime(half + 1, edges, (d) => d === half, 0);
}

/** Boundary predicate + center index shared by the two 2-D grid solvers. */
function gridSpec(m: number): {
  size: number;
  n: number;
  isBoundary: (i: number) => boolean;
  neighbors: (i: number) => number[];
  center: number;
} {
  const size = 2 * m + 1; // coordinates 0..2m
  const n = size * size;
  const xy = (i: number): [number, number] => [i % size, Math.floor(i / size)];
  const isBoundary = (i: number) => {
    const [x, y] = xy(i);
    return x === 0 || y === 0 || x === 2 * m || y === 2 * m;
  };
  const neighbors = (i: number) => {
    const [x, y] = xy(i);
    return [
      y * size + (x + 1),
      y * size + (x - 1),
      (y + 1) * size + x,
      (y - 1) * size + x,
    ];
  };
  return { size, n, isBoundary, neighbors, center: m * size + m };
}

/**
 * Expected steps for a particle at the CENTER of a (2m+1)×(2m+1) grid of
 * integer points to reach the boundary (each step N/S/E/W w.p. ¼, absorbed on
 * any boundary point). Solved EXACTLY over the rationals, intended for small m
 * (gameplay). For the documented 11×11 case (m = 5) use
 * `grid2DCenterExpectedFloat` (fast). Exact.
 */
export function grid2DCenterExpected(m: number): Fraction {
  const { n, isBoundary, neighbors, center } = gridSpec(m);
  const edges = (i: number): Edge[] =>
    neighbors(i).map((to) => ({ p: F(1, 4), to }));
  return expectedAbsorptionTime(n, edges, isBoundary, center);
}

/**
 * Float solve of the same center-to-boundary expected-steps problem, for large
 * grids where an exact rational solve is unnecessary (the documented answer is
 * a 2-dp float). For m = 5 (11×11) → 534525/18281 ≈ 29.24. Fast.
 */
export function grid2DCenterExpectedFloat(m: number): number {
  const { n, isBoundary, neighbors, center } = gridSpec(m);
  const idx = new Map<number, number>();
  const transient: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!isBoundary(i)) {
      idx.set(i, transient.length);
      transient.push(i);
    }
  }
  const k = transient.length;
  const A: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  const b: number[] = new Array(k).fill(1);
  for (let r = 0; r < k; r++) {
    A[r][r] = 1;
    for (const to of neighbors(transient[r])) {
      if (!isBoundary(to)) A[r][idx.get(to)!] -= 0.25;
    }
  }
  const t = solveLinearFloat(A, b);
  return t[idx.get(center)!];
}

/**
 * Expected number of items drawn (each uniform over `N` types, with
 * replacement) until the FIRST repeat, the birthday-style absorbing chain.
 * With k distinct types already seen, the next is new w.p. (N − k)/N, so
 * E[k] = 1 + ((N − k)/N)·E[k+1], back-recursion from E[N] = 0. Computed in
 * floating point (N up to 2000). For N = 2000 → ≈ 56.72. (Bet of 100-without-a-
 * repeat is NOT safe.)
 */
export function expectedDrawsUntilRepeat(N: number): number {
  const E = new Array(N + 1).fill(0);
  for (let k = N - 1; k >= 0; k--) {
    E[k] = 1 + ((N - k) / N) * E[k + 1];
  }
  return E[0];
}

/* ========================================================================== */
/*  FAMILY 2. Gambler's ruin / reaching a target                             */
/* ========================================================================== */

/**
 * Gambler's ruin: starting with `k` units, each round win one unit w.p. `p`
 * (else lose one), probability of reaching `N` before 0. Fair play (p = ½) →
 * k/N; biased play → (1 − rᵏ)/(1 − rᴺ) with r = q/p. (Bankrupt: k = 1, N = 3,
 * p = 2/3 → 4/7; Dominant Game: k = 10, N = 20, p = 2/3 → ≈ 0.999.) Exact.
 */
export function gamblerRuinReach(k: number, N: number, p: Fraction): Fraction {
  if (k < 0 || k > N || N < 1) throw new Error("need 0 ≤ k ≤ N, N ≥ 1");
  if (p.equals(F(1, 2))) return F(k, N);
  const r = F(1).sub(p).div(p); // q/p
  const rk = r.pow(k) as Fraction;
  const rN = r.pow(N) as Fraction;
  return F(1).sub(rk).div(F(1).sub(rN));
}

/**
 * BOLD play: start with `start` units, target `target`, each round stake
 * min(w, target − w) and win the stake w.p. `p` (else lose it). Probability of
 * reaching `target` before 0, via first-step analysis on states 0…target.
 * (Start 3, target 5, p = 1/3 → 29/77 ≈ 0.377, strictly better than the timid
 * unit-stake ruin value.) Exact.
 */
export function boldPlayReachProb(start: number, target: number, p: Fraction): Fraction {
  const q = F(1).sub(p);
  const edges = (w: number): Edge[] => {
    const stake = Math.min(w, target - w);
    return [
      { p, to: w + stake },
      { p: q, to: w - stake },
    ];
  };
  const isAbs = (w: number) => w === 0 || w === target;
  const boundary = (w: number) => (w === target ? F(1) : F(0));
  return absorptionProbability(target + 1, edges, isAbs, boundary, start);
}

/**
 * The Drunkard's Walk, semi-infinite gambler's ruin. Standing one step from a
 * cliff (position 1, 0 = fall); each step AWAY w.p. `p`, TOWARD the cliff w.p.
 * 1 − p. Probability of eventually falling off. PIECEWISE: from X = (1−p) + p·X²,
 * the fall probability is 1 when p ≤ ½ (certain), and (1 − p)/p when p > ½.
 * (p = 2/3 → 1/2.) Exact.
 */
export function drunkardFallProb(p: Fraction): Fraction {
  if (p.valueOf() <= 0.5) return F(1);
  return F(1).sub(p).div(p);
}

/* ========================================================================== */
/*  FAMILY 3. Pattern races (Conway leading numbers, fair coin)              */
/* ========================================================================== */

/**
 * Conway correlation ("leading number") of pattern `x` into pattern `y` for a
 * fair 2-symbol source: Σ_{k=1}^{min|x|,|y|} [last k symbols of x = first k of y]·2^{k−1}.
 * Integer.
 */
export function patternCorr(x: string, y: string): number {
  let total = 0;
  const lim = Math.min(x.length, y.length);
  for (let k = 1; k <= lim; k++) {
    if (x.slice(x.length - k) === y.slice(0, k)) total += 2 ** (k - 1);
  }
  return total;
}

/**
 * Expected number of fair-coin tosses to first see pattern `a`, via Conway:
 * E = 2·corr(a, a). (HHH → 14; THH → 8, the overlap makes THH strictly faster
 * because a failure does not fully reset progress.) Exact.
 */
export function patternWaitExpected(a: string): Fraction {
  return F(2 * patternCorr(a, a));
}

/**
 * Probability that fair-coin pattern `a` appears strictly before pattern `b`,
 * via Conway's odds formula: with A = corr(a,a) − corr(a,b) surplus for b, the
 * odds a:b = (corr(b,b) − corr(b,a)) : (corr(a,a) − corr(a,b)). (HHH before THH
 * → 1/8, NOT the naive ½.) Exact.
 */
export function patternRaceProb(a: string, b: string): Fraction {
  const numA = patternCorr(b, b) - patternCorr(b, a);
  const numB = patternCorr(a, a) - patternCorr(a, b);
  if (numA + numB === 0) throw new Error("degenerate pattern race");
  return F(numA, numA + numB);
}

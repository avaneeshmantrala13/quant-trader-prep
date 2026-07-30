/**
 * ============================================================================
 *  RANDOM PROCESSES — SIMULATION MODEL (Markov chains, Gambler's Ruin)
 * ============================================================================
 * Pure, deterministic-given-seed functions powering the "Markov Chains &
 * Processes" sims of the Simulations tab. No React / DOM here — just linear
 * algebra on row-stochastic matrices and seedable ±1 random walks, so every
 * result is reproducible and unit-testable.
 */
import { Rng } from "@/lib/rng";
import { cumulativeProportion } from "@/lib/simulations/shared";

/**
 * One step of a distribution under a row-stochastic transition matrix:
 * the row-vector product `dist · P`, i.e. `out[j] = Σ_i dist[i] · P[i][j]`.
 * `dist` length must equal the matrix dimension `n`.
 */
export function stepDistribution(P: number[][], dist: number[]): number[] {
  const n = P.length;
  const out: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const di = dist[i];
    const row = P[i];
    for (let j = 0; j < n; j++) out[j] += di * row[j];
  }
  return out;
}

/**
 * Stationary distribution of a row-stochastic (square) matrix `P` via power
 * iteration: start from the uniform distribution, repeatedly apply
 * `stepDistribution` (~1000 times), then normalize so the vector sums to 1.
 */
export function stationaryDistribution(P: number[][]): number[] {
  const n = P.length;
  if (n === 0) return [];
  let dist: number[] = new Array(n).fill(1 / n);
  for (let k = 0; k < 1000; k++) dist = stepDistribution(P, dist);
  const total = dist.reduce((a, b) => a + b, 0) || 1;
  return dist.map((v) => v / total);
}

/**
 * Trajectory of distributions of length `steps + 1`: index 0 is `initial`, and
 * each subsequent entry is one more application of `stepDistribution`. `steps`
 * is clamped to be non-negative.
 */
export function evolveDistribution(
  P: number[][],
  initial: number[],
  steps: number,
): number[][] {
  const out: number[][] = [initial.slice()];
  const n = Math.max(0, steps);
  let cur = initial;
  for (let s = 0; s < n; s++) {
    cur = stepDistribution(P, cur);
    out.push(cur);
  }
  return out;
}

/** Pick the next state from row `P[state]` using a single RNG draw. */
function nextState(P: number[][], state: number, rng: Rng): number {
  const row = P[state];
  const u = rng.next();
  let acc = 0;
  for (let j = 0; j < row.length; j++) {
    acc += row[j];
    if (u < acc) return j;
  }
  return row.length - 1; // guard against floating-point shortfall
}

/**
 * Simulate a walk of `steps` transitions on the chain `P`, starting in state
 * `start`, and return the fraction of time spent in each state (length `n`).
 * As `steps → ∞` this converges to the stationary distribution. Deterministic
 * for a given `seed`.
 */
export function simulateChainOccupancy(
  P: number[][],
  start: number,
  steps: number,
  seed: number,
): number[] {
  const n = P.length;
  const counts: number[] = new Array(n).fill(0);
  if (n === 0) return counts;
  const total = Math.max(0, steps);
  const rng = new Rng(seed);
  let state = start;
  for (let s = 0; s < total; s++) {
    counts[state]++;
    state = nextState(P, state, rng);
  }
  return counts.map((c) => (total > 0 ? c / total : 0));
}

/**
 * Closed-form probability of reaching `target` before 0 for a ±1 random walk
 * with `P(up) = p`, starting at `start` (with `0 < start < target`).
 * Fair case (`p = 0.5`): `start / target`. Biased case: with `r = (1 − p) / p`,
 * `(1 − r^start) / (1 − r^target)`.
 */
export function gamblersRuinReachTarget(
  p: number,
  start: number,
  target: number,
): number {
  if (p === 0.5) return start / target;
  const r = (1 - p) / p;
  return (1 - r ** start) / (1 - r ** target);
}

/**
 * Running empirical proportion of games (each a full ±1 walk started at
 * `start`) that reach `target` before hitting 0. `out[i]` is the proportion
 * over the first `i + 1` games. Deterministic for a given `seed`.
 */
export function simulateGamblersRuinReach(
  p: number,
  start: number,
  target: number,
  games: number,
  seed: number,
): number[] {
  const rng = new Rng(seed);
  const n = Math.max(0, games);
  const reached: boolean[] = new Array(n);
  for (let g = 0; g < n; g++) {
    let pos = start;
    while (pos > 0 && pos < target) {
      pos += rng.chance(p) ? 1 : -1;
    }
    reached[g] = pos >= target;
  }
  return cumulativeProportion(reached);
}

/**
 * One sample ±1 walk started at `start`, stopping when it hits 0 or `target`.
 * Returns the array of positions over steps (index 0 is `start`). Deterministic
 * for a given `seed`; capped at 20000 steps so a degenerate walk can't hang.
 */
export function simulateWalkTrajectory(
  p: number,
  start: number,
  target: number,
  seed: number,
): number[] {
  const rng = new Rng(seed);
  const path: number[] = [start];
  let pos = start;
  let guard = 0;
  while (pos > 0 && pos < target && guard < 20000) {
    pos += rng.chance(p) ? 1 : -1;
    path.push(pos);
    guard++;
  }
  return path;
}

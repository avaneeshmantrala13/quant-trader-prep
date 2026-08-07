/**
 * mock/archetypes/verifiers.ts — DETERMINISTIC ground-truth verifiers for the
 * hard mock-interview archetypes.
 *
 * Correctness in the mock is OWNED BY DETERMINISTIC VERIFIERS, never the LLM.
 * Every hard archetype's exact numeric answer(s) are computed here from first
 * principles (exact enumeration / closed forms / dynamic programming), so a
 * question generator can *pin the true answer it was verified against* and the
 * grader is anchored to a value that is independently checkable.
 *
 * Every closed form / DP in this file is cross-checked two ways:
 *   • an EXACT unit test (`verifiers.test.ts`) pinning the rational value, AND
 *   • a Monte-Carlo sanity test for every probabilistic archetype.
 *
 * PURE: no React, DOM, storage, or network. Same inputs ⇒ same output.
 *
 * ANCHOR (Optiver): two lattice walkers, A from (0,0) stepping up/right, B from
 * (bx,by) stepping down/left, each fair. P(their PATHS intersect) for B=(3,4) is
 * 3273/4096 ≈ 0.7991; and by a PARITY argument the probability they occupy the
 * SAME lattice point at the SAME time is 0 whenever bx+by is odd (the trap).
 */

/* -------------------------------------------------------------------------- */
/*  Exact integer helpers                                                      */
/* -------------------------------------------------------------------------- */

/** Binomial coefficient C(n,k) as an exact integer (n small). */
export function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let num = 1;
  let den = 1;
  for (let i = 0; i < k; i++) {
    num *= n - i;
    den *= i + 1;
  }
  return Math.round(num / den);
}

/* -------------------------------------------------------------------------- */
/*  1) LATTICE-PATH MEETING (Optiver anchor + parity trap)                      */
/* -------------------------------------------------------------------------- */

/**
 * P(the two walkers occupy the SAME point at the SAME time). A steps up/right
 * from (0,0); B steps down/left from (bx,by). Their coordinate-sum diagonals are
 * `t` (for A) and `bx+by−t` (for B), so a same-time meeting is only possible at
 * `t = (bx+by)/2` — which requires bx+by EVEN. When bx+by is ODD this is exactly
 * 0 (the PARITY TRAP). When even, it is C(s, bx) / 2^s with s = bx+by.
 */
export function latticeSameTimeMeetProb(bx: number, by: number): number {
  const s = bx + by;
  if (s % 2 === 1) return 0;
  return binom(s, bx) / 2 ** s;
}

/** Whether a same-time meeting is possible at all (parity gate). */
export function latticeSameTimePossible(bx: number, by: number): boolean {
  return (bx + by) % 2 === 0;
}

/** Enumerate every vertex a monotone walk visits, given a bitmask of its steps. */
function walkVertices(
  sx: number,
  sy: number,
  steps: number,
  bits: number,
  dx: number,
  dy: number,
): Set<number> {
  let x = sx;
  let y = sy;
  const key = (a: number, b: number) => (a + 16) * 64 + (b + 16);
  const seen = new Set<number>([key(x, y)]);
  for (let i = 0; i < steps; i++) {
    if ((bits >> i) & 1) {
      x += dx;
    } else {
      y += dy;
    }
    seen.add(key(x, y));
  }
  return seen;
}

/**
 * EXACT P(the two PATHS intersect) — i.e. the walkers share SOME vertex (not
 * necessarily at the same time). A from (0,0) steps +x/+y; B from (bx,by) steps
 * −x/−y; each of the s = bx+by steps is a fair coin. Computed by enumerating all
 * 2^s × 2^s step-sequence pairs (exact rational value). For B=(3,4): 3273/4096.
 */
export function latticePathsIntersectProb(bx: number, by: number): number {
  const s = bx + by;
  const total = 1 << s;
  const aWalks: Set<number>[] = [];
  const bWalks: Set<number>[] = [];
  for (let bits = 0; bits < total; bits++) {
    aWalks.push(walkVertices(0, 0, s, bits, 1, 1));
    bWalks.push(walkVertices(bx, by, s, bits, -1, -1));
  }
  let hit = 0;
  for (const a of aWalks) {
    for (const b of bWalks) {
      let meet = false;
      for (const v of a) {
        if (b.has(v)) {
          meet = true;
          break;
        }
      }
      if (meet) hit++;
    }
  }
  return hit / (total * total);
}

/* -------------------------------------------------------------------------- */
/*  2) BANK-OR-ROLL optimal stopping (Jane Street mutation cascade)             */
/* -------------------------------------------------------------------------- */

/**
 * Finite bank-or-roll with a fair `faces`-sided die and up to `rolls` rolls,
 * MUST keep the last roll. Optimal policy: keep the current face iff it is ≥ the
 * continuation value (EV of playing on). Returns the game EV and the lowest kept
 * face for each number of remaining rolls (index 0 = with 2 rolls left, etc.).
 *   d6, 3 rolls → EV 14/3 ≈ 4.6667 ; d6, 2 rolls → 17/4 = 4.25.
 */
export function bankOrRollFiniteEV(
  faces: number,
  rolls: number,
): { ev: number; keepThresholds: number[]; continuation: number[] } {
  let ev = (faces + 1) / 2; // 1 roll: just the mean
  const continuation: number[] = [ev];
  const keepThresholds: number[] = [];
  for (let k = 2; k <= rolls; k++) {
    const cont = ev;
    let total = 0;
    let thr = faces; // lowest face we keep
    let foundThr = false;
    for (let v = 1; v <= faces; v++) {
      if (v >= cont) {
        total += v;
        if (!foundThr) {
          thr = v;
          foundThr = true;
        }
      } else {
        total += cont;
      }
    }
    ev = total / faces;
    continuation.push(ev);
    keepThresholds.push(thr);
  }
  return { ev, keepThresholds, continuation };
}

/**
 * Base bank-or-roll cascade (Jane Street's published game): a fair `faces`-die,
 * you keep rolling and ADD each new face to a bank; each round you may stop.
 * V(r, v) = max(v + V(r−1, v), C(r−1)); C(r) = mean_w V(r, w). Returns the game
 * value from a fresh start and the terminal keep-threshold. (20-die, 100 rounds
 * → ≈ 1773.34, terminal threshold 18.)
 */
export function bankOrRollBase(
  faces: number,
  rounds: number,
): { value: number; terminalThreshold: number } {
  // V indexed by shown face 1..faces; V for r=0 is 0.
  let V = new Array<number>(faces + 1).fill(0);
  let terminalThreshold = faces;
  for (let r = 1; r <= rounds; r++) {
    let C = 0;
    for (let w = 1; w <= faces; w++) C += V[w];
    C /= faces;
    const nextV = new Array<number>(faces + 1).fill(0);
    let thr = faces;
    let found = false;
    for (let v = 1; v <= faces; v++) {
      const bank = v + V[v];
      const roll = C;
      nextV[v] = Math.max(bank, roll);
      if (bank >= roll && !found) {
        thr = v;
        found = true;
      }
    }
    V = nextV;
    terminalThreshold = thr;
  }
  return { value: V[1], terminalThreshold };
}

/**
 * Mutation #1 — ONE DIE REMOVED: the die is now "off" after each bank and must
 * be re-rolled to turn back "on". V(r,off)=C(r−1); V(r,on,v)=max(v+V(r−1,off),
 * C(r−1)). (20-die, 100 rounds → value ≈ 555.05, threshold 6.)
 */
export function bankOrRollDieRemoved(
  faces: number,
  rounds: number,
): { value: number; threshold: number } {
  let Von = new Array<number>(faces + 1).fill(0);
  let Voff = 0;
  let threshold = faces;
  for (let r = 1; r <= rounds; r++) {
    let C = 0;
    for (let w = 1; w <= faces; w++) C += Von[w];
    C /= faces;
    const nextOn = new Array<number>(faces + 1).fill(0);
    let thr = faces;
    let found = false;
    for (let v = 1; v <= faces; v++) {
      const bank = v + Voff;
      nextOn[v] = Math.max(bank, C);
      if (bank >= C && !found) {
        thr = v;
        found = true;
      }
    }
    Von = nextOn;
    Voff = C;
    threshold = thr;
  }
  return { value: Voff, threshold };
}

/**
 * Mutation #2 — CASINO ADVERSARY: after you bank a face the casino may re-roll
 * it against you, so your continuation from a banked face v is min(V(v), mean).
 * V(r,v)=max(v+min(V(r−1,v),mean), mean). (20-die, 100 rounds → value ≈ 863.93,
 * bank-threshold 9.)
 */
export function bankOrRollCasino(
  faces: number,
  rounds: number,
): { value: number; bankThreshold: number } {
  let V = new Array<number>(faces + 1).fill(0);
  let bankThreshold = faces;
  for (let r = 1; r <= rounds; r++) {
    let mean = 0;
    for (let w = 1; w <= faces; w++) mean += V[w];
    mean /= faces;
    const nextV = new Array<number>(faces + 1).fill(0);
    let thr = faces;
    let found = false;
    for (let v = 1; v <= faces; v++) {
      const ccas = Math.min(V[v], mean);
      const bank = v + ccas;
      nextV[v] = Math.max(bank, mean);
      if (bank >= mean && !found) {
        thr = v;
        found = true;
      }
    }
    V = nextV;
    bankThreshold = thr;
  }
  return { value: V[1], bankThreshold };
}

/* -------------------------------------------------------------------------- */
/*  3) ORDER STATISTICS (dice)                                                  */
/* -------------------------------------------------------------------------- */

/** E[max of m fair `faces`-sided dice] (exact). 2d6 → 161/36 ≈ 4.4722. */
export function expectedMaxDice(m: number, faces: number): number {
  let e = 0;
  const denom = faces ** m;
  for (let k = 1; k <= faces; k++) {
    e += k * ((k ** m - (k - 1) ** m) / denom);
  }
  return e;
}

/** E[min of m fair `faces`-sided dice] (exact). 2d6 → 91/36 ≈ 2.5278. */
export function expectedMinDice(m: number, faces: number): number {
  let e = 0;
  const denom = faces ** m;
  for (let k = 1; k <= faces; k++) {
    e += k * (((faces - k + 1) ** m - (faces - k) ** m) / denom);
  }
  return e;
}

/** P(sum of `d` fair `faces`-dice equals `target`) (exact convolution). */
export function sumDiceProb(d: number, faces: number, target: number): number {
  let dist = new Array<number>(1).fill(1); // dist[0] = 1 way for sum 0
  for (let i = 0; i < d; i++) {
    const next = new Array<number>(dist.length + faces).fill(0);
    for (let s = 0; s < dist.length; s++) {
      if (dist[s] === 0) continue;
      for (let f = 1; f <= faces; f++) next[s + f] += dist[s];
    }
    dist = next;
  }
  const total = faces ** d;
  return (dist[target] ?? 0) / total;
}

/* -------------------------------------------------------------------------- */
/*  4) HIDDEN-COMPOSITION BAYES (Citadel "bet on your own probability")         */
/* -------------------------------------------------------------------------- */

/**
 * A bag of N stones, #black K uniform on {0..N}. You draw `m` WITHOUT
 * replacement and all m are black. P(next draw also black) — the predictive
 * posterior. N=6,m=3 → 4/5 ; N=4,m=1 → 2/3 ; N=3,m=2 → 3/4.
 */
export function hiddenCompositionNextBlack(N: number, m: number): number {
  let num = 0;
  let den = 0;
  for (let K = 0; K <= N; K++) {
    // P(first m all black | K) = falling(K,m)/falling(N,m)
    let w = 1;
    for (let i = 0; i < m; i++) w *= (K - i) / (N - i);
    den += w;
    if (N - m > 0) num += w * ((K - m) / (N - m));
  }
  return num / den;
}

/* -------------------------------------------------------------------------- */
/*  5) KELLY bet-sizing (SIG confidence → stake)                                */
/* -------------------------------------------------------------------------- */

/** Optimal Kelly fraction for a bet paying `b`-to-1 at win prob `p`. */
export function kellyFraction(p: number, b: number): number {
  return (p * (b + 1) - 1) / b;
}

/** Expected log-growth per bet from staking fraction `f` (b-to-1, win prob p). */
export function kellyGrowth(p: number, b: number, f: number): number {
  if (f <= 0) return 0;
  if (f >= 1) return -Infinity;
  return p * Math.log(1 + b * f) + (1 - p) * Math.log(1 - f);
}

/* -------------------------------------------------------------------------- */
/*  6) MARKOV chains / expected hitting times                                   */
/* -------------------------------------------------------------------------- */

/**
 * Expected steps for a random walk on the d-dimensional hypercube (vertices =
 * {0,1}^d, each step flips one uniformly-chosen coordinate) to reach the
 * ANTIPODE of the start. By Hamming-distance symmetry E_k = 1 + (k/d)E_{k−1} +
 * ((d−k)/d)E_{k+1}, E_0 = 0. For d=3 (a cube) the antipode (distance 3) → 10.
 */
export function hypercubeAntipodeHittingTime(d: number): number {
  // Solve E_1..E_d with E_0 = 0 by back-substitution.
  // E_k = 1 + (k/d)E_{k-1} + ((d-k)/d)E_{k+1}; E_d has no k+1 term.
  // Express each E_k = A_k + B_k * E_{k+1}, solve downward is awkward; instead
  // solve the tridiagonal system directly via Gaussian elimination.
  const n = d; // unknowns E_1..E_d
  // Build tridiagonal: row i (1-indexed k=i): coefficients on E_{k-1},E_k,E_{k+1}
  const a = new Array<number>(n + 1).fill(0); // sub (E_{k-1})
  const bdiag = new Array<number>(n + 1).fill(0); // diag (E_k)
  const c = new Array<number>(n + 1).fill(0); // super (E_{k+1})
  const rhs = new Array<number>(n + 1).fill(0);
  for (let k = 1; k <= n; k++) {
    a[k] = -(k / d);
    bdiag[k] = 1;
    c[k] = -((d - k) / d);
    rhs[k] = 1;
  }
  a[1] = 0; // E_0 = 0
  c[n] = 0; // no E_{d+1}
  // Thomas algorithm
  for (let k = 2; k <= n; k++) {
    const w = a[k] / bdiag[k - 1];
    bdiag[k] -= w * c[k - 1];
    rhs[k] -= w * rhs[k - 1];
  }
  const E = new Array<number>(n + 1).fill(0);
  E[n] = rhs[n] / bdiag[n];
  for (let k = n - 1; k >= 1; k--) E[k] = (rhs[k] - c[k] * E[k + 1]) / bdiag[k];
  return E[n]; // start at the antipode, distance d
}

/**
 * Expected number of fair-coin flips until a target H/T pattern first appears,
 * via the Conway/KMP automaton. "HH"→6, "HT"→4, "HHH"→14, "HTH"→10, "HHT"→8.
 */
export function expectedFlipsForPattern(pattern: string): number {
  const L = pattern.length;
  const nextState = (s: number, ch: string): number => {
    const cand = pattern.slice(0, s) + ch;
    for (let k = Math.min(cand.length, L); k >= 0; k--) {
      if (cand.slice(cand.length - k) === pattern.slice(0, k)) return k;
    }
    return 0;
  };
  // Linear system E_s = 1 + 0.5 E_{ns(H)} + 0.5 E_{ns(T)}, E_L = 0.
  const A: number[][] = Array.from({ length: L }, () => new Array<number>(L).fill(0));
  const bvec = new Array<number>(L).fill(1);
  for (let s = 0; s < L; s++) {
    A[s][s] += 1;
    for (const ch of ["H", "T"]) {
      const ns = nextState(s, ch);
      if (ns === L) continue;
      A[s][ns] -= 0.5;
    }
  }
  // Gaussian elimination.
  for (let col = 0; col < L; col++) {
    let piv = col;
    for (let r = col + 1; r < L; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    [A[col], A[piv]] = [A[piv], A[col]];
    [bvec[col], bvec[piv]] = [bvec[piv], bvec[col]];
    const d = A[col][col];
    for (let r = 0; r < L; r++) {
      if (r === col) continue;
      const f = A[r][col] / d;
      for (let cc = col; cc < L; cc++) A[r][cc] -= f * A[col][cc];
      bvec[r] -= f * bvec[col];
    }
  }
  return bvec[0] / A[0][0];
}

/**
 * Gambler's ruin on {0..N}, start `a`, step +1 w.p. p else −1. Returns
 * P(reach N before 0). Fair (p=1/2) → a/N.
 */
export function gamblersRuinReachTop(a: number, N: number, p = 0.5): number {
  if (p === 0.5) return a / N;
  const r = (1 - p) / p;
  return (1 - r ** a) / (1 - r ** N);
}

/** Expected steps of a FAIR gambler's ruin from `a` on {0..N} → a·(N−a). */
export function gamblersRuinExpectedSteps(a: number, N: number): number {
  return a * (N - a);
}

/* -------------------------------------------------------------------------- */
/*  7) DRW hard-math archetypes                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A token starts on step 0. Each move goes +1 (w.p. 1/2) or +2 (w.p. 1/2).
 * P(it ever lands EXACTLY on step n) satisfies p_n = 1/2·p_{n−1} + 1/2·p_{n−2},
 * p_0 = 1, p_1 = 1/2. As n→∞, p_n → 2/3. p_4 = 11/16 ; p_10 = 683/1024.
 */
export function coinStepLandProb(n: number): number {
  if (n === 0) return 1;
  const p: number[] = [1, 0.5];
  for (let i = 2; i <= n; i++) p.push(0.5 * p[i - 1] + 0.5 * p[i - 2]);
  return p[n];
}

/**
 * Expected rolls of a fair `n`-sided die until you see all faces would be the
 * coupon-collector; the DRW "reset" variant: you must roll a NEW-highest face
 * each turn to advance, otherwise reset to 0. E_0 = n·(1 + Σ_{k=0}^{n−2} n/(n−k)).
 * n=7 → 1701/20 = 85.05.
 */
export function dieResetExpectedRolls(n: number): number {
  let sum = 0;
  for (let k = 0; k <= n - 2; k++) sum += n / (n - k);
  return n * (sum + 1);
}

/* -------------------------------------------------------------------------- */
/*  8) SECRETARY / optimal stopping cutoff                                      */
/* -------------------------------------------------------------------------- */

/**
 * Classic secretary problem for `n` candidates: reject the first `r`, then take
 * the first that beats them all. Returns the optimal cutoff `r` and the win
 * probability P(r) = (r/n)·Σ_{i=r+1}^{n} 1/(i−1). n=10 → r=3.
 */
export function secretaryOptimalCutoff(n: number): { cutoff: number; prob: number } {
  let bestR = 0;
  let bestP = 1 / n;
  for (let r = 1; r < n; r++) {
    let s = 0;
    for (let i = r + 1; i <= n; i++) s += 1 / (i - 1);
    const p = (r / n) * s;
    if (p > bestP) {
      bestP = p;
      bestR = r;
    }
  }
  return { cutoff: bestR, prob: bestP };
}

/* -------------------------------------------------------------------------- */
/*  9) Symmetry order-statistic + poker (SIG) + IMC inference                    */
/* -------------------------------------------------------------------------- */

/** E[# reds drawn before the FIRST black], R red + B black shuffled → R/(B+1). */
export function redsBeforeFirstBlack(R: number, B: number): number {
  return R / (B + 1);
}

/**
 * Simplified bluff-catching (poker-theory): pot `P`, bet `B`. Value-to-bluff
 * ratio makes the optimal BLUFF frequency B/(P+2B) and the optimal CALL
 * frequency (defender indifference) P/(P+B).
 */
export function bluffCatchFrequencies(
  P: number,
  B: number,
): { bluffFreq: number; callFreq: number } {
  return { bluffFreq: B / (P + 2 * B), callFreq: P / (P + B) };
}

/** E[sum of two fair d6 | sum > threshold] — IMC order-flow "lift". thr=8 → 10. */
export function conditionalTwoDiceMeanAbove(threshold: number): number {
  let num = 0;
  let den = 0;
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) {
      const s = a + b;
      if (s > threshold) {
        num += s;
        den += 1;
      }
    }
  }
  return num / den;
}

/**
 * IMC urn: N balls, unknown #red R uniform on {0..N}. You sample `d` without
 * replacement and see `r` red. Posterior mean of R under the hypergeometric
 * likelihood × uniform prior (exact summation, using log-binomials so N=100 is
 * numerically safe). N=100,d=10,r=3 → 33 ; r=8 → 75.5.
 */
export function urnPosteriorMeanRed(N: number, d: number, r: number): number {
  const logFact: number[] = [0];
  for (let i = 1; i <= N; i++) logFact[i] = logFact[i - 1] + Math.log(i);
  const logBinom = (n: number, k: number): number => {
    if (k < 0 || k > n) return -Infinity;
    return logFact[n] - logFact[k] - logFact[n - k];
  };
  let num = 0;
  let den = 0;
  for (let R = 0; R <= N; R++) {
    const logL = logBinom(R, r) + logBinom(N - R, d - r);
    if (!Number.isFinite(logL)) continue;
    const w = Math.exp(logL);
    den += w;
    num += R * w;
  }
  return num / den;
}

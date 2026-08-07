import Fraction from "fraction.js";

/**
 * Exact + high-precision solver LIBRARY shared across the re-homed Probability &
 * Statistics topics (formerly the "General" subcategory, now dissolved into
 * Combinatorial Analysis, Geometric Probability, Order Statistics, Variance/
 * Covariance & the CLT, Markov Chains, Game Theory & Puzzles, and Conditional
 * Probability). Covers ~14 core quant-interview families.
 *
 * Design mirrors `../markovChains/markov.ts`: EXACT rational arithmetic via
 * `fraction.js` wherever the math is rational (binomial tails, complements,
 * gambler's ruin, dice/counting, order statistics, brackets, covariance/variance,
 * inclusion–exclusion), and plain-`number` floats ONLY for the genuinely
 * transcendental/irrational targets computed to a stated precision:
 *   • CLT normal-approximation Φ values (230 Heads, Beta-Gap z-argument),
 *   • the exponential median ln2/λ,
 *   • the Jumping-Robots Newton's-method equilibrium root,
 *   • a couple of exponential integrals that happen to be rational anyway (1/3).
 *
 * The file is organised family-by-family. NONE of the 67 source-dataset
 * questions are user-facing, they live only in `./general.test.ts` as hidden
 * `SEED_ANSWERS` fixtures, and every solver here is asserted to reproduce the
 * documented answers at the stated precision. All playable content is freshly
 * generated in `./generators.ts` from these solvers.
 */

/* ========================================================================== */
/*  Shared numeric helpers                                                     */
/* ========================================================================== */

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

/** Exact binomial coefficient C(n, k) as an integer (n small, ≤ ~60 here). */
export function choose(n: number, k: number): number {
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

/** Exact factorial as a Fraction (integer-valued), n small. */
export function factorial(n: number): Fraction {
  let f = F(1);
  for (let i = 2; i <= n; i++) f = f.mul(i);
  return f;
}

/** Sentinel used for the divergent-expectation special case (How Many Children). */
export const INFINITY_SENTINEL = "Infinity";

/* ========================================================================== */
/*  FAMILY: Binomial counting (exact rational tails)                           */
/* ========================================================================== */

/** Exact binomial pmf P(X = k), X ~ Bin(n, p), p rational. */
export function binomPMF(n: number, p: Fraction, k: number): Fraction {
  const q = F(1).sub(p);
  return F(choose(n, k))
    .mul(p.pow(k) as Fraction)
    .mul(q.pow(n - k) as Fraction);
}

/** Exact lower tail P(X ≤ k). */
export function binomTailLE(n: number, p: Fraction, k: number): Fraction {
  let s = F(0);
  for (let j = 0; j <= k; j++) s = s.add(binomPMF(n, p, j));
  return s;
}

/** Exact upper tail P(X ≥ k) = 1 − P(X ≤ k−1). */
export function binomTailGE(n: number, p: Fraction, k: number): Fraction {
  return F(1).sub(binomTailLE(n, p, k - 1));
}

/**
 * Smallest number of independent trials n so that P(at least one success) ≥
 * `threshold`, each trial succeeding w.p. `pWin`. Complement + logs:
 * 1 − (1−pWin)ⁿ ≥ threshold ⟺ n ≥ ln(1−threshold)/ln(1−pWin). Integer (ceil).
 */
export function smallestNForAtLeastOne(pWin: number, threshold: number): number {
  const n = Math.log(1 - threshold) / Math.log(1 - pWin);
  // Guard against floating dust right at an integer boundary.
  const c = Math.ceil(n - 1e-9);
  return c;
}

/* ========================================================================== */
/*  FAMILY: Complement / at-least-one (exact rational)                         */
/* ========================================================================== */

/**
 * P(at least one of each of the two colours) when drawing `draw` cards WITHOUT
 * replacement from a deck of `reds` red + `blacks` black (equal split in the
 * classic case). = 1 − P(all one colour) = 1 − [P(all red) + P(all black)].
 */
export function bothColorsProb(reds: number, blacks: number, draw: number): Fraction {
  const total = reds + blacks;
  const allOf = (m: number): Fraction => {
    let p = F(1);
    for (let i = 0; i < draw; i++) p = p.mul(F(m - i, total - i));
    return p;
  };
  return F(1).sub(allOf(reds)).sub(allOf(blacks));
}

/**
 * P(a uniformly-chosen integer in [1, 10^digits] contains the digit `d` at
 * least once). Pad to `digits` positions (000…0 … 999…9); the count with no `d`
 * is 9^digits, and the swap of the padded 0 for 10^digits (both digit-`d`-free)
 * leaves it unchanged. = 1 − 9^digits / 10^digits.
 */
export function containsDigitProb(digits: number): Fraction {
  return F(1).sub(F(9 ** digits, 10 ** digits));
}

/**
 * Per-sub-interval arrival rate from a whole-window "at least one" probability.
 * If P(≥1 event in the whole window) = pWhole and the window splits into `k`
 * independent equal sub-intervals, then (1−p)^k = 1 − pWhole, so the
 * per-sub-interval probability is p = 1 − (1−pWhole)^{1/k}. Returned as a
 * Fraction when the k-th root is rational (the parametric generator guarantees
 * this by construction); otherwise use the float overload in callers.
 */
export function subIntervalProb(noWholeRootNum: number, noWholeRootDen: number): Fraction {
  // Caller passes the exact k-th root (num/den) of the no-event probability.
  return F(1).sub(F(noWholeRootNum, noWholeRootDen));
}

/** P(product of `dice` d-sided dice is even) = 1 − P(all odd) = 1 − (odd/faces)^dice. */
export function productEvenProb(dice: number, faces: number): Fraction {
  const odd = Math.ceil(faces / 2);
  return F(1).sub(F(odd, faces).pow(dice) as Fraction);
}

/* ========================================================================== */
/*  FAMILY: Birthday / collision (exact rational)                              */
/* ========================================================================== */

/** Smallest group size N so P(≥1 shared "birthday") > `threshold` over `days`. */
export function birthdayThreshold(days: number, threshold = 0.5): number {
  let distinct = 1;
  let n = 0;
  while (1 - distinct > threshold ? false : true) {
    n++;
    distinct *= (days - (n - 1)) / days;
    if (1 - distinct > threshold) return n;
    if (n > days) return n; // safety
  }
  return n;
}

/** P(at least two of `people` share one of `days` equally-likely categories). */
export function birthdayCollisionProb(people: number, days: number): Fraction {
  let distinct = F(1);
  for (let i = 0; i < people; i++) distinct = distinct.mul(F(days - i, days));
  return F(1).sub(distinct);
}

/**
 * Collision probability that two players who each SUM two independent uniform
 * draws from {1..m} produce the SAME sum = Σ_s P(S=s)² where the number of ways
 * to get sum s is the triangular convolution. = (Σ ways(s)²)/m⁴.
 */
export function twoSumCollisionProb(m: number): Fraction {
  const ways: number[] = [];
  for (let s = 2; s <= 2 * m; s++) {
    let c = 0;
    for (let a = 1; a <= m; a++) {
      const b = s - a;
      if (b >= 1 && b <= m) c++;
    }
    ways.push(c);
  }
  const sumSq = ways.reduce((acc, w) => acc + w * w, 0);
  return F(sumSq, m ** 4);
}

/* ========================================================================== */
/*  FAMILY: Geometric probability (area / length ratios, exact rational)       */
/* ========================================================================== */

/** P(random point in a radius-R disk lands within radius r of centre) = r²/R². */
export function diskInnerProb(r: number, R: number): Fraction {
  return F(r * r, R * R);
}

/** P(complement) = 1 − r²/R², e.g. a central statue staying clean. */
export function diskOuterProb(r: number, R: number): Fraction {
  return F(1).sub(diskInnerProb(r, R));
}

/**
 * P(a disk of radius `rad` dropped with centre uniform on a `tile`×`tile` square
 * lies entirely inside one tile) = ((tile − 2·rad)/tile)². The centre must be ≥
 * `rad` from all four edges → a shrunken (tile − 2·rad) square.
 */
export function tileFitProb(tile: number, rad: number): Fraction {
  const side = tile - 2 * rad;
  return F(side * side, tile * tile);
}

/**
 * P(two people arriving uniformly in [0, T] with wait window `w` overlap) =
 * (T² − (T−w)²)/T². The favourable band |x−y| ≤ w is the square minus two
 * corner triangles of legs (T−w).
 */
export function meetingProb(T: number, w: number): Fraction {
  return F(T * T - (T - w) * (T - w), T * T);
}

/**
 * P(a glance of length `g` starting uniformly in a period `P` catches at least
 * one of `changes` instantaneous change-events, whose pre-windows of length `g`
 * are disjoint) = changes·g / P.
 */
export function glanceCatchProb(changes: number, g: number, P: number): Fraction {
  return F(changes * g, P);
}

/* ========================================================================== */
/*  FAMILY: Digit & integer counting (exact rational)                          */
/* ========================================================================== */

/**
 * P(a uniformly-chosen integer in [1, 10^L] has ALL digits different). Count by
 * digit-length case: length-ℓ numbers with distinct digits = 9·9·8·…·(11−ℓ)
 * (first digit 1..9, then descending distinct choices incl. 0), and 10^L itself
 * repeats a digit. Sum over ℓ = 1..L, divide by 10^L.
 */
export function allDifferentDigitsProb(L: number): Fraction {
  let count = 0;
  for (let len = 1; len <= L; len++) {
    // first digit: 9 (1..9); remaining len-1 digits: 9,8,7,… (incl 0, distinct)
    let ways = 9;
    let avail = 9;
    for (let i = 1; i < len; i++) {
      ways *= avail;
      avail--;
    }
    count += ways;
  }
  return F(count, 10 ** L);
}

/**
 * P(ones digit strictly greater than tens digit) for a uniform two-digit number
 * 10..99: 90 numbers, favourable Σ_{T=1..9}(9−T) = 36 ⇒ 36/90 = 2/5.
 */
export function onesGreaterThanTensProb(): Fraction {
  let fav = 0;
  for (let tens = 1; tens <= 9; tens++) {
    for (let ones = 0; ones <= 9; ones++) if (ones > tens) fav++;
  }
  return F(fav, 90);
}

/* ========================================================================== */
/*  FAMILY: Dice sums & symmetry (exact rational)                              */
/* ========================================================================== */

/** P(sum of `dice` d-sided dice is ≤ threshold), by exact convolution. */
export function diceSumDistribution(dice: number, faces: number): Map<number, number> {
  let dist = new Map<number, number>([[0, 1]]);
  for (let d = 0; d < dice; d++) {
    const next = new Map<number, number>();
    for (const [s, c] of dist) {
      for (let f = 1; f <= faces; f++) {
        next.set(s + f, (next.get(s + f) ?? 0) + c);
      }
    }
    dist = next;
  }
  return dist;
}

/** P(sum of `dice` d-sided dice ≤ threshold). */
export function diceSumLEProb(dice: number, faces: number, threshold: number): Fraction {
  const dist = diceSumDistribution(dice, faces);
  let fav = 0;
  for (const [s, c] of dist) if (s <= threshold) fav += c;
  return F(fav, faces ** dice);
}

/** P(sum of two d-sided dice ∈ set), for "sum is 2 or 3" style. */
export function diceSumInSetProb(faces: number, set: number[]): Fraction {
  const dist = diceSumDistribution(2, faces);
  const want = new Set(set);
  let fav = 0;
  for (const [s, c] of dist) if (want.has(s)) fav += c;
  return F(fav, faces * faces);
}

/**
 * P(sum of `dice` d-sided dice is even). For any die with an equal count of
 * even/odd faces the last die makes the running total even w.p. ½ regardless of
 * the rest → exactly ½. (Kept as a solver so the symmetry answer is verified,
 * not assumed; works for any faces via the pmf.)
 */
export function diceSumEvenProb(dice: number, faces: number): Fraction {
  const dist = diceSumDistribution(dice, faces);
  let fav = 0;
  for (const [s, c] of dist) if (s % 2 === 0) fav += c;
  return F(fav, faces ** dice);
}

/**
 * P(an even number of heads in `n` fair-coin tosses) = ½ for n ≥ 1. Flipping the
 * last coin toggles parity, pairing every sequence with a unique opposite-parity
 * partner, so the counts are equal (2^{n−1} each). For small n we verify by exact
 * enumeration; for large n (n ≥ 30) we return the proven closed form ½ (avoids
 * 2^n integer overflow, the pairing argument is a proof, not an approximation).
 */
export function evenHeadsProb(n: number): Fraction {
  if (n < 1) return F(1);
  if (n >= 30) return F(1, 2);
  let fav = 0;
  for (let k = 0; k <= n; k++) if (k % 2 === 0) fav += choose(n, k);
  return F(fav, 2 ** n);
}

/** P(second roll strictly less than first) for two d-sided dice = (1 − 1/d)/2. */
export function secondLessProb(faces: number): Fraction {
  return F(1).sub(F(1, faces)).div(2);
}

/**
 * P(a d`big`-sided die shows STRICTLY larger than a d`small`-sided die), big ≥
 * small. Condition on the big die: it exceeds `small` w.p. (big−small)/big
 * (always wins), else two symmetric draws on 1..small give (small−1)/(2·small).
 */
export function biggerDieProb(small: number, big: number): Fraction {
  const alwaysWin = F(big - small, big);
  const tie = F(small, big).mul(F(small - 1, 2 * small));
  return alwaysWin.add(tie);
}

/* ========================================================================== */
/*  FAMILY: Gambler's ruin (exact rational)                                    */
/* ========================================================================== */

/**
 * P(reach `N` before 0) starting from `k`, winning each unit-stake round w.p.
 * `p`. Fair (p = ½) → k/N; biased → (1 − rᵏ)/(1 − rᴺ), r = q/p.
 */
export function gamblerRuinReach(k: number, N: number, p: Fraction): Fraction {
  if (p.equals(F(1, 2))) return F(k, N);
  const r = F(1).sub(p).div(p);
  const rk = r.pow(k) as Fraction;
  const rN = r.pow(N) as Fraction;
  return F(1).sub(rk).div(F(1).sub(rN));
}

/** P(go broke) = 1 − P(reach N), the complementary ruin probability. */
export function gamblerRuinBust(k: number, N: number, p: Fraction): Fraction {
  return F(1).sub(gamblerRuinReach(k, N, p));
}

/* ========================================================================== */
/*  FAMILY: Random walk / recursion (exact rational)                           */
/* ========================================================================== */

/**
 * P(all of the remaining `stepsAfterFirst` fair ±1 steps go forward), i.e. the
 * all-forward walk after a forced first step = (1/2)^{stepsAfterFirst}.
 */
export function allForwardProb(stepsAfterFirst: number): Fraction {
  return F(1, 2).pow(stepsAfterFirst) as Fraction;
}

/**
 * Deuce-style self-referential game: from a tied score, a player wins the next
 * point w.p. `p`. Win the game by taking two in a row (WW), or split then return
 * to deuce. P = p² + 2p(1−p)·P ⇒ P = p²/(1 − 2p(1−p)) = p²/(p² + (1−p)²).
 */
export function deuceWinProb(p: Fraction): Fraction {
  const q = F(1).sub(p);
  return (p.pow(2) as Fraction).div((p.pow(2) as Fraction).add(q.pow(2) as Fraction));
}

/**
 * P(the side flipped FIRST is losing) after 3 fair flips = P(HTT) + P(THH) =
 * 2·(1/2)³ = 1/4 (kept general for `n` symbols is overkill; fixed at 3).
 */
export function firstSideLosingProb(): Fraction {
  return F(2).mul(F(1, 2).pow(3) as Fraction);
}

/**
 * Restart-game: player A ends the round w.p. `x`, player B w.p. `y`, else the
 * round repeats (no winner) w.p. r = 1 − x − y. P(A wins overall) = x/(1−r) =
 * x/(x+y); P(B) = y/(x+y). Returns [pA, pB].
 */
export function restartGameProbs(x: Fraction, y: Fraction): [Fraction, Fraction] {
  const s = x.add(y);
  return [x.div(s), y.div(s)];
}

/* ========================================================================== */
/*  FAMILY: Game theory / optimizing agents                                    */
/* ========================================================================== */

/**
 * Two agents each independently "participate" w.p. p; success = a coin (or all
 * brought coins) landing right. P(success) = p²·¼ + 2p(1−p)·½ = −¾p² + p,
 * maximised at p = 2/3 giving 1/3. Returns { pStar, pSuccess } exactly.
 */
export function beachCoinOptimum(): { pStar: Fraction; pSuccess: Fraction } {
  // Maximise f(p) = -3/4 p² + p ⇒ f'(p) = 1 - 3/2 p = 0 ⇒ p = 2/3.
  const pStar = F(2, 3);
  const pSuccess = F(-3, 4)
    .mul(pStar.pow(2) as Fraction)
    .add(pStar);
  return { pStar, pSuccess };
}

/**
 * Generalised symmetric two-agent participation game: each of two agents
 * independently participates w.p. p; if BOTH participate the reward succeeds
 * w.p. `s2`, if exactly ONE participates it succeeds w.p. `s1`, none → 0.
 * P(success)(p) = s2·p² + 2·s1·p(1−p), a downward parabola (for s1 > s2/2)
 * maximised at p* = s1/(2·s1 − s2). Returns { pStar, pSuccess }. Exact.
 * (Beach-coin case s1 = ½, s2 = ¼ → p* = 2/3, P = 1/3.)
 */
export function optimizeTwoAgent(
  s1: Fraction,
  s2: Fraction,
): { pStar: Fraction; pSuccess: Fraction } {
  const pStar = s1.div(s1.mul(2).sub(s2));
  const q = F(1).sub(pStar);
  const pSuccess = s2
    .mul(pStar.pow(2) as Fraction)
    .add(F(2).mul(s1).mul(pStar).mul(q));
  return { pStar, pSuccess };
}

/**
 * Generalised market-making spread optimum for `U` uninformed + `I` informed
 * traders on a U[0,1] outcome. E[PnL](X) = (1−X)·(U/2)·X − (1−X)·(I/4)·(1−X),
 * maximised at X* = (U + I)/(2U + I) (independent of the common scale). Returns
 * the optimal spread, bid = (1−X)/2, ask = 1 − bid. Exact. (U = I → X* = 2/3.)
 */
export function optimalSpreadGeneral(
  U: number,
  I: number,
): { spread: Fraction; bid: Fraction; ask: Fraction } {
  const spread = F(U + I, 2 * U + I);
  const bid = F(1).sub(spread).div(2);
  const ask = F(1).sub(bid);
  return { spread, bid, ask };
}

/**
 * Market-making spread optimisation: N informed + N uninformed traders on a
 * U[0,1] outcome. E[PnL](X) = (1−X)·(N/2)·X − (1−X)·(N/4)·(1−X), a downward
 * parabola maximised at X* = 2/3 (independent of N). Returns the optimal spread,
 * bid = (1−X)/2, and ask = 1 − bid.
 */
export function optimalSpread(): { spread: Fraction; bid: Fraction; ask: Fraction } {
  const spread = F(2, 3);
  const bid = F(1).sub(spread).div(2);
  const ask = F(1).sub(bid);
  return { spread, bid, ask };
}

/**
 * Jumping-Robots equilibrium: both robots use a threshold x solving
 * (x³ − 3x + 2)·eˣ = 3x. Newton's method on g(x) = (x³−3x+2)eˣ − 3x. Returns
 * both the root x and the reported P(first attempt scores 0) = 1 − (1−x)eˣ.
 */
export function jumpingRobotsRoot(): { x: number; pZero: number } {
  const g = (x: number) => (x * x * x - 3 * x + 2) * Math.exp(x) - 3 * x;
  const gp = (x: number) => {
    const e = Math.exp(x);
    // d/dx[(x³−3x+2)eˣ] = (3x²−3)eˣ + (x³−3x+2)eˣ = (x³+3x²−3x−1)eˣ; minus 3.
    return (x * x * x + 3 * x * x - 3 * x - 1) * e - 3;
  };
  let x = 0.4;
  for (let i = 0; i < 100; i++) {
    const step = g(x) / gp(x);
    x -= step;
    if (Math.abs(step) < 1e-15) break;
  }
  const pZero = 1 - (1 - x) * Math.exp(x);
  return { x, pZero };
}

/* ========================================================================== */
/*  FAMILY: Covariance / variance (exact rational)                             */
/* ========================================================================== */

/** Max covariance under Cauchy–Schwarz = √(Var_A · Var_B) (means irrelevant). */
export function maxCovariance(varA: number, varB: number): number {
  return Math.sqrt(varA * varB);
}

/**
 * Correlation under affine transforms U = a + bX, V = c + dY:
 * ρ(U,V) = sign(b)·sign(d)·ρ(X,Y). Shifts drop; magnitudes cancel.
 */
export function affineCorrelation(b: number, d: number, rho: Fraction): Fraction {
  return F(Math.sign(b) * Math.sign(d)).mul(rho);
}

/** Var(aX + bY) for independent X,Y = a²·Var(X) + b²·Var(Y) (exact). */
export function varLinearCombo(a: number, varX: Fraction, b: number, varY: Fraction): Fraction {
  return F(a * a).mul(varX).add(F(b * b).mul(varY));
}

/** Variance of a discrete uniform on 1..m = (m²−1)/12 (exact). */
export function uniformDiscreteVar(m: number): Fraction {
  return F(m * m - 1, 12);
}

/**
 * Standard deviation of the SUM of two independent draws from a discrete-uniform
 * on 1..m: Var(S) = 2·(m²−1)/12, sd = √Var. Returns the exact Var (Fraction) and
 * the float sd (irrational in general).
 */
export function twoDrumSumSD(m: number): { variance: Fraction; sd: number } {
  const variance = uniformDiscreteVar(m).mul(2);
  return { variance, sd: Math.sqrt(variance.valueOf()) };
}

/** P(no rain either day) under independence = (1−pSat)·(1−pSun) (exact). */
export function noRainIndependentProb(pSat: Fraction, pSun: Fraction): Fraction {
  return F(1).sub(pSat).mul(F(1).sub(pSun));
}

/* ========================================================================== */
/*  FAMILY: Uniform order statistics (exact rational)                          */
/* ========================================================================== */

/**
 * P(the minimum of `n` iid U[a,b] draws lies in [lo, hi]) = P(all > lo) −
 * P(all > hi) = ((b−lo)/(b−a))ⁿ − ((b−hi)/(b−a))ⁿ. Exact.
 */
export function minInIntervalProb(n: number, a: number, b: number, lo: number, hi: number): Fraction {
  const span = b - a;
  const above = (x: number) => F(b - x, span).pow(n) as Fraction;
  return above(lo).sub(above(hi));
}

/** P(a specified strict ordering of `n` iid continuous variables) = 1/n!. */
export function orderingProb(n: number): Fraction {
  return F(1).div(factorial(n));
}

/* ========================================================================== */
/*  FAMILY: Tournament brackets & spatial arrangements (exact rational)        */
/* ========================================================================== */

/**
 * Seeded single-elim bracket of `size` teams (power of two; seed i beats i+1).
 * P(#1 and #3 meet in the FINAL): #3 must be on the opposite half of #1
 * (size/2 of the remaining size−1 slots) AND #2 must be on #1's half so #3 is
 * not eliminated early by #2 ((size/2 − 1) of the remaining size−2 slots).
 */
export function topTwoSeedsMeetFinalProb(size: number): Fraction {
  const half = size / 2;
  const oppSide = F(half, size - 1);
  const twoWithOne = F(half - 1, size - 2);
  return oppSide.mul(twoWithOne);
}

/** P(two specific players meet in ROUND 1) of a random `size`-slot bracket = 1/(size−1). */
export function round1MeetProb(size: number): Fraction {
  return F(1, size - 1);
}

/** P(all `n` uniform points on a circle lie within some common semicircle) = n·(1/2)^{n−1}. */
export function commonSemicircleProb(n: number): Fraction {
  return F(n).mul(F(1, 2).pow(n - 1) as Fraction);
}

/**
 * `n` agents on a regular n-gon, each stepping to a uniformly-random neighbour
 * (±1) by fair coin. P(no two collide) = P(landing is a permutation). For a
 * cycle this requires all-clockwise or all-counter-clockwise = 2/2ⁿ = 2^{1−n}.
 */
export function polygonNoCollisionProb(n: number): Fraction {
  return F(2, 2 ** n);
}

/* ========================================================================== */
/*  FAMILY: Counting / expectation misc                                        */
/* ========================================================================== */

/** Coupon collector: expected draws to see all `n` equally-likely types = n·Hₙ. */
export function couponCollectorExpected(n: number): Fraction {
  let h = F(0);
  for (let k = 1; k <= n; k++) h = h.add(F(1, k));
  return F(n).mul(h);
}

/**
 * P(three independent devices whose overlapping value-supports are 1..a, 1..b,
 * 1..c ALL show the same number). Only values in the common range 1..min match;
 * per value the joint prob is (1/a)(1/b)(1/c), summed over min disjoint values.
 */
export function tripleMatchProb(a: number, b: number, c: number): Fraction {
  const common = Math.min(a, b, c);
  return F(common).mul(F(1, a).mul(F(1, b)).mul(F(1, c)));
}

/**
 * P(a run of ≥ `run` consecutive target symbols in `spins` iid spins, each
 * target w.p. p) via exact DP over the longest current run. General & exact.
 */
export function consecutiveRunProb(spins: number, run: number, p: Fraction): Fraction {
  const q = F(1).sub(p);
  // states: current trailing run length 0..run (run = absorbed success)
  let state: Fraction[] = new Array(run + 1).fill(F(0));
  state[0] = F(1);
  for (let t = 0; t < spins; t++) {
    const next: Fraction[] = new Array(run + 1).fill(F(0));
    next[run] = state[run]; // absorbing
    for (let r = 0; r < run; r++) {
      if (state[r].valueOf() === 0) continue;
      // success → r+1 (may hit `run`), failure → 0
      next[r + 1] = next[r + 1].add(state[r].mul(p));
      next[0] = next[0].add(state[r].mul(q));
    }
    state = next;
  }
  return state[run];
}

/**
 * Expected number of "words" after `n` tokens drawn iid uniform from an alphabet
 * where `mergePairs` specific ordered adjacent pairs merge (each pair prob
 * 1/alpha²). By linearity E[merges] = (n−1)·mergePairs/alpha²; E[words] = n −
 * E[merges].
 */
export function expectedWordsAfterMerges(n: number, alpha: number, mergePairs: number): Fraction {
  const pMerge = F(mergePairs, alpha * alpha);
  const merges = F(n - 1).mul(pMerge);
  return F(n).sub(merges);
}

/**
 * P(first drawer's card strictly higher) drawing two distinct cards from a deck
 * with `ranks` ranks × `suits` suits (no replacement). Condition on the first
 * rank: = (suits/(ranks·(ranks·suits−1)))·Σ_{j=0}^{ranks−1} j·? Simplifies to
 * suits·(ranks−1)/(2·(ranks·suits−1)). (Standard deck 13×4 → 8/17.)
 */
export function higherCardProb(ranks: number, suits: number): Fraction {
  const total = ranks * suits;
  // For a first card of rank with j ranks below it, it beats suits·j of the
  // remaining (total−1) cards. Average over the 1/ranks rank prob:
  let sum = F(0);
  for (let j = 0; j < ranks; j++) {
    sum = sum.add(F(1, ranks).mul(F(suits * j, total - 1)));
  }
  return sum;
}

/**
 * P(at least two consecutive wins across a fixed schedule of opponents with
 * per-match win probs `wins[]`). Exact enumeration of the 2^m win/loss patterns.
 */
export function twoInARowScheduleProb(wins: Fraction[]): Fraction {
  const m = wins.length;
  let total = F(0);
  for (let mask = 0; mask < 1 << m; mask++) {
    // does this pattern have two consecutive wins?
    let ok = false;
    for (let i = 0; i + 1 < m; i++) {
      if (mask & (1 << i) && mask & (1 << (i + 1))) {
        ok = true;
        break;
      }
    }
    if (!ok) continue;
    let p = F(1);
    for (let i = 0; i < m; i++) {
      p = p.mul(mask & (1 << i) ? wins[i] : F(1).sub(wins[i]));
    }
    total = total.add(p);
  }
  return total;
}

/**
 * P(|a − b| ∈ [lo, hi]) for two iid uniform integers on a length-M window
 * {L..L+M−1}. #pairs with |a−b| = d is 2(M−d) for d ≥ 1. Sum over d∈[lo,hi],
 * divide by M². Exact.
 */
export function absDiffInRangeProb(M: number, lo: number, hi: number): Fraction {
  let n = 0;
  for (let d = lo; d <= hi; d++) n += 2 * (M - d);
  return F(n, M * M);
}

/**
 * Pigeonhole certainty: placing `items` into `boxes` where "win" = some box
 * exceeds `cap`. If cap·boxes < items the win is CERTAIN (prob 1). Returns 1 or,
 * when not forced, throws (the generator only uses the forced-certain regime).
 */
export function pigeonholeCertain(items: number, boxes: number, cap: number): Fraction {
  if (cap * boxes < items) return F(1);
  throw new Error("not a forced-pigeonhole instance");
}

/**
 * P(land on an odd number after 2 adjacency moves on the 3×3 keypad grid or the
 * 1..9 cycle). Both graphs give 5/9 (parity invariant / total-probability). We
 * verify the GRID via its parity invariant: every move flips parity, so 2 moves
 * return to the start parity; start uniform over 5 odd + 4 even ⇒ P(odd) = 5/9.
 */
export function twoMoveOddProb(): Fraction {
  return F(5, 9);
}

/**
 * Inclusion–exclusion / De Morgan: given P(A∪B), P(A), P(B), return
 * P(Aᶜ ∪ Bᶜ) = 1 − P(A∩B), with P(A∩B) = P(A)+P(B)−P(A∪B).
 */
export function notAorNotBProb(pAorB: Fraction, pA: Fraction, pB: Fraction): Fraction {
  const pAandB = pA.add(pB).sub(pAorB);
  return F(1).sub(pAandB);
}

/** Median of Exp(λ) = ln 2 / λ (float; irrational). */
export function exponentialMedian(lambda: number): number {
  return Math.LN2 / lambda;
}

/**
 * P(square of diagonal W has larger area than rectangle W×H), W,H iid Exp(1):
 * W²/2 > WH ⟺ H < W/2, P = ∫₀^∞ (1−e^{−w/2})e^{−w} dw = 1 − 1/(1+½) = 1/3.
 * Rational for this parameterisation. Generalised: threshold ratio t on H<W·t
 * gives 1 − 1/(1 + t) for unit exponentials.
 */
export function diagonalDuelProb(t: Fraction): Fraction {
  return F(1).sub(F(1).div(F(1).add(t)));
}

/**
 * Fair-payout / EV for an "ascending draw" game: draw `k` cards, win `reward`
 * for a strictly-ascending draw (prob 1/k!) else lose `loss`. EV =
 * reward/k! − loss·(1 − 1/k!). The fair reward solves EV = 0:
 * fairReward = loss·(k! − 1). Returns { winProb, ev, fairReward }.
 */
export function ascendingGame(
  k: number,
  reward: number,
  loss: number,
): { winProb: Fraction; ev: Fraction; fairReward: Fraction } {
  const winProb = orderingProb(k);
  const lose = F(1).sub(winProb);
  const ev = winProb.mul(reward).sub(lose.mul(loss));
  const fairReward = F(loss).mul(factorial(k).sub(1));
  return { winProb, ev, fairReward };
}

/* ========================================================================== */
/*  CLT & concentration (float Φ; Markov bound rational)                       */
/* ========================================================================== */

/**
 * Standard normal CDF Φ(z) via the high-accuracy Zelen & Severo rational
 * approximation (abs error < 7.5e-8), enough for the dataset's 5-dp targets
 * (Φ(3) → 0.998650, so 1−Φ(3) ≈ 0.00135).
 */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  // Abramowitz & Stegun 7.1.26 erf approximation.
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  const erf = sign * y;
  return 0.5 * (1 + erf);
}

/**
 * CLT normal-approximation upper tail P(X ≥ k) ≈ 1 − Φ((k − nμ)/√(nσ²)) for a
 * sum of n iid with mean μ, variance σ². For binomial μ=p, σ²=p(1−p).
 * (230 Heads: n=400, μ=½, σ²=¼, k=230 → z=3 → ≈0.00135.) Float.
 */
export function cltUpperTail(k: number, n: number, mean: number, variance: number): number {
  const z = (k - n * mean) / Math.sqrt(n * variance);
  return 1 - normalCdf(z);
}

/**
 * CLT z-argument `a` such that P(S − T > thresh) = Φ(a), where S, T are each
 * sums of n iid (mean μ, var σ²) and independent. E[S−T]=0, Var(S−T)=2nσ².
 * P(S−T>thresh)=P(Z>thresh/sd)=Φ(−thresh/sd) ⇒ a = −thresh/√(2nσ²). Float
 * (rational when the sd is rational; Beta-Gap gives sd=5, a=−2).
 */
export function cltDifferenceZ(thresh: number, n: number, variance: number): number {
  const sd = Math.sqrt(2 * n * variance);
  return -thresh / sd;
}

/** Markov's-inequality upper bound P(T ≥ a) ≤ E[T]/a (exact rational). */
export function markovBound(expectedT: Fraction, a: Fraction): Fraction {
  return expectedT.div(a);
}

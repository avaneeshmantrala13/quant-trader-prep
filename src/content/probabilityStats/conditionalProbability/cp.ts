import Fraction from "fraction.js";

/**
 * Exact solvers for the Probability & Statistics → Conditional Probability
 * subcategory.
 *
 * Conditional Probability is NOT one repeating formula — it is a cluster of
 * solution-method "families": reduced sample space / equally-likely counting,
 * Bayes' theorem, law of total probability, continuous conditioning, competing
 * events / race conditioning, first-step recursion, the Russian-Roulette series,
 * two-child framing paradoxes, and counterintuitive classics (Monty Hall,
 * Bertrand's box). This file is organised by FAMILY, each with an EXACT solver.
 * All arithmetic is exact rational via `fraction.js` (never floats); the three
 * non-scalar specials (Russian Roulette #3/#4 decisions, Child's Gender's two
 * parts, Monty Hall's decision + probability) return structured results, never a
 * forced scalar.
 *
 * NONE of the 45 source-dataset questions are user-facing — they live only in
 * `./conditionalProbability.test.ts` as hidden fixtures (`SEED_ANSWERS`), and
 * this solver is asserted to reproduce them there.
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

/** Binomial coefficient C(n, k) as an exact integer (small n). */
export function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
  return Math.round(c);
}

/* ========================================================================== */
/*  FAMILY — Reduced sample space / equally-likely counting                    */
/*  Method: P(A|B) = #(A∩B)/#B — discard outcomes inconsistent with B.          */
/* ========================================================================== */

/** The defining reduced-sample-space ratio #(A∩B)/#B (exact). */
export function reducedProb(favorable: number, survivors: number): Fraction {
  if (survivors <= 0 || favorable < 0 || favorable > survivors)
    throw new Error("need 0 ≤ favorable ≤ survivors, survivors > 0");
  return F(favorable, survivors);
}

/**
 * Table conditioning: a grid of numbers (rows × cols); pick one cell uniformly,
 * told it exceeds `threshold`; probability it lies in column `targetCol`.
 * = (#target-col cells above)/(#all cells above). Exact.
 */
export function tableAboveThresholdProb(
  grid: number[][],
  threshold: number,
  targetCol: number,
): Fraction {
  let total = 0;
  let favorable = 0;
  for (const row of grid) {
    row.forEach((v, c) => {
      if (v > threshold) {
        total++;
        if (c === targetCol) favorable++;
      }
    });
  }
  return reducedProb(favorable, total);
}

/**
 * n fair coins, told AT LEAST ONE is a tail; probability EXACTLY k are tails.
 * = C(n,k)/(2^n − 1) (the all-heads outcome is excluded from the pool). Exact.
 */
export function exactlyKGivenAtLeastOne(n: number, k: number): Fraction {
  if (n < 1 || k < 1 || k > n) throw new Error("need 1 ≤ k ≤ n");
  return F(comb(n, k), 2 ** n - 1);
}

/**
 * n independent fair items, each ON w.p. ½, told at least one is ON;
 * probability ALL are on = (½)^n / (1 − (½)^n) = 1/(2^n − 1). Exact.
 */
export function allOnGivenAtLeastOne(n: number): Fraction {
  if (n < 1) throw new Error("need n ≥ 1");
  return F(1, 2 ** n - 1);
}

/**
 * Two fair N-sided dice, told the sum is `s`; probability at least one die
 * shows `face`. Reduced sample space over ORDERED pairs (the ordered-vs-
 * unordered distinction is the classic trap). Exact.
 */
export function diceSumFaceProb(N: number, s: number, face: number): Fraction {
  let survivors = 0;
  let favorable = 0;
  for (let a = 1; a <= N; a++)
    for (let b = 1; b <= N; b++)
      if (a + b === s) {
        survivors++;
        if (a === face || b === face) favorable++;
      }
  return reducedProb(favorable, survivors);
}

/**
 * Two fair N-sided dice, told at least one shows face k; probability BOTH show
 * k. Ordered pairs containing a k number 2N−1; only (k,k) has both →
 * 1/(2N − 1) (the Boy-or-Girl / Rolling-Six structure). Exact.
 */
export function bothGivenAtLeastOne(N: number): Fraction {
  if (N < 1) throw new Error("need N ≥ 1");
  return F(1, 2 * N - 1);
}

/**
 * Bertrand's-box: `gAll` two-sided all-green discs and `mixed` green/other
 * discs; a randomly-shown face is green; probability the hidden face is also
 * green. Count FACES not objects: 2·gAll green faces have green backs, `mixed`
 * green faces have non-green backs → 2g/(2g + mixed). Exact.
 */
export function bertrandGreenProb(gAll: number, mixed: number): Fraction {
  if (gAll < 0 || mixed < 0 || gAll + mixed < 1)
    throw new Error("need at least one disc");
  return F(2 * gAll, 2 * gAll + mixed);
}

/**
 * Three i.i.d. continuous draws (dart distances); given draw 2 > draw 1,
 * probability draw 3 > draw 1. Enumerate the 6 equally-likely strict orderings.
 * Exact (→ 2/3 for the classic three-dart case).
 */
export function orderingConditionalProb(): Fraction {
  const perms = [
    [1, 2, 3],
    [1, 3, 2],
    [2, 1, 3],
    [2, 3, 1],
    [3, 1, 2],
    [3, 2, 1],
  ]; // rank (1 = closest) assigned to darts (d1, d2, d3)
  let survivors = 0;
  let favorable = 0;
  for (const [r1, r2, r3] of perms) {
    if (r2 > r1) {
      survivors++;
      if (r3 > r1) favorable++;
    }
  }
  return reducedProb(favorable, survivors);
}

/**
 * Chip-Eleven chain rule: `total` chips (of which `odd` are odd) dealt in equal
 * `hand`-sized hands to players in order; given player A drew ONLY odds, the
 * probability the second player drew a specific odd chip. The chip is in A's
 * uniform `hand`-of-`odd` odd subset w.p. hand/odd (so it survives w.p.
 * 1 − hand/odd); given it survived, `total − hand` chips remain and player B
 * draws `hand` → hand/(total − hand). Product is the answer. Exact.
 */
export function chipChainProb(total: number, odd: number, hand: number): Fraction {
  const survives = F(1).sub(F(hand, odd));
  const taken = F(hand, total - hand);
  return survives.mul(taken);
}

/* ========================================================================== */
/*  FAMILY — Bayes' theorem                                                     */
/*  Method: P(H|E) = P(E|H)P(H) / Σ P(E|Hⱼ)P(Hⱼ). Prior × likelihood, normed.   */
/* ========================================================================== */

/**
 * General Bayes posterior over hypotheses: given parallel `priors` and
 * `likelihoods` (P(E|Hⱼ)), the posterior P(H_i | E). Exact rational. Covers
 * die-identity, coin-source, headliner, gumballs, pouches, painted-cube, and
 * ratio-only-likelihood problems (`likelihoods` may be unnormalised ratios).
 */
export function bayesPosterior(
  priors: Fraction[],
  likelihoods: Fraction[],
  i: number,
): Fraction {
  if (priors.length !== likelihoods.length) throw new Error("length mismatch");
  const joints = priors.map((p, j) => p.mul(likelihoods[j]));
  const norm = joints.reduce((a, b) => a.add(b), F(0));
  if (norm.valueOf() === 0) throw new Error("evidence has zero probability");
  return joints[i].div(norm);
}

/**
 * Bayes by inversion: P(A|B) = P(B|A)·P(A)/P(B). The disease/alcoholic style,
 * where P(A), P(B) and one direction P(B|A) are given directly. Exact.
 */
export function bayesInversion(pA: Fraction, pB: Fraction, pBgivenA: Fraction): Fraction {
  return pBgivenA.mul(pA).div(pB);
}

/**
 * Two independent failure causes (engine w.p. pE, wheels w.p. pW); given a
 * breakdown (either cause), probability the wheels are at fault:
 * pW / (pE + pW − pE·pW) since P(break) = P(E∪W) and P(break|W) = 1. Exact.
 */
export function bayesUnionCause(pE: Fraction, pW: Fraction): Fraction {
  const pBreak = pE.add(pW).sub(pE.mul(pW));
  return pW.div(pBreak);
}

/**
 * Posterior-weighted prediction: coins with head-probs `probs`, pick one at
 * random, observe a head; probability the NEXT flip (same coin) is also heads.
 * = E[p²]/E[p] = (Σ pⱼ²)/(Σ pⱼ) (equal priors cancel). Exact.
 */
export function posteriorWeightedNextSuccess(probs: Fraction[]): Fraction {
  const num = probs.reduce((a, p) => a.add(p.pow(2)), F(0));
  const den = probs.reduce((a, p) => a.add(p), F(0));
  return num.div(den);
}

/* ========================================================================== */
/*  FAMILY — Law of total probability                                          */
/*  Method: P(A) = Σ P(A|Bᵢ)P(Bᵢ) — condition on an intermediate scenario.      */
/* ========================================================================== */

/** Σ P(Bᵢ)·P(A|Bᵢ) over parallel weights and conditional probabilities. Exact. */
export function lawTotalProb(weights: Fraction[], conds: Fraction[]): Fraction {
  if (weights.length !== conds.length) throw new Error("length mismatch");
  return weights.reduce((a, w, i) => a.add(w.mul(conds[i])), F(0));
}

/* ========================================================================== */
/*  FAMILY — Continuous conditioning (uniform, NOT memoryless)                 */
/* ========================================================================== */

/**
 * X ~ Uniform(a, b); given X > `given`, probability X ≤ `target`
 * (given ≤ target ≤ b). Given the survival, X is uniform on (given, b), so the
 * answer is (target − given)/(b − given). Exact. (Uniform is NOT memoryless.)
 */
export function uniformConditional(
  a: number,
  b: number,
  given: number,
  target: number,
): Fraction {
  if (!(a <= given && given <= target && target <= b))
    throw new Error("need a ≤ given ≤ target ≤ b");
  return F(target - given, b - given);
}

/* ========================================================================== */
/*  FAMILY — Competing events / race conditioning & first-step recursion       */
/* ========================================================================== */

/**
 * Race between two events: ignoring trials where neither occurs, the winner's
 * probability is its share of the deciding trials, waysA/(waysA + waysB).
 * (Six-before-Eleven: ordered ways 5 vs 2 → 5/7; the unordered count is the
 * trap.) Exact.
 */
export function raceProb(waysA: number, waysB: number): Fraction {
  if (waysA + waysB <= 0) throw new Error("need at least one deciding way");
  return F(waysA, waysA + waysB);
}

/**
 * Alternating geometric race (Alice then Bob, first success wins), per-toss
 * success probability p. Given the SECOND mover (Bob) won, probability he won on
 * his FIRST toss. P(Bob wins on toss 1) = q·p; P(Bob wins) = qp/(1 − q²); ratio
 * = 1 − q², where q = 1 − p. Exact (→ 3/4 for a fair coin).
 */
export function secondMoverFirstTossGivenWin(p: Fraction): Fraction {
  const q = F(1).sub(p);
  return F(1).sub(q.pow(2));
}

/**
 * Two players roll a fair d`N` in turn; on a tie the SECOND-listed player wins,
 * a strict lead for the second player has the first player win, and a strict
 * lead for the first player forces a re-roll. Probability the tie-favoured
 * player wins = ties/(ties + secondHigher) among decisive outcomes. For a d8:
 * 8/(8+28) = 2/9. Exact.
 */
export function tieBreakerProb(N: number): Fraction {
  const ties = N;
  const decisiveAgainst = (N * N - N) / 2; // one player strictly higher
  return raceProb(ties, decisiveAgainst);
}

/**
 * First-step recursion on a repeating state with an absorbing win: from the
 * live state a player wins immediately w.p. `pWin`, loses w.p. `pLose`, or the
 * state repeats w.p. `pRepeat` (pWin + pLose + pRepeat = 1). Solving
 * p = pWin + pRepeat·p gives p = pWin/(1 − pRepeat). (Parity Race: pWin = ½,
 * pRepeat = ¼ → 2/3.) Exact.
 */
export function absorbingFirstStep(pWin: Fraction, pRepeat: Fraction): Fraction {
  return pWin.div(F(1).sub(pRepeat));
}

/**
 * Coin-Toss #1: players A, B toss a fair coin in turn (A first); the game ends
 * when a Head is followed by a Tail (HT) and the tail-tosser wins. Probability
 * the FIRST player (A) wins. Solved via the exact two-state recursion:
 *   P(A|H) = ½·0 + ½·(1 − P(A|H))  ⇒ P(A|H) = 1/3,
 *   P(A)   = ½·P(A|H) + ½·(1 − P(A)) ⇒ P(A) = 4/9.
 * Returned as an exact rational (independent of any float).
 */
export function htTailWinnerFirstPlayer(): Fraction {
  const pAgivenH = F(1, 3); // fixed point of x = ½(1 − x)
  // P(A) = ½·P(A|H) + ½·(1 − P(A))  ⇒  (3/2)P(A) = ½·P(A|H) + ½
  const rhs = F(1, 2).mul(pAgivenH).add(F(1, 2));
  return rhs.div(F(3, 2));
}

/* ========================================================================== */
/*  FAMILY — Russian-Roulette series                                           */
/*  Fixed cylinder → positions dependent; re-spun → memoryless; two-bullet      */
/*  variants condition on survival. #3/#4 return DECISIONS, never scalars.      */
/* ========================================================================== */

/**
 * One bullet in a `chambers`-chamber cylinder, spun ONCE (fixed), two players
 * alternate with no re-spin. Probability the FIRST player survives = (# chambers
 * the second player would fire)/chambers = ⌊chambers/2⌋/chambers → ½ for even
 * chambers. Exact.
 */
export function rrFixedFirstSurvives(chambers: number): Fraction {
  if (chambers < 2) throw new Error("need ≥ 2 chambers");
  return F(Math.floor(chambers / 2), chambers);
}

/**
 * One bullet, cylinder RE-SPUN before every pull (memoryless), two players
 * alternate. Probability the second player survives (the safer player):
 * P(P1 eventually shot) = p + (1−p)²·P(P1 shot) ⇒ P(P1 shot) = 1/(2 − p), and
 * P2 survives iff P1 is the one shot, i.e. with probability 1/(2 − p). For
 * p = 1/6 → 6/11. Exact.
 */
export function rrRespunSecondSurvives(p: Fraction): Fraction {
  return F(1).div(F(2).sub(p));
}

/**
 * Two bullets placed at RANDOM in `chambers` chambers; the first player
 * survived; should the second player spin? Spin → P(lose) = bullets/chambers;
 * no spin → the bullets are among the other chambers → bullets/(chambers − 1).
 * Since no-spin loss is larger, spinning is better. Returns both probabilities
 * and the decision (never a bare scalar).
 */
export function rrTwoRandomDecision(
  chambers: number,
  bullets: number,
): { spinLose: Fraction; noSpinLose: Fraction; shouldSpin: boolean } {
  const spinLose = F(bullets, chambers);
  const noSpinLose = F(bullets, chambers - 1);
  return { spinLose, noSpinLose, shouldSpin: spinLose.valueOf() < noSpinLose.valueOf() };
}

/**
 * Two bullets in CONSECUTIVE chambers of a `chambers`-chamber cylinder; the
 * first player survived; should the second player spin? No spin: given survival
 * the hammer sits on one of the `chambers − 2` empty chambers, and exactly one
 * of them is immediately followed by the bullet block → P(survive) =
 * (empty − 1)/empty. Spin: P(survive) = (chambers − 2)/chambers. Since the
 * no-spin survival is larger, do NOT spin. Returns both survival probabilities
 * and the decision.
 */
export function rrTwoConsecutiveDecision(
  chambers: number,
): { spinSurvive: Fraction; noSpinSurvive: Fraction; shouldSpin: boolean } {
  const empty = chambers - 2;
  const noSpinSurvive = F(empty - 1, empty);
  const spinSurvive = F(empty, chambers);
  return {
    spinSurvive,
    noSpinSurvive,
    shouldSpin: spinSurvive.valueOf() > noSpinSurvive.valueOf(),
  };
}

/* ========================================================================== */
/*  FAMILY — Two-child / framing paradoxes                                     */
/* ========================================================================== */

/**
 * Two children, told AT LEAST ONE is a boy; probability BOTH are boys.
 * P(bb)/P(≥1 boy) = (1/4)/(3/4) = 1/3. Exact. (Contrast: OBSERVING one specific
 * child to be a boy leaves the other independent → 1/2, `specificChildBothProb`.)
 */
export function atLeastOneBoyBothBoys(): Fraction {
  return F(1, 3);
}

/**
 * Two children, you OBSERVE one specific child's sex; probability the OTHER
 * matches. Seeing one specific child fixes it and leaves the other independent
 * → 1/2. Exact. This is the "different conditioning" counterpart to
 * `atLeastOneBoyBothBoys` (the whole point of the Child's-Gender paradox).
 */
export function specificChildBothProb(): Fraction {
  return F(1, 2);
}

/* ========================================================================== */
/*  FAMILY — Multi-stage conditional (Vacant Room)                             */
/* ========================================================================== */

/**
 * Sign-user model: a fraction `bothWays` always flips the sign both ways, some
 * fraction ignores it, and the rest flip on entry but forget on exit; the room
 * is occupied a fraction `pOccupied` of the time. Given the sign reads "Vacant",
 * probability the room is truly vacant. The both-ways ratio cancels between the
 * two "Vacant"-producing worlds, leaving pVacant/(pVacant + pOccupied·ignore),
 * where pVacant = 1 − pOccupied. (½, ¼ ignore → 4/5.) Exact.
 */
export function vacantRoomProb(pOccupied: Fraction, ignore: Fraction): Fraction {
  const pVacant = F(1).sub(pOccupied);
  return pVacant.div(pVacant.add(pOccupied.mul(ignore)));
}

/* ========================================================================== */
/*  FAMILY — Counterintuitive classics (Monty Hall)                            */
/* ========================================================================== */

/**
 * Monty Hall with `doors` doors, one prize: you pick one, the host opens a
 * losing door and offers a switch. Switching wins iff your first pick was wrong
 * → (doors − 1)/doors for the standard single-open game (→ 2/3 for 3 doors).
 * The decision is "switch"; the trap answer is ½ (ignoring the host's info).
 * Exact.
 */
export function montyHallSwitchProb(doors: number): Fraction {
  if (doors < 3) throw new Error("need ≥ 3 doors");
  return F(doors - 1, doors);
}

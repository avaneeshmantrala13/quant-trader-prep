import type { Rng } from "@/lib/rng";
import type { NumericQuestion } from "@/types/content";
import { F, chooseBig, decText, fracText, numDp, powBig } from "./combinatorics";
import { numericErrors } from "./_shared";
import {
  binomTailGE,
  binomTailLE,
  coinRaceHeadsWinProb,
  latticeMeetingProb,
  returnToOriginProb,
  stepSequencesCount,
} from "./solvers";

/**
 * Parametric numeric generators for the Probability & Statistics →
 * **Combinatorial Analysis** subcategory, FAMILY 4 (binomial coin/dice sequence
 * counting: fair-coin tail probabilities, symmetric ±1 walks, lattice meetings,
 * and fair-flip race conditioning).
 *
 * Every ground-truth answer comes straight from the EXACT solvers in
 * `./solvers.ts` (`binomTailLE`, `binomTailGE`, `returnToOriginProb`,
 * `stepSequencesCount`, `latticeMeetingProb`, `coinRaceHeadsWinProb`), the
 * generators never recompute a probability or count by hand. Each distractor
 * (`numeric` commonErrors) is a re-derived, NAMED misconception, guaranteed
 * finite, positive, and ≠ the answer at the grading precision (`numericErrors`
 * dedupes, drops non-finite/negative values, and never re-emits the answer).
 *
 * All items are freshly themed with objects and stories that do NOT appear in
 * the source dataset (no "Coin Race", "Flipping a Coin", "Max Three Tails",
 * "More Tails", "Stock Price", "Unit Steps", or "Meeting Your Friend").
 */

const SOURCE = "Combinatorial Analysis · Binomial coin/dice counting";
const HALF = () => F(1, 2);

/* ========================================================================== */
/* =================  1. AT MOST k TAILS (lower binomial tail)  ========== */
/* ========================================================================== */

const ATMOST_THEME = [
  { obj: "fair tokens", side: "blank side", event: "flipped onto a tray" },
  { obj: "balanced discs", side: "shaded face", event: "tossed together" },
  { obj: "two-sided chips", side: "marked face", event: "spun at once" },
];

/**
 * P(at most `k` tails) when `n` fair coins are flipped, via `binomTailLE`:
 * Σ_{j≤k} C(n,j)/2ⁿ. Distractors: the OPPOSITE tail P(≥ k+1) = 1 − value, an
 * off-by-one boundary P(≤ k−1), and the single central term P(X = k).
 */
export function genBinomAtMost(rng: Rng): NumericQuestion {
  const th = rng.pick(ATMOST_THEME);
  const n = rng.pick([5, 6, 7, 8]);
  const k = Math.floor(n / 2) - 1; // "around n/2", chosen to keep traps distinct

  const value = binomTailLE(n, HALF(), k);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const oppositeTail = binomTailGE(n, HALF(), k + 1); // 1 − value
  const offByOne = binomTailLE(n, HALF(), k - 1); // P(≤ k−1)
  const singleTerm = F(chooseBig(n, k), powBig(2, n)); // P(X = k)

  const { errors, push } = numericErrors(answer, dp);
  push(
    oppositeTail,
    `${fracText(oppositeTail)} is P(at least ${k + 1} tails) = 1 − P(at most ${k}); that's the OPPOSITE tail, not the "at most ${k}" event.`,
  );
  push(
    offByOne,
    `P(at most ${k - 1} tails) = ${fracText(offByOne)} drops the boundary term C(${n},${k})/2^${n} = ${fracText(singleTerm)}; "at most ${k}" INCLUDES exactly ${k}.`,
  );
  push(
    singleTerm,
    `C(${n},${k})/2^${n} = ${fracText(singleTerm)} is just P(exactly ${k} tails); "at most ${k}" sums every j from 0 to ${k}.`,
  );

  const prompt =
    `A set of ${n} ${th.obj} are ${th.event}; each independently shows its ${th.side} ("tails") with probability 1/2. ` +
    `What is the probability that at most ${k} of the ${n} land tails? (Round to ${dp} decimals.)`;
  const explanation =
    `X, the number of tails, is Binomial(${n}, 1/2), so P(X ≤ ${k}) = Σ_{j=0}^{${k}} C(${n},j)/2^${n}. ` +
    `Summing the exact terms gives ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `Note the single term P(X = ${k}) = C(${n},${k})/2^${n} = ${fracText(singleTerm)} is only the last slice of this sum.`;

  return {
    id: `gen-binomatmost-${n}-${k}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "medium",
    concept: "Binomial lower tail (at most k tails)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SOURCE,
  };
}

/* ========================================================================== */
/* =================  2. MORE TAILS THAN HEADS (upper tail)  ============= */
/* ========================================================================== */

const MORETAILS_THEME = [
  { obj: "fair counters", verb: "shaken out of a cup" },
  { obj: "balanced medallions", verb: "dropped on a table" },
  { obj: "even-weighted slugs", verb: "flicked into the air" },
];

/**
 * P(strictly more tails than heads) with `n` (even) fair coins, via `binomTailGE`
 * at k = n/2 + 1: Σ_{j≥n/2+1} C(n,j)/2ⁿ. Distractors: INCLUDING the tie
 * P(≥ n/2), the naive 1/2 (symmetry that ignores the possible tie), and the tie
 * probability P(X = n/2) itself.
 */
export function genMoreTails(rng: Rng): NumericQuestion {
  const th = rng.pick(MORETAILS_THEME);
  // n ≠ 6: 6 coins "more tails" is the source's 22/64 tuple (More Tails).
  const n = rng.pick([8, 10, 12]);
  const half = n / 2;

  const value = binomTailGE(n, HALF(), half + 1);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const withTie = binomTailGE(n, HALF(), half); // P(≥ n/2), counts the tie
  const naiveHalf = F(1, 2);
  const tieProb = F(chooseBig(n, half), powBig(2, n)); // P(X = n/2)

  const { errors, push } = numericErrors(answer, dp);
  push(
    withTie,
    `P(at least ${half} tails) = ${fracText(withTie)} counts the ${half}-${half} TIE as "more tails"; strictly more needs at least ${half + 1}.`,
  );
  push(
    naiveHalf,
    `1/2 assumes tails-beat-heads and heads-beat-tails are the only outcomes; the tie P(X = ${half}) = ${fracText(tieProb)} has positive mass, so each side is below 1/2.`,
  );
  push(
    tieProb,
    `C(${n},${half})/2^${n} = ${fracText(tieProb)} is the probability of an exact ${half}-${half} TIE, not of strictly more tails.`,
  );

  const prompt =
    `${n} ${th.obj} are ${th.verb}, each landing heads or tails with probability 1/2 independently. ` +
    `What is the probability of strictly more tails than heads? (Round to ${dp} decimals.)`;
  const explanation =
    `With X ~ Binomial(${n}, 1/2), "more tails than heads" means X ≥ ${half + 1}, so P = Σ_{j=${half + 1}}^{${n}} C(${n},j)/2^${n} = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `The ${half}-${half} tie carries mass P(X = ${half}) = ${fracText(tieProb)}, which is why the answer is below 1/2 rather than equal to it.`;

  return {
    id: `gen-moretails-${n}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "medium",
    concept: "Binomial upper tail (strictly more tails)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SOURCE,
  };
}

/* ========================================================================== */
/* =================  3. RETURN TO START (symmetric ±1 walk)  ============ */
/* ========================================================================== */

const RETURN_THEME = [
  { mover: "a marker", track: "a number line", step: "left or right one unit" },
  { mover: "a hovering drone", track: "a straight rail", step: "forward or back one notch" },
  { mover: "an asset's tick", track: "its price ladder", step: "up or down one increment" },
];

/**
 * P(a symmetric ±1 walk of `steps` (even) fair moves ends back at the start),
 * via `returnToOriginProb`: C(steps, steps/2)/2^steps. Distractors: using the
 * wrong denominator 2^{steps−1} (double the value), the naive 1/2, and treating
 * the walk as steps/2 independent "returns" (1/2)^{steps/2}.
 */
export function genReturnOrigin(rng: Rng): NumericQuestion {
  const th = rng.pick(RETURN_THEME);
  // steps ≠ 10: a 10-step return is the source's 0.246 tuple (Stock Price Coin Flip).
  const steps = rng.pick([6, 8, 12, 14]);
  const half = steps / 2;

  const value = returnToOriginProb(steps);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const wrongDenom = F(chooseBig(steps, half), powBig(2, steps - 1)); // 2^{steps−1}
  const naiveHalf = F(1, 2);
  const naivePairs = F(1, powBig(2, half)); // (1/2)^{steps/2}

  const { errors, push } = numericErrors(answer, dp);
  push(
    wrongDenom,
    `C(${steps},${half})/2^${steps - 1} = ${fracText(wrongDenom)} uses 2^{steps−1} paths; there are 2^${steps} equally-likely ±1 sequences, not 2^${steps - 1}.`,
  );
  push(
    naiveHalf,
    `1/2 is a naive symmetry guess; ending exactly at the start needs precisely ${half} of the ${steps} moves in each direction, which is far more restrictive.`,
  );
  push(
    naivePairs,
    `(1/2)^{${half}} = ${fracText(naivePairs)} pretends the walk is ${half} independent "return" trials; the moves aren't paired that way, count C(${steps},${half}) balanced sequences instead.`,
  );

  const prompt =
    `${th.mover} starts at 0 on ${th.track} and takes ${steps} independent fair steps, each ${th.step} with probability 1/2. ` +
    `What is the probability it is back at 0 after all ${steps} steps? (Round to ${dp} decimals.)`;
  const explanation =
    `Returning to 0 after ${steps} steps requires exactly ${half} moves each way, so the count of balanced sequences is C(${steps},${half}) and P = C(${steps},${half})/2^${steps} = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `The denominator is the full 2^${steps} equally-likely step sequences, not 2^${steps - 1}.`;

  return {
    id: `gen-returnorigin-${steps}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "medium",
    concept: "Symmetric ±1 walk (return-to-origin probability)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SOURCE,
  };
}

/* ========================================================================== */
/* =================  4. STEP-SEQUENCE COUNT (integer count)  ============ */
/* ========================================================================== */

const STEPCOUNT_THEME = [
  { mover: "a courier", track: "a number line", step: "a left or right unit hop" },
  { mover: "a game piece", track: "a linear board", step: "one square back or forward" },
  { mover: "a cursor", track: "an index track", step: "a −1 or +1 jump" },
];

/**
 * COUNT of distinct ±1 step SEQUENCES of `steps` moves that end at displacement
 * `end`, via `stepSequencesCount`: with r = (steps+end)/2 right-moves, C(steps, r).
 * Integer answer (no decimals). Distractors (dp = 0): off-by-one right-move
 * miscounts C(steps, r+1) = sequences ending at end+2 and C(steps, r−1) =
 * sequences ending at end−2, plus the total 2^steps ignoring the endpoint.
 */
export function genStepCount(rng: Rng): NumericQuestion {
  const th = rng.pick(STEPCOUNT_THEME);
  const steps = rng.pick([8, 10, 12, 14]);
  let end = rng.pick([0, 2, 4]); // (steps + end) always even here
  // Avoid the source tuple (12 steps, end +2 → C(12,7) = 792, Unit Steps).
  if (steps === 12 && end === 2) end = rng.pick([0, 4]);
  const right = (steps + end) / 2;

  const value = stepSequencesCount(steps, end); // bigint
  const answer = Number(value); // < 1e8 for these params

  const endPlus = stepSequencesCount(steps, end + 2); // C(steps, r+1)
  const endMinus = stepSequencesCount(steps, end - 2); // C(steps, r−1)
  const allPaths = powBig(2, steps); // 2^steps

  const { errors, push } = numericErrors(answer, 0);
  push(
    Number(endPlus),
    `${endPlus} = C(${steps},${right + 1}) uses one too MANY right-steps; that lands at displacement ${end + 2}, not ${end}.`,
  );
  push(
    Number(endMinus),
    `${endMinus} = C(${steps},${right - 1}) uses one too FEW right-steps; that lands at displacement ${end - 2}, not ${end}.`,
  );
  push(
    Number(allPaths),
    `2^${steps} = ${allPaths} counts EVERY ±1 sequence of ${steps} moves, ignoring the required final displacement of ${end}.`,
  );

  const prompt =
    `${th.mover} on ${th.track} makes ${steps} moves, each ${th.step}. ` +
    `How many distinct move sequences leave it exactly ${end} unit${end === 1 ? "" : "s"} to the right of where it started? (Whole number.)`;
  const explanation =
    `To finish at displacement ${end} after ${steps} moves you need r = (${steps}+${end})/2 = ${right} right-moves (the rest left), and the number of orderings is C(${steps},${right}) = ${value}. ` +
    `So exactly ${answer} sequences end ${end} to the right, one C(${steps},·) choice of which moves are the rights.`;

  return {
    id: `gen-stepcount-${steps}-${end}`,
    prompt,
    answer,
    difficulty: "medium",
    concept: "±1 walk path counting (sequences to a displacement)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SOURCE,
  };
}

/* ========================================================================== */
/* =================  5. TWO WALKERS MEET ON A GRID  ===================== */
/* ========================================================================== */

const LATTICE_THEME = [
  { agents: "two couriers", grid: "warehouse", corner: "opposite corners" },
  { agents: "two rovers", grid: "plaza", corner: "diagonally opposite corners" },
  { agents: "two drones", grid: "loading yard", corner: "corners across the diagonal" },
];

/**
 * P(two walkers taking shortest opposite-corner routes on an `n`×`n` grid, each
 * step decided by a fair coin, occupy the same lattice point at the crossing
 * diagonal) via `latticeMeetingProb`: Σ_i C(n,i)²/4ⁿ = C(2n,n)/4ⁿ. Distractors:
 * the naive 1/(n+1), forgetting to SQUARE the per-point probability's collapse to
 * (1/2)^n, and 1/(2n+1).
 */
export function genLatticeMeeting(rng: Rng): NumericQuestion {
  const th = rng.pick(LATTICE_THEME);
  // n ≠ 4: a 4×4 meeting is the source's 70/256 tuple (Meeting Your Friend).
  const n = rng.pick([3, 5, 6]);

  const value = latticeMeetingProb(n);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const naiveInv = F(1, n + 1); // 1/(n+1)
  const halfPow = F(1, powBig(2, n)); // (1/2)^n
  const oddInv = F(1, 2 * n + 1); // 1/(2n+1)

  const { errors, push } = numericErrors(answer, dp);
  push(
    naiveInv,
    `1/(n+1) = ${fracText(naiveInv)} guesses the ${n + 1} anti-diagonal meeting points are equally likely; they aren't, point i has probability C(${n},i)/2^${n}.`,
  );
  push(
    halfPow,
    `(1/2)^${n} = ${fracText(halfPow)} keeps only one walker's spread and skips SQUARING/summing; P(meet) = Σ_i (C(${n},i)/2^${n})² = C(${2 * n},${n})/4^${n}.`,
  );
  push(
    oddInv,
    `1/(2n+1) = ${fracText(oddInv)} spreads the meeting over 2n+1 = ${2 * n + 1} bins uniformly, again ignoring the binomial weighting of each point.`,
  );

  const prompt =
    `${th.agents} start at ${th.corner} of an ${n}×${n} block ${th.grid} and each walk a shortest route to the other's corner, choosing each unit step by an independent fair coin. ` +
    `What is the probability they are at the same lattice point when they cross the middle diagonal? (Round to ${dp} decimals.)`;
  const explanation =
    `Each walker reaches anti-diagonal point i with probability C(${n},i)/2^${n}, so P(meet) = Σ_{i=0}^{${n}} (C(${n},i)/2^${n})² = C(${2 * n},${n})/4^${n} by Vandermonde. ` +
    `That equals ${fracText(value)} ≈ ${decText(value, dp)}, the per-point probabilities must be squared and summed, not treated as uniform.`;

  return {
    id: `gen-latticemeet-${n}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "medium",
    concept: "Lattice-path meeting probability (C(2n,n)/4ⁿ)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SOURCE,
  };
}

/* ========================================================================== */
/* =================  6. RACE WITH A HEAD-START (tail conditioning)  ===== */
/* ========================================================================== */

const RACE_THEME = [
  { a: "Ada", b: "Bo", contest: "point-per-flip match" },
  { a: "Mira", b: "Nel", contest: "flip-scored duel" },
  { a: "Rex", b: "Sol", contest: "coin-toss showdown" },
];

/**
 * P(the heads side still wins a `totalFlips`-flip fair-coin match after the very
 * first flip already scored for tails), via `coinRaceHeadsWinProb`: the heads
 * side wins iff the remaining `totalFlips−1` flips yield at most
 * `targetTailsToLose` more tails, i.e. binomTailLE(totalFlips−1, 1/2,
 * targetTailsToLose). Distractors: an off-by-one boundary (≤ one fewer tail),
 * the naive 1/2, and the complement P(tails side wins).
 */
export function genRaceCondition(rng: Rng): NumericQuestion {
  const th = rng.pick(RACE_THEME);
  // totalFlips ≠ 10: a 10-flip race is the source's 0.254 tuple (Coin Race #2).
  const totalFlips = rng.pick([8, 12, 14]);
  const targetTailsToLose = totalFlips / 2 - 2; // matches "loses unless ≤ that many"
  const rem = totalFlips - 1;

  const value = coinRaceHeadsWinProb(totalFlips, targetTailsToLose);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const offByOne = coinRaceHeadsWinProb(totalFlips, targetTailsToLose - 1); // ≤ one fewer
  const naiveHalf = F(1, 2);
  const complement = F(1).sub(value); // P(tails side wins)

  const { errors, push } = numericErrors(answer, dp);
  push(
    offByOne,
    `Requiring at most ${targetTailsToLose - 1} more tails gives ${fracText(offByOne)}; the boundary is ≤ ${targetTailsToLose}, so exactly ${targetTailsToLose} more tails must still count as a win.`,
  );
  push(
    naiveHalf,
    `1/2 ignores the tails head-start; after the opening tails the flips are symmetric but the winning THRESHOLD is skewed, so the answer isn't 1/2.`,
  );
  push(
    complement,
    `${fracText(complement)} = 1 − ${fracText(value)} is P(the TAILS side wins), the complement of what's asked.`,
  );

  const prompt =
    `In a ${th.contest} decided by ${totalFlips} fair flips, each heads scores for ${th.a} and each tails for ${th.b}. ` +
    `The opening flip has already come up tails (a point for ${th.b}). ${th.a} is declared the winner as long as ${th.b} picks up at most ${targetTailsToLose} more points across the remaining ${rem} flips. ` +
    `What is the probability that ${th.a} wins? (Round to ${dp} decimals.)`;
  const explanation =
    `Ignore the settled first flip: the number of additional tails Y over the remaining ${rem} flips is Binomial(${rem}, 1/2), and ${th.a} wins iff Y ≤ ${targetTailsToLose}. ` +
    `So P = Σ_{j=0}^{${targetTailsToLose}} C(${rem},j)/2^${rem} = ${fracText(value)} ≈ ${decText(value, dp)}, and P(${th.b} wins) is the complement ${fracText(complement)}.`;

  return {
    id: `gen-racecondition-${totalFlips}-${targetTailsToLose}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "medium",
    concept: "Fair-flip race conditioning (binomial tail after a head-start)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SOURCE,
  };
}

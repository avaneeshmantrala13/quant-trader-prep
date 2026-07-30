import type { Rng } from "@/lib/rng";
import type { NumericQuestion } from "@/types/content";
import type FractionType from "fraction.js";
import {
  F,
  choose,
  chooseBig,
  decText,
  fracText,
  numDp,
  powBig,
} from "./combinatorics";
import { numericErrors } from "./_shared";
import {
  atLeastKOfAKindProb,
  diceSumEqualsProb,
  expectedPairsDealt,
  strictlyIncreasingProb,
  subsetSumsToProb,
  topTwoMaxProb,
} from "./solvers";

/**
 * Parametric numeric generators for the Probability & Statistics →
 * **Combinatorial Analysis** subcategory, FAMILY 5 (dice sums & orderings: stars
 * & bars capped by inclusion–exclusion, occupancy DP, subset-sum enumeration,
 * strictly-increasing orderings, and linearity-of-expectation pair counts).
 *
 * Every ground-truth answer comes straight from the EXACT solvers in
 * `./solvers.ts` (`diceSumEqualsProb`, `topTwoMaxProb`, `atLeastKOfAKindProb`,
 * `subsetSumsToProb`, `strictlyIncreasingProb`, `expectedPairsDealt`) — the
 * generators never recompute the answer by hand. Each distractor
 * (`numeric` commonErrors) is a re-derived, NAMED misconception, kept finite,
 * positive, and ≠ the answer at the grading precision (`numericErrors` dedupes,
 * drops non-finite/negative values, and never re-emits the answer).
 *
 * All items are freshly themed with objects and stories that do NOT appear in
 * the source dataset.
 */

const SRC = "Combinatorial Analysis · Dice sums (stars & bars + inclusion–exclusion)";

/* ========================================================================== */
/* =================  1 — EXACT SUM OF SEVERAL DICE (numeric)  ============= */
/* ========================================================================== */

const SUM_THEME = [
  { actor: "a tabletop gamer", die: "polyhedral dice", verb: "rolls" },
  { actor: "a casino tester", die: "fair cubes", verb: "tosses" },
  { actor: "a board-game bot", die: "number dice", verb: "throws" },
];

/**
 * P(the sum of `dice` d-`faces` dice equals `target`) via `diceSumEqualsProb`,
 * picking a HIGH target where the ≤faces cap actually bites (so naive stars &
 * bars overcounts). Distractors: the UNCAPPED stars-&-bars ratio
 * C(target−1,dice−1)/faces^dice (forgot every die is ≤ faces), a target±1 shift,
 * and the "every attainable total is equally likely" ordered-vs-count slip
 * 1/(dice·(faces−1)+1).
 */
export function genDiceSumTarget(rng: Rng): NumericQuestion {
  const th = rng.pick(SUM_THEME);
  const faces = 6;
  const dice = rng.pick([3, 4]);
  const target = dice === 4 ? rng.pick([16, 18, 19]) : rng.pick([13, 14, 15]);

  const value = diceSumEqualsProb(dice, faces, target);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  // (a) UNCAPPED stars & bars: positive-integer solutions C(target−1,dice−1)
  //     over faces^dice — ignores the ≤faces cap, so it overcounts.
  const uncapped = F(chooseBig(target - 1, dice - 1).toString()).div(
    F(powBig(faces, dice).toString()),
  );
  // (b) target shifted by one.
  const shifted = diceSumEqualsProb(dice, faces, target - 1);
  // (c) "all totals equally likely" — 1 over the number of attainable sums.
  const supportSize = dice * (faces - 1) + 1;
  const equalLikely = F(1, supportSize);

  const { errors, push } = numericErrors(answer, dp);
  push(
    uncapped,
    `C(${target - 1},${dice - 1})/${faces}^${dice} = ${fracText(uncapped)} is the UNCAPPED stars-&-bars count. It ignores that each die is ≤ ${faces}, so it counts impossible compositions (e.g. a die showing 7+) and overcounts.`,
  );
  push(
    shifted,
    `${fracText(shifted)} = P(sum = ${target - 1}), an off-by-one on the target. The face-cap inclusion–exclusion count is specific to a total of exactly ${target}.`,
  );
  push(
    equalLikely,
    `1/(dice·(faces−1)+1) = 1/${supportSize} = ${fracText(equalLikely)} treats every attainable total ${dice}…${dice * faces} as equally likely; you must count the ORDERED dice outcomes over ${faces}^${dice}, which peak near the mean.`,
  );

  const prompt =
    `${th.actor} ${th.verb} ${dice} fair ${faces}-sided ${th.die} and adds the faces. ` +
    `What is the probability that the total is exactly ${target}? (Round to ${dp} decimals.)`;
  const explanation =
    `Count ordered rolls of ${dice} d${faces} summing to ${target}. Stars & bars would give C(${target - 1},${dice - 1}) = ${chooseBig(target - 1, dice - 1).toString()} compositions, but each die is capped at ${faces}, so inclusion–exclusion removes the over-the-cap cases. ` +
    `The exact favorable count over ${faces}^${dice} = ${powBig(faces, dice).toString()} gives P = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `The uncapped guess ${fracText(uncapped)} is far too large.`;

  return {
    id: `ca-dicesum-${dice}d${faces}-t${target}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "hard",
    concept: "Dice sum = target (capped stars & bars)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SRC,
  };
}

/* ========================================================================== */
/* =================  2 — TOP TWO DICE HIT THE MAX (numeric)  ============== */
/* ========================================================================== */

const TOPTWO_THEME = [
  { actor: "a dungeon master", die: "dice" },
  { actor: "an arcade cabinet", die: "spinners" },
  { actor: "a dice-tower rig", die: "cubes" },
];

/**
 * P(the two highest of `dice` d-`faces` dice sum to the maximum 2·faces) —
 * equivalently at least two dice show `faces` — via `topTwoMaxProb`
 * (P(X ≥ 2), X ~ Bin(dice, 1/faces)). Distractors: EXACTLY two maxes
 * C(dice,2)(1/faces)²((faces−1)/faces)^{dice−2} (drops the ≥3 tail), P(at least
 * one max) 1−((faces−1)/faces)^dice, and (1/faces)² (both a specified pair fixed).
 */
export function genTopTwoSum(rng: Rng): NumericQuestion {
  const th = rng.pick(TOPTWO_THEME);
  const faces = 6;
  const dice = rng.pick([3, 4, 5]);
  const maxSum = 2 * faces;

  const value = topTwoMaxProb(dice, faces);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  // (a) EXACTLY two maxes: C(dice,2)(1/faces)²((faces−1)/faces)^{dice−2}.
  const exactlyTwo = F(chooseBig(dice, 2).toString())
    .mul(F(1, faces).pow(2) as FractionType)
    .mul(F(faces - 1, faces).pow(dice - 2) as FractionType);
  // (b) P(at least one max) = 1 − ((faces−1)/faces)^dice.
  const atLeastOne = F(1).sub(F(faces - 1, faces).pow(dice) as FractionType);
  // (c) (1/faces)² — both dice in one fixed pair land on the max.
  const bothFixed = F(1, faces).pow(2) as FractionType;

  const { errors, push } = numericErrors(answer, dp);
  push(
    exactlyTwo,
    `C(${dice},2)(1/${faces})²((${faces - 1})/${faces})^${dice - 2} = ${fracText(exactlyTwo)} is P(EXACTLY two ${faces}s). The two highest also sum to ${maxSum} when three or more dice show ${faces}, so add the upper tail.`,
  );
  push(
    atLeastOne,
    `1 − (${faces - 1}/${faces})^${dice} = ${fracText(atLeastOne)} is P(at least ONE ${faces}); the top two only reach ${maxSum} when at least TWO dice show ${faces}.`,
  );
  push(
    bothFixed,
    `(1/${faces})² = ${fracText(bothFixed)} fixes TWO specific dice on ${faces}; you must allow any two of the ${dice} dice, i.e. P(X ≥ 2) for X ~ Bin(${dice}, 1/${faces}).`,
  );

  const prompt =
    `${th.actor} rolls ${dice} fair ${faces}-sided ${th.die} and looks at the two largest results. ` +
    `What is the probability that those two highest dice sum to the maximum possible ${maxSum}? (Round to ${dp} decimals.)`;
  const explanation =
    `The two highest sum to ${maxSum} exactly when at least two of the ${dice} dice already show ${faces}. With X = #dice showing ${faces} ~ Bin(${dice}, 1/${faces}), that is P(X ≥ 2) = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `Stopping at exactly two ${faces}s gives ${fracText(exactlyTwo)} and drops the three-or-more tail.`;

  return {
    id: `ca-toptwo-${dice}d${faces}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "hard",
    concept: "Top two dice hit the max (P(X≥2))",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SRC,
  };
}

/* ========================================================================== */
/* =================  3 — AT LEAST k OF A KIND (numeric)  ================== */
/* ========================================================================== */

const KIND_THEME = [
  { actor: "a farkle player", die: "dice" },
  { actor: "a yahtzee bot", die: "cubes" },
  { actor: "a liar's-dice crew", die: "dice" },
];

/**
 * P(at least `k` of `dice` d-`faces` dice show the same value) via
 * `atLeastKOfAKindProb` (complement occupancy DP). Distractors: the kept
 * complement 1 − answer (P(every value appears ≤ k−1 times)), a naive
 * exactly-k estimate faces·C(dice,k)(1/faces)^k((faces−1)/faces)^{dice−k}, and a
 * birthday-style Poisson approximation 1 − e^{−E} with E = C(dice,k)(1/faces)^{k−1}.
 */
export function genAtLeastKOfAKind(rng: Rng): NumericQuestion {
  const th = rng.pick(KIND_THEME);
  const faces = 6;
  const k = 3;
  const dice = rng.pick([5, 6, 7]);

  const value = atLeastKOfAKindProb(dice, faces, k);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  // (a) kept complement: P(every value appears ≤ k−1 times) = 1 − answer.
  const complement = F(1).sub(value);
  // (b) naive exactly-k: pick the value (×faces), k of the dice match, rest differ.
  const exactlyK = F(faces)
    .mul(F(chooseBig(dice, k).toString()))
    .mul(F(1, faces).pow(k) as FractionType)
    .mul(F(faces - 1, faces).pow(dice - k) as FractionType);
  // (c) birthday-style Poisson approx on the expected number of matching k-subsets.
  const expTriples = choose(dice, k) * (1 / faces) ** (k - 1);
  const birthday = 1 - Math.exp(-expTriples);

  const { errors, push } = numericErrors(answer, dp);
  push(
    complement,
    `${fracText(complement)} = 1 − answer is the COMPLEMENT (every value appears ≤ ${k - 1} times, i.e. NO ${k}-of-a-kind). The event "at least ${k} of a kind" is 1 minus this.`,
  );
  push(
    exactlyK,
    `${faces}·C(${dice},${k})(1/${faces})^${k}((${faces - 1})/${faces})^${dice - k} = ${fracText(exactlyK)} is a naive EXACTLY-${k} estimate; it ignores ${k + 1}-of-a-kind and double-handles overlaps, so it misses the exact occupancy count.`,
  );
  push(
    birthday,
    `A birthday-style approximation 1 − e^{−E} with E = C(${dice},${k})(1/${faces})^${k - 1} ≈ ${expTriples.toFixed(4)} gives ≈ ${birthday.toFixed(dp)}; the exact answer counts occupancies directly rather than assuming independent matching triples.`,
  );

  const prompt =
    `${th.actor} rolls ${dice} fair ${faces}-sided ${th.die} at once. ` +
    `What is the probability that at least ${k} of the ${dice} dice show the same value? (Round to ${dp} decimals.)`;
  const explanation =
    `Use the complement: count sequences where every one of the ${faces} face values appears at most ${k - 1} times (an occupancy count over ${faces}^${dice} = ${powBig(faces, dice).toString()} rolls), then subtract from 1. ` +
    `That gives P(at least ${k} alike) = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `The kept complement ${fracText(complement)} is exactly the "no ${k}-of-a-kind" probability.`;

  return {
    id: `ca-atleastk-${dice}d${faces}-k${k}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "hard",
    concept: "At least k of a kind (occupancy complement)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SRC,
  };
}

/* ========================================================================== */
/* =================  4 — SUBSET SUMS TO A TARGET (numeric)  =============== */
/* ========================================================================== */

const SUBSET_THEME = [
  { actor: "a puzzle app", die: "dice" },
  { actor: "a coin-toss quiz", die: "number cubes" },
  { actor: "a math-club game", die: "dice" },
];

/**
 * P(some non-empty subset of `dice` d-`faces` dice sums to exactly `target`) via
 * `subsetSumsToProb` (exact enumeration over all faces^dice rolls). Distractors:
 * a single-die-only check (some die alone equals target), a pair-only check
 * (some 2-subset sums to target), and the complement mishandle 1 − answer.
 */
export function genSubsetSum(rng: Rng): NumericQuestion {
  const th = rng.pick(SUBSET_THEME);
  const faces = 6;
  const dice = rng.pick([3, 4]);
  let target = rng.pick([5, 6, 7]);
  if (dice === 3 && target === 6) target = rng.pick([5, 7]); // avoid the source's (3,6,6)

  const value = subsetSumsToProb(dice, faces, target);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  // Re-derived subset-restricted probabilities (own enumeration, not the solver).
  const totalBig = powBig(faces, dice);
  const restrictedProb = (allow: (size: number) => boolean): FractionType => {
    let fav = 0n;
    const roll = new Array<number>(dice).fill(1);
    const hits = (): boolean => {
      for (let mask = 1; mask < 1 << dice; mask++) {
        let s = 0;
        let size = 0;
        for (let i = 0; i < dice; i++) {
          if (mask & (1 << i)) {
            s += roll[i];
            size++;
          }
        }
        if (allow(size) && s === target) return true;
      }
      return false;
    };
    const recur = (idx: number): void => {
      if (idx === dice) {
        if (hits()) fav += 1n;
        return;
      }
      for (let f = 1; f <= faces; f++) {
        roll[idx] = f;
        recur(idx + 1);
      }
    };
    recur(0);
    return F(fav.toString()).div(F(totalBig.toString())) as FractionType;
  };

  // (a) single-die-only: some die alone equals target (only valid when target ≤ faces).
  const singleDie = restrictedProb((size) => size === 1);
  // (b) pair-only: some 2-subset sums to target.
  const pairOnly = restrictedProb((size) => size === 2);
  // (c) "only large subsets" fallback when target exceeds a single face.
  const bigOnly = restrictedProb((size) => size >= 3);
  // (d) complement mishandle: reported 1 − answer.
  const complement = F(1).sub(value);

  const { errors, push } = numericErrors(answer, dp);
  if (target <= faces) {
    push(
      singleDie,
      `${fracText(singleDie)} counts only rolls where a SINGLE die already equals ${target}; a subset may combine two or more dice, so this undercounts.`,
    );
  } else {
    push(
      bigOnly,
      `${fracText(bigOnly)} counts only rolls where a subset of THREE or more dice sums to ${target}; a pair can also reach ${target}, so this misses those.`,
    );
  }
  push(
    pairOnly,
    `${fracText(pairOnly)} counts only rolls where some PAIR of dice sums to ${target}; single dice and larger subsets also count toward "some non-empty subset".`,
  );
  push(
    complement,
    `${fracText(complement)} = 1 − answer is P(NO subset sums to ${target}); it's the complement of the event asked, not the event itself.`,
  );

  const prompt =
    `${th.actor} rolls ${dice} fair ${faces}-sided ${th.die}. ` +
    `What is the probability that you can pick one or more of the ${dice} rolled dice whose values add up to exactly ${target}? (Round to ${dp} decimals.)`;
  const explanation =
    `Enumerate all ${faces}^${dice} = ${totalBig.toString()} ordered rolls and mark a roll favorable when ANY non-empty subset of its dice sums to ${target}. ` +
    `The exact favorable fraction is P = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `Checking only pairs gives ${fracText(pairOnly)}, which misses single-die and larger-subset matches.`;

  return {
    id: `ca-subsetsum-${dice}d${faces}-t${target}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "hard",
    concept: "Some subset sums to target (enumeration)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SRC,
  };
}

/* ========================================================================== */
/* =================  5 — STRICTLY INCREASING ROLL (numeric)  ============= */
/* ========================================================================== */

const INCREASING_THEME = [
  { actor: "a sequence game", die: "dice" },
  { actor: "a ladder puzzle", die: "spinners" },
  { actor: "a streak app", die: "number dice" },
];

/**
 * P(`dice` d-`faces` dice rolled in order come out STRICTLY increasing) via
 * `strictlyIncreasingProb` = C(faces,dice)/faces^dice. Distractors: 1/dice!
 * (assumes all orderings of a fixed distinct set are equally likely, forgetting
 * ties can occur), C(faces,dice)/C(faces+dice−1,dice) (used the multiset count
 * as the denominator), and the NON-strict overcount C(faces+dice−1,dice)/faces^dice
 * (allows ties / non-decreasing).
 */
export function genStrictlyIncreasing(rng: Rng): NumericQuestion {
  const th = rng.pick(INCREASING_THEME);
  const dice = rng.pick([3, 4]);
  const faces = rng.pick([6, 8, 10]);

  const value = strictlyIncreasingProb(dice, faces);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  let diceFact = 1;
  for (let i = 2; i <= dice; i++) diceFact *= i;

  // (a) 1/dice! — assumes the dice already show distinct values in random order.
  const invFact = F(1, diceFact);
  // (b) C(faces,dice)/C(faces+dice−1,dice) — divides by the multiset count.
  const wrongDenom = F(chooseBig(faces, dice).toString()).div(
    F(chooseBig(faces + dice - 1, dice).toString()),
  );
  // (c) NON-strict: C(faces+dice−1,dice)/faces^dice — allows ties (non-decreasing).
  const nonStrict = F(chooseBig(faces + dice - 1, dice).toString()).div(
    F(powBig(faces, dice).toString()),
  );

  const { errors, push } = numericErrors(answer, dp);
  push(
    invFact,
    `1/${dice}! = ${fracText(invFact)} assumes the ${dice} dice always show DISTINCT values in a random order; but ties happen, so only C(${faces},${dice}) of the ${faces}^${dice} rolls have ${dice} distinct increasing faces.`,
  );
  push(
    wrongDenom,
    `C(${faces},${dice})/C(${faces + dice - 1},${dice}) = ${fracText(wrongDenom)} divides by the multiset count C(faces+dice−1,dice); the equally-likely outcomes are the ${faces}^${dice} ORDERED rolls, not unordered multisets.`,
  );
  push(
    nonStrict,
    `C(${faces + dice - 1},${dice})/${faces}^${dice} = ${fracText(nonStrict)} counts NON-decreasing rolls (ties allowed). Strictly increasing needs distinct faces, i.e. C(${faces},${dice}) favorable.`,
  );

  const prompt =
    `On ${th.actor}, ${dice} fair ${faces}-sided ${th.die} are rolled one after another in a row. ` +
    `What is the probability that the values come out strictly increasing (each roll larger than the previous)? (Round to ${dp} decimals.)`;
  const explanation =
    `A strictly increasing sequence needs ${dice} DISTINCT faces, and any such set corresponds to exactly one increasing order — so there are C(${faces},${dice}) = ${chooseBig(faces, dice).toString()} favorable ordered rolls out of ${faces}^${dice} = ${powBig(faces, dice).toString()}. ` +
    `Thus P = C(${faces},${dice})/${faces}^${dice} = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `Allowing ties would instead give the non-decreasing count ${fracText(nonStrict)}.`;

  return {
    id: `ca-strictinc-${dice}d${faces}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "hard",
    concept: "Strictly increasing roll (C(faces,dice)/faces^dice)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SRC,
  };
}

/* ========================================================================== */
/* =================  6 — EXPECTED COMPLETE PAIRS DEALT (numeric)  ========= */
/* ========================================================================== */

const PAIRS_THEME = [
  { actor: "a memory-match app", card: "cards", unit: "designs" },
  { actor: "a domino dealer", card: "tiles", unit: "symbols" },
  { actor: "a trading-card bot", card: "cards", unit: "characters" },
];

/**
 * EXPECTED number of complete pairs when dealing `deal` cards from `ranks` ranks
 * × `copies` copies each, via `expectedPairsDealt` (linearity of expectation:
 * E = ranks · P(a given rank fully in hand)). Distractors: the per-rank
 * probability alone (forgot ×ranks), the naive deal/2 (assumes every 2 cards
 * pair up), and the ranks·(copies/total) slip.
 */
export function genExpectedPairs(rng: Rng): NumericQuestion {
  const th = rng.pick(PAIRS_THEME);
  const copies = 2;
  const ranks = rng.pick([5, 6, 7]); // ≥5 ranks: never the source's 4-rank / deal-4 tuple
  const total = ranks * copies;
  const deal = rng.pick([4, 5, 6]); // ≤ total since total ≥ 10

  const value = expectedPairsDealt(ranks, copies, deal);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  // (a) per-rank probability only (forgot the ×ranks linearity sum).
  const perRank = F(chooseBig(total - copies, deal - copies).toString()).div(
    F(chooseBig(total, deal).toString()),
  );
  // (b) deal/2 — naively assumes every two dealt cards form a pair.
  const naiveHalf = deal / 2;
  // (c) ranks·(copies/total) slip.
  const ratioSlip = F(ranks * copies, total);

  const { errors, push } = numericErrors(answer, dp);
  push(
    perRank,
    `${fracText(perRank)} = C(${total - copies},${deal - copies})/C(${total},${deal}) is P(one SPECIFIC ${th.unit.slice(0, -1)} is fully dealt). By linearity you sum over all ${ranks} ${th.unit}, so multiply by ${ranks}.`,
  );
  push(
    naiveHalf,
    `deal/2 = ${deal}/2 = ${naiveHalf} assumes every two dealt ${th.card} form a complete pair; most dealt ${th.card} are unmatched, so this hugely over-estimates.`,
  );
  push(
    ratioSlip,
    `ranks·(copies/total) = ${ranks}·${copies}/${total} = ${fracText(ratioSlip)} misuses copies/total as the per-rank completion chance; the correct per-rank probability is C(${total - copies},${deal - copies})/C(${total},${deal}).`,
  );

  const prompt =
    `${th.actor} deals ${deal} ${th.card} at random from a deck of ${ranks} ${th.unit} with exactly ${copies} copies of each (${total} ${th.card} total). ` +
    `On average, how many COMPLETE pairs (both copies of a ${th.unit.slice(0, -1)}) are in the ${deal} dealt ${th.card}? (Round to ${dp} decimals.)`;
  const explanation =
    `By linearity of expectation, let Iᵣ indicate "both copies of ${th.unit.slice(0, -1)} r are dealt". Then E[pairs] = ranks · P(a given rank fully in hand) = ${ranks} · C(${total - copies},${deal - copies})/C(${total},${deal}). ` +
    `That equals ${ranks} · ${fracText(perRank)} = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `The per-rank term ${fracText(perRank)} alone forgets to sum over all ${ranks} ${th.unit}.`;

  return {
    id: `ca-exppairs-r${ranks}-c${copies}-d${deal}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "hard",
    concept: "Expected complete pairs (linearity of expectation)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SRC,
  };
}

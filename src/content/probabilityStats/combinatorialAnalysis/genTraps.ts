import type { Rng } from "@/lib/rng";
import type { Difficulty, NumericQuestion, Question } from "@/types/content";
import {
  F,
  choose,
  chooseBig,
  decText,
  factorialBig,
  fracBig,
  fracText,
  powBig,
} from "./combinatorics";
import { type Choice, assembleChoices } from "./_shared";
import { numDp, numericErrors } from "../coreScaffold";
import { MISCONCEPTION } from "@/lib/tutor/misconception";
import {
  diceSumEqualsProb,
  nonDecreasingThreeDrawProb,
  strictlyIncreasingProb,
} from "./solvers";

/**
 * Parametric QUIZ generators for the Probability & Statistics → **Combinatorial
 * Analysis** subcategory that each TEACH one named COUNTING TRAP. Every correct
 * value comes ONLY from the exact solvers / combinatorics helpers
 * (`strictlyIncreasingProb`, `nonDecreasingThreeDrawProb`, `diceSumEqualsProb`,
 * `choose`, `chooseBig`, `powBig`, `factorialBig`, …) so instances are correct
 * by construction; every distractor is a re-derived, NAMED misconception that is
 * verified distinct from the answer and from the other distractors.
 *
 * All choices in a single item share ONE format (all integer strings OR all
 * `fracText` fractions) so the options are directly comparable, mirroring the
 * `general/genDiceGeo.ts` quiz style. Fresh themes throughout — none of the
 * source-dataset titles ("Dice Order", "Rising Chips", "Sum Seventeen", …) or
 * their phrasings appear anywhere.
 */

const SOURCE = "Combinatorial Analysis · Counting traps";
const DIFFICULTY = "medium" as const;

/* ========================================================================== */
/* ===============  1 — PERMUTATIONS vs COMBINATIONS (quiz)  =============== */
/* ========================================================================== */

/**
 * "Choose k of n where order does NOT matter." Correct = C(n, k). The headline
 * trap is treating an UNORDERED selection as if order mattered (permutations
 * P(n,k) = n!/(n−k)!), plus the with-replacement (nᵏ) and naive-product (n·k)
 * slips. All four options are integer strings.
 */
export function genPermVsComb(rng: Rng): Question {
  const n = rng.int(6, 10);
  const k = rng.int(2, 4);

  const comb = choose(n, k); // C(n,k) — the unordered count (correct)
  const perm = chooseBig(n, k) * factorialBig(k); // P(n,k) = n!/(n−k)!
  const withRepl = powBig(n, k); // nᵏ — ordered, with replacement
  const naive = n * k; // n·k — naive multiplication

  const prompt =
    `A research lab has ${n} distinct candidate experiments and will fund exactly ${k} of them. ` +
    `Only WHICH ${k} experiments make the cut matters — the funding order is irrelevant. ` +
    `How many different groups of ${k} experiments can be funded?`;

  const correct: Choice = {
    text: String(comb),
    rationale:
      `Correct — an unordered selection of ${k} from ${n} is the combination ` +
      `C(${n},${k}) = ${comb}. Order is irrelevant, so no k! overcount.`,
  };
  const distractors: Choice[] = [
    {
      text: perm.toString(),
      rationale:
        `Order-matters error: this is the permutation P(${n},${k}) = ${n}!/(${n}−${k})! = ${perm}. ` +
        `It counts the SAME group in ${k}! different orders. Divide by ${k}! to get C(${n},${k}) = ${comb}.`,
    },
    {
      text: withRepl.toString(),
      rationale:
        `With-replacement / ordered error: ${n}^${k} = ${withRepl} counts ordered picks that may reuse ` +
        `an experiment. Here each pick is distinct AND order-free, so it is C(${n},${k}) = ${comb}.`,
    },
    {
      text: String(naive),
      rationale:
        `Naive product: ${n}·${k} = ${naive} just multiplies the two numbers. Choosing ${k} of ${n} ` +
        `unordered items is the binomial coefficient C(${n},${k}) = ${comb}, not n·k.`,
    },
  ];

  const explanation =
    `Choosing an UNORDERED group of ${k} from ${n} is the combination C(${n},${k}) = ${comb}. ` +
    `Ordering those same ${k} (permutations P(${n},${k}) = ${n}!/(${n}−${k})! = ${perm}) overcounts each ` +
    `group ${k}! = ${factorialBig(k)} times; ${n}^${k} = ${withRepl} counts ordered picks WITH replacement; ` +
    `and ${n}·${k} = ${naive} is just a product. The unordered count is C(${n},${k}) = ${comb}.`;

  return {
    id: `perm-vs-comb-n${n}-k${k}`,
    prompt,
    explanation,
    difficulty: DIFFICULTY,
    concept: "Permutations vs combinations (order should not matter)",
    source: SOURCE,
    ...assembleChoices(rng, correct, distractors),
  };
}

/* ========================================================================== */
/* =================  2 — WITH vs WITHOUT REPLACEMENT (quiz)  ============== */
/* ========================================================================== */

/**
 * Count sequences drawn WITH replacement where order matters → nᵏ (correct).
 * The traps are the three neighbouring counting rules: C(n,k) (unordered, no
 * replacement), P(n,k) (ordered, no replacement), and C(n+k−1,k) (unordered
 * WITH replacement). All four options are integer strings.
 */
export function genReplacementTrap(rng: Rng): Question {
  const n = rng.int(4, 8);
  const k = rng.pick([2, 3]);

  const withReplOrdered = powBig(n, k); // nᵏ — ordered, with replacement (correct)
  const unordered = chooseBig(n, k); // C(n,k) — unordered, no replacement
  const orderedNoRepl = chooseBig(n, k) * factorialBig(k); // P(n,k) — ordered, no replacement
  const unorderedWithRepl = chooseBig(n + k - 1, k); // C(n+k−1,k) — unordered, with replacement

  const prompt =
    `A ${k}-symbol access code is built from a palette of ${n} distinct symbols. ` +
    `Each of the ${k} positions is chosen independently — a symbol MAY be reused — and the ORDER of ` +
    `the positions matters. How many distinct codes are possible?`;

  const correct: Choice = {
    text: withReplOrdered.toString(),
    rationale:
      `Correct — with replacement and order mattering, each of the ${k} positions independently has ` +
      `${n} choices, so ${n}^${k} = ${withReplOrdered}.`,
  };
  const distractors: Choice[] = [
    {
      text: unordered.toString(),
      rationale:
        `Unordered / no-replacement error: C(${n},${k}) = ${unordered} counts UNORDERED selections with no ` +
        `reuse. Here positions are ordered and symbols may repeat, giving ${n}^${k} = ${withReplOrdered}.`,
    },
    {
      text: orderedNoRepl.toString(),
      rationale:
        `Forgot replacement: P(${n},${k}) = ${n}!/(${n}−${k})! = ${orderedNoRepl} is ordered but WITHOUT reuse ` +
        `(each next choice drops one). Repeats are allowed, so it is ${n}^${k} = ${withReplOrdered}.`,
    },
    {
      text: unorderedWithRepl.toString(),
      rationale:
        `Right on replacement, wrong on order: C(${n}+${k}−1,${k}) = ${unorderedWithRepl} counts UNORDERED ` +
        `multisets with repeats. Since position order matters here, it is ${n}^${k} = ${withReplOrdered}.`,
    },
  ];

  const explanation =
    `With replacement and order mattering, each of the ${k} positions independently picks one of ${n} ` +
    `symbols, giving ${n}^${k} = ${withReplOrdered} sequences. Contrast the traps: C(${n},${k}) = ${unordered} ` +
    `(unordered, no reuse), P(${n},${k}) = ${orderedNoRepl} (ordered, no reuse), and ` +
    `C(${n}+${k}−1,${k}) = ${unorderedWithRepl} (unordered WITH reuse). The answer is ${n}^${k} = ${withReplOrdered}.`;

  return {
    id: `replacement-trap-n${n}-k${k}`,
    prompt,
    explanation,
    difficulty: DIFFICULTY,
    concept: "With vs without replacement (and ordered vs not)",
    source: SOURCE,
    ...assembleChoices(rng, correct, distractors),
  };
}

/* ========================================================================== */
/* ============  3 — STRICTLY INCREASING vs NON-DECREASING (quiz)  ========= */
/* ========================================================================== */

/**
 * The strict-vs-non-decreasing TIE trap, in two framings:
 *   • dice — P(three ordered d`faces` rolls are STRICTLY increasing) =
 *     strictlyIncreasingProb(3, faces). The key distractor allows ties
 *     (non-decreasing), C(faces+2,3)/faces³ — the exact strict-vs-ties slip.
 *   • jar  — P(three chips drawn without replacement come out NON-DECREASING) =
 *     nonDecreasingThreeDrawProb(v, c). The key distractor is the strictly
 *     increasing (all-distinct) value, which forgets that equal ranks still
 *     count as non-decreasing.
 * All four options are fractions via `fracText`.
 */
export function genTiesOrder(rng: Rng): Question {
  const diceMode = rng.chance(0.5);

  if (diceMode) {
    const faces = rng.pick([6, 8, 10]);
    const denom = powBig(faces, 3); // faces³ ordered sequences
    const value = strictlyIncreasingProb(3, faces); // C(faces,3)/faces³ (correct)
    const fav = chooseBig(faces, 3);

    const nonDecreasing = fracBig(chooseBig(faces + 2, 3), denom); // ties allowed
    const wrongDenom = fracBig(chooseBig(faces, 3), chooseBig(faces + 2, 3)); // /multiset count

    const prompt =
      `You roll a fair ${faces}-sided die three times in a row and write the results down in order. ` +
      `What is the probability the three numbers come out STRICTLY increasing ` +
      `(each strictly larger than the one before)?`;

    const correct: Choice = {
      text: fracText(value),
      rationale:
        `Correct — strictly increasing means 3 DISTINCT faces, each in exactly one increasing order: ` +
        `C(${faces},3)/${faces}³ = ${fav}/${denom} = ${fracText(value)}.`,
    };
    const distractors: Choice[] = [
      {
        text: fracText(nonDecreasing),
        rationale:
          `The strict-vs-ties slip: ${fracText(nonDecreasing)} = C(${faces}+2,3)/${faces}³ counts NON-DECREASING ` +
          `sequences, which ALLOW equal values (e.g. 2,2,5). "Strictly increasing" forbids ties, giving ${fracText(value)}.`,
      },
      {
        text: fracText(F(1, 6)),
        rationale:
          `The naive 1/3! = 1/6 assumes the three rolls are always distinct and just asks for the one increasing ` +
          `order of 3! permutations. But rolls can tie, so P(distinct AND increasing) is only ${fracText(value)}.`,
      },
      {
        text: fracText(wrongDenom),
        rationale:
          `Wrong denominator: ${fracText(wrongDenom)} = C(${faces},3)/C(${faces}+2,3) divides increasing triples by the ` +
          `count of NON-DECREASING sequences instead of all ${faces}³ equally-likely ordered rolls.`,
      },
    ];

    const explanation =
      `Three ordered rolls give ${faces}³ = ${denom} equally-likely sequences; a strictly increasing one picks ` +
      `3 distinct faces C(${faces},3) = ${fav}, each realizable in exactly ONE increasing order, so ` +
      `P = ${fav}/${denom} = ${fracText(value)}. Allowing ties (NON-decreasing) instead counts ` +
      `C(${faces}+2,3) sequences = ${fracText(nonDecreasing)} — the classic strict-vs-non-decreasing trap — while ` +
      `the naive 1/6 wrongly assumes every triple is distinct.`;

    return {
      id: `ties-order-dice-f${faces}`,
      prompt,
      explanation,
      difficulty: DIFFICULTY,
      concept: "Strictly increasing vs non-decreasing (ties)",
      source: SOURCE,
      ...assembleChoices(rng, correct, distractors),
    };
  }

  // Jar / draw-without-replacement framing.
  const v = rng.pick([4, 5, 6]);
  const c = rng.pick([2, 3]);
  const total = chooseBig(v * c, 3); // unordered handfuls
  const value = nonDecreasingThreeDrawProb(v, c); // correct (non-decreasing draw order)

  const strictInc = fracBig(chooseBig(v, 3) * powBig(c, 3), 6n * total); // all-distinct & increasing
  const allDistinct = fracBig(chooseBig(v, 3) * powBig(c, 3), total); // P(3 distinct ranks)

  const prompt =
    `A tray holds ${v} distinct token ranks with ${c} identical copies of each (${v * c} tokens in all). ` +
    `You scoop the tokens out one at a time, without replacement, until you hold 3. ` +
    `What is the probability their ranks come out in NON-DECREASING order (never dropping from one to the next)?`;

  const correct: Choice = {
    text: fracText(value),
    rationale:
      `Correct — split by handful type (all-different, one repeated rank, all three equal) and weight each by ` +
      `its share of non-decreasing orders (1/6, 1/3, 1): ${fracText(value)}.`,
  };
  const distractors: Choice[] = [
    {
      text: fracText(strictInc),
      rationale:
        `The strict-vs-ties slip: ${fracText(strictInc)} is P(STRICTLY increasing) — only all-distinct ranks, one ` +
        `increasing order in 6. It drops the tied handfuls (equal ranks), which still count as non-decreasing.`,
    },
    {
      text: fracText(F(1, 6)),
      rationale:
        `The naive 1/3! = 1/6 assumes all three ranks are distinct and picks the single sorted order. Ties ` +
        `(repeated ranks) raise the chance well above 1/6 to ${fracText(value)}.`,
    },
    {
      text: fracText(allDistinct),
      rationale:
        `${fracText(allDistinct)} is just P(all three ranks are DIFFERENT). Being non-decreasing is about the draw ` +
        `ORDER (and includes ties), not about the ranks being distinct.`,
    },
  ];

  const explanation =
    `Draw 3 of ${v * c} tokens (C(${v * c},3) = ${total} equally-likely handfuls). A NON-decreasing draw counts ` +
    `all-different handfuls at 1/6, one-repeated-rank at 1/3, and all-equal at 1, giving ${fracText(value)}. ` +
    `Reporting only the strictly increasing (all-distinct) share, ${fracText(strictInc)}, is the strict-vs-ties ` +
    `trap; the naive 1/6 ignores ties entirely.`;

  return {
    id: `ties-order-jar-v${v}-c${c}`,
    prompt,
    explanation,
    difficulty: DIFFICULTY,
    concept: "Strictly increasing vs non-decreasing (ties)",
    source: SOURCE,
    ...assembleChoices(rng, correct, distractors),
  };
}

/* ========================================================================== */
/* ============  4 — STARS & BARS WITH A FACE CAP (quiz)  ================== */
/* ========================================================================== */

/**
 * Count the ordered dice rolls that sum to a target. Correct = the capped count
 * (stars & bars trimmed by inclusion–exclusion on the ≤faces cap), derived from
 * `diceSumEqualsProb`. The KEY trap is the UNCAPPED stars & bars count
 * C(target−1, dice−1) (forgot the face cap → overcount). Other traps: forgetting
 * each die is ≥1 (C(target+dice−1, dice−1)) and the capped count for a
 * neighbouring target (off-by-one on the sum). All four options are integers.
 */
export function genStarsBarsCap(rng: Rng): Question {
  const dice = rng.pick([3, 4]);
  const faces = 6;
  const target = dice === 3 ? rng.pick([12, 13, 14, 15]) : rng.pick([15, 16, 18, 19]);

  const total = Number(powBig(faces, dice)); // faces^dice equally-likely ordered rolls
  const count = Math.round(diceSumEqualsProb(dice, faces, target).valueOf() * total);

  const uncapped = chooseBig(target - 1, dice - 1); // parts ≥1, NO face cap (overcount)
  const noMinimum = chooseBig(target + dice - 1, dice - 1); // forgot each die ≥1 (parts ≥0)

  // Off-by-one on the sum: the capped count for a neighbouring target. Pick the
  // side whose count differs from the true count (recompute to avoid a collision).
  let nbrTarget = target + 1;
  let nbrCount = Math.round(diceSumEqualsProb(dice, faces, nbrTarget).valueOf() * total);
  if (nbrCount === count) {
    nbrTarget = target - 1;
    nbrCount = Math.round(diceSumEqualsProb(dice, faces, nbrTarget).valueOf() * total);
  }

  const prompt =
    `You roll ${dice} fair ${faces}-sided dice in a row, keeping track of the order. ` +
    `Among all ${total} = ${faces}^${dice} equally likely ordered rolls, ` +
    `how many have pips adding up to exactly ${target}?`;

  const correct: Choice = {
    text: String(count),
    rationale:
      `Correct — stars & bars for a sum of ${target} across ${dice} dice, TRIMMED by inclusion–exclusion for the ` +
      `≤${faces} face cap, leaves ${count} ordered outcomes.`,
  };
  const distractors: Choice[] = [
    {
      text: uncapped.toString(),
      rationale:
        `Forgot the face cap: C(${target}−1,${dice}−1) = ${uncapped} is uncapped stars & bars (each die ≥1 but ` +
        `UNBOUNDED above). It OVERCOUNTS by allowing a die to exceed ${faces}; the capped count is ${count}.`,
    },
    {
      text: noMinimum.toString(),
      rationale:
        `Shift error: C(${target}+${dice}−1,${dice}−1) = ${noMinimum} lets each die be ≥0 instead of ≥1. A real die ` +
        `shows at least 1, so subtract the minimum first — and the cap still applies, giving ${count}.`,
    },
    {
      text: String(nbrCount),
      rationale:
        `Off-by-one on the sum: ${nbrCount} is the (capped) number of ways to total ${nbrTarget}, not ${target}. ` +
        `The dice-sum distribution is not flat, so a neighbouring total has a different count (${count}).`,
    },
  ];

  const explanation =
    `Only ${count} of the ${total} = ${faces}^${dice} ordered rolls of ${dice} d${faces} dice total ${target}, ` +
    `once inclusion–exclusion trims the outcomes that would need a die above ${faces}. Ignoring that cap, plain ` +
    `stars & bars gives C(${target}−1,${dice}−1) = ${uncapped} compositions — an OVERCOUNT, since it lets a die ` +
    `exceed ${faces}. The correct, capped count is ${count}.`;

  return {
    id: `stars-bars-cap-d${dice}-f${faces}-t${target}`,
    prompt,
    explanation,
    difficulty: DIFFICULTY,
    concept: "Stars & bars with a face cap (inclusion–exclusion)",
    source: SOURCE,
    ...assembleChoices(rng, correct, distractors),
  };
}

/* ========================================================================== */
/*  FREE-RESPONSE (numeric) conversions                                        */
/*                                                                            */
/*  Each mirrors its quiz sibling above (SAME exact solver / combinatorics),  */
/*  now graded as a typed count or probability. Every genuine error mode is a */
/*  parametric wrong-value + a machine-readable `misconception` tag + an       */
/*  answer-withholding rung-1 coaching sentence (names the slip + a leading    */
/*  question). The quiz generators are kept exported so existing tests pass.   */
/* ========================================================================== */

/**
 * FREE-RESPONSE form of {@link genPermVsComb}: "how many unordered groups of `k`
 * from `n`?" = C(n,k) (a whole-number COUNT). Error modes: the ordered
 * permutation P(n,k), the with-replacement ordered count nᵏ, and the naive
 * product n·k.
 */
export function buildPermVsCombNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const n = rng.int(6, 10);
  const k = rng.int(2, 4);

  const comb = choose(n, k); // C(n,k) — the unordered count (correct)
  const answer = comb;

  const perm = Number(chooseBig(n, k) * factorialBig(k)); // P(n,k)
  const withRepl = Number(powBig(n, k)); // nᵏ
  const naive = n * k; // n·k

  const { errors, push } = numericErrors(answer, 0);
  push(
    perm,
    `You lined the ${k} choices up in a definite order, but the problem says only WHICH ${k} are funded matters. If order is irrelevant, aren't you counting each group several times — by what factor?`,
    MISCONCEPTION.orderedVsUnordered,
  );
  push(
    withRepl,
    `It looks like each of the ${k} slots could be any of the ${n}, reusing an experiment. But can the same experiment be funded twice here — and does the order of the slots even matter?`,
    "counts_with_replacement",
  );
  push(
    naive,
    `Multiplying the two numbers, ${n}·${k}, is tempting — but choosing a GROUP isn't a single product of ${n} and ${k}. Which counting rule counts unordered selections of ${k} from ${n}?`,
    "naive_product",
  );

  const prompt =
    `A research lab has ${n} distinct candidate experiments and will fund exactly ${k} of them. ` +
    `Only WHICH ${k} experiments make the cut matters — the funding order is irrelevant. ` +
    `How many different groups of ${k} experiments can be funded? (Enter a whole number.)`;
  const explanation =
    `Choosing an UNORDERED group of ${k} from ${n} is the combination C(${n},${k}) = ${comb}. ` +
    `Ordering those same ${k} (permutations P(${n},${k}) = ${perm}) overcounts each group ${k}! times; ` +
    `${n}^${k} = ${withRepl} counts ordered picks WITH replacement; and ${n}·${k} = ${naive} is just a product.`;

  return {
    answer,
    numeric: {
      id: `perm-vs-comb-num-n${n}-k${k}`,
      prompt,
      answer,
      difficulty,
      concept: "Permutations vs combinations (order should not matter)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: SOURCE,
    },
  };
}

/**
 * FREE-RESPONSE form of {@link genReplacementTrap}: ordered picks WITH
 * replacement → nᵏ (a whole-number COUNT). Error modes are the three
 * neighbouring rules: unordered no-replacement C(n,k), ordered no-replacement
 * P(n,k), and unordered with-replacement C(n+k−1,k).
 */
export function buildReplacementTrapNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const n = rng.int(4, 8);
  const k = rng.pick([2, 3]);

  const answer = Number(powBig(n, k)); // nᵏ — ordered, with replacement (correct)
  const unordered = Number(chooseBig(n, k)); // C(n,k)
  const orderedNoRepl = Number(chooseBig(n, k) * factorialBig(k)); // P(n,k)
  const unorderedWithRepl = Number(chooseBig(n + k - 1, k)); // C(n+k−1,k)

  const { errors, push } = numericErrors(answer, 0);
  push(
    unordered,
    `C(${n},${k}) counts UNORDERED picks with no reuse. But here each of the ${k} positions is ordered AND a symbol may repeat — does that make the count larger or smaller than C(${n},${k})?`,
    MISCONCEPTION.orderedVsUnordered,
  );
  push(
    orderedNoRepl,
    `You have order right, but P(${n},${k}) forbids reusing a symbol (each next choice drops one). Here symbols MAY repeat — so should later positions really lose a choice?`,
    "forgot_replacement",
  );
  push(
    unorderedWithRepl,
    `You allowed repeats — good — but C(${n}+${k}−1,${k}) treats the ${k} positions as an unordered multiset. Here the ORDER of the positions matters. Does that push the count up?`,
    "unordered_with_replacement",
  );

  const prompt =
    `A ${k}-symbol access code is built from a palette of ${n} distinct symbols. ` +
    `Each of the ${k} positions is chosen independently — a symbol MAY be reused — and the ORDER of ` +
    `the positions matters. How many distinct codes are possible? (Enter a whole number.)`;
  const explanation =
    `With replacement and order mattering, each of the ${k} positions independently picks one of ${n} ` +
    `symbols, giving ${n}^${k} = ${answer}. Contrast the traps: C(${n},${k}) = ${unordered} (unordered, no reuse), ` +
    `P(${n},${k}) = ${orderedNoRepl} (ordered, no reuse), and C(${n}+${k}−1,${k}) = ${unorderedWithRepl} (unordered WITH reuse).`;

  return {
    answer,
    numeric: {
      id: `replacement-trap-num-n${n}-k${k}`,
      prompt,
      answer,
      difficulty,
      concept: "With vs without replacement (and ordered vs not)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: SOURCE,
    },
  };
}

/**
 * FREE-RESPONSE form of {@link genTiesOrder}: the strict-vs-non-decreasing TIE
 * trap as a typed PROBABILITY, in the same two framings (ordered dice rolls /
 * without-replacement jar draw). Error modes: allowing ties (non-decreasing vs
 * strict, or vice versa), the naive 1/3! = 1/6 (assume all distinct), and a
 * wrong denominator / distinct-not-order slip.
 */
export function buildTiesOrderNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const diceMode = rng.chance(0.5);

  if (diceMode) {
    const faces = rng.pick([6, 8, 10]);
    const denom = powBig(faces, 3); // faces³ ordered sequences
    const value = strictlyIncreasingProb(3, faces); // C(faces,3)/faces³ (correct)
    const dp = numDp(value);
    const answer = Number(decText(value, dp));

    const nonDecreasing = fracBig(chooseBig(faces + 2, 3), denom); // ties allowed
    const wrongDenom = fracBig(chooseBig(faces, 3), chooseBig(faces + 2, 3)); // /multiset count

    const { errors, push } = numericErrors(answer, dp);
    push(
      nonDecreasing,
      `Mind the ties: "strictly increasing" forbids equal values, but this count also sweeps in rolls like 2,2,5. Should repeated values really qualify here?`,
      "strict_vs_nondecreasing",
    );
    push(
      F(1, 6),
      `The 1/3! = 1/6 guess assumes the three rolls are always different, then picks the one sorted order. But two rolls CAN tie — is every triple guaranteed distinct?`,
      "assume_all_distinct",
    );
    push(
      wrongDenom,
      `Check the denominator: the equally-likely outcomes are the ORDERED rolls. How many ordered sequences of three rolls of a ${faces}-sided die are there in total?`,
      "wrong_denominator",
    );

    const prompt =
      `You roll a fair ${faces}-sided die three times in a row and write the results down in order. ` +
      `What is the probability the three numbers come out STRICTLY increasing ` +
      `(each strictly larger than the one before)? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
    const explanation =
      `Three ordered rolls give ${faces}³ = ${denom} equally-likely sequences; a strictly increasing one picks ` +
      `3 distinct faces C(${faces},3), each realizable in exactly ONE increasing order, so ` +
      `P = C(${faces},3)/${faces}³ = ${fracText(value)} ≈ ${decText(value, dp)}. Allowing ties (non-decreasing) counts ` +
      `C(${faces}+2,3) sequences instead — the classic strict-vs-non-decreasing trap.`;

    return {
      answer,
      numeric: {
        id: `ties-order-num-dice-f${faces}`,
        prompt,
        answer,
        decimals: dp,
        difficulty,
        concept: "Strictly increasing vs non-decreasing (ties)",
        explanation,
        unit: "",
        commonErrors: errors,
        source: SOURCE,
      },
    };
  }

  // Jar / draw-without-replacement framing.
  const v = rng.pick([4, 5, 6]);
  const c = rng.pick([2, 3]);
  const total = chooseBig(v * c, 3); // unordered handfuls
  const value = nonDecreasingThreeDrawProb(v, c); // correct (non-decreasing draw order)
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const strictInc = fracBig(chooseBig(v, 3) * powBig(c, 3), 6n * total); // all-distinct & increasing
  const allDistinct = fracBig(chooseBig(v, 3) * powBig(c, 3), total); // P(3 distinct ranks)

  const { errors, push } = numericErrors(answer, dp);
  push(
    strictInc,
    `That's the strictly-increasing (all-distinct) share. But NON-decreasing also allows equal ranks in a row — did you drop the tied handfuls that still count?`,
    "strict_vs_nondecreasing",
  );
  push(
    F(1, 6),
    `The 1/3! = 1/6 guess assumes all three ranks differ and picks the one sorted order. With repeated ranks possible, is the chance really that low?`,
    "assume_all_distinct",
  );
  push(
    allDistinct,
    `That's just the chance the three ranks are all DIFFERENT. But the question is about the draw ORDER (ties allowed), not whether the ranks are distinct — aren't those different events?`,
    "distinct_not_order",
  );

  const prompt =
    `A tray holds ${v} distinct token ranks with ${c} identical copies of each (${v * c} tokens in all). ` +
    `You scoop the tokens out one at a time, without replacement, until you hold 3. ` +
    `What is the probability their ranks come out in NON-DECREASING order (never dropping from one to the next)? (Enter a fraction or decimal.) Round to the nearest thousandth.`;
  const explanation =
    `Draw 3 of ${v * c} tokens (C(${v * c},3) = ${total} equally-likely handfuls). A NON-decreasing draw counts ` +
    `all-different handfuls at 1/6, one-repeated-rank at 1/3, and all-equal at 1, giving ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `Reporting only the strictly increasing (all-distinct) share is the strict-vs-ties trap; the naive 1/6 ignores ties entirely.`;

  return {
    answer,
    numeric: {
      id: `ties-order-num-jar-v${v}-c${c}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Strictly increasing vs non-decreasing (ties)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: SOURCE,
    },
  };
}

/**
 * FREE-RESPONSE form of {@link genStarsBarsCap}: the number of ordered dice
 * rolls summing to a target (a whole-number COUNT) = capped stars & bars via
 * inclusion–exclusion. Error modes: uncapped stars & bars C(target−1,dice−1)
 * (forgot the ≤6 face cap), the each-die-≥0 shift C(target+dice−1,dice−1)
 * (forgot each die ≥ 1), and the capped count for a neighbouring target
 * (off-by-one on the sum).
 */
export function buildStarsBarsCapNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const dice = rng.pick([3, 4]);
  const faces = 6;
  const target = dice === 3 ? rng.pick([12, 13, 14, 15]) : rng.pick([15, 16, 18, 19]);

  const total = Number(powBig(faces, dice)); // faces^dice equally-likely ordered rolls
  const count = Math.round(diceSumEqualsProb(dice, faces, target).valueOf() * total);
  const answer = count;

  const uncapped = Number(chooseBig(target - 1, dice - 1)); // parts ≥1, NO face cap
  const noMinimum = Number(chooseBig(target + dice - 1, dice - 1)); // parts ≥0

  // Off-by-one on the sum: the capped count for a neighbouring target.
  let nbrTarget = target + 1;
  let nbrCount = Math.round(diceSumEqualsProb(dice, faces, nbrTarget).valueOf() * total);
  if (nbrCount === count) {
    nbrTarget = target - 1;
    nbrCount = Math.round(diceSumEqualsProb(dice, faces, nbrTarget).valueOf() * total);
  }

  const { errors, push } = numericErrors(answer, 0);
  push(
    uncapped,
    `Plain stars & bars, C(${target}−1,${dice}−1), lets a die climb as high as it likes. But a real d${faces} stops at ${faces} — shouldn't you remove the rolls that would need a die above ${faces}?`,
    "forgot_face_cap",
  );
  push(
    noMinimum,
    `C(${target}+${dice}−1,${dice}−1) lets a die show 0. A die shows at least 1 — did you subtract the minimum of 1 from each die before counting compositions?`,
    "forgot_die_minimum",
  );
  push(
    nbrCount,
    `That's the count for a neighbouring total (${nbrTarget}). The dice-sum distribution isn't flat, so are you sure you counted for exactly ${target}?`,
    "off_by_one_target",
  );

  const prompt =
    `You roll ${dice} fair ${faces}-sided dice in a row, keeping track of the order. ` +
    `Among all ${total} = ${faces}^${dice} equally likely ordered rolls, ` +
    `how many have pips adding up to exactly ${target}? (Enter a whole number.)`;
  const explanation =
    `Only ${count} of the ${total} = ${faces}^${dice} ordered rolls total ${target}, once inclusion–exclusion trims the ` +
    `outcomes that would need a die above ${faces}. Ignoring that cap, plain stars & bars gives ` +
    `C(${target}−1,${dice}−1) = ${uncapped} compositions — an OVERCOUNT. The correct, capped count is ${count}.`;

  return {
    answer,
    numeric: {
      id: `stars-bars-cap-num-d${dice}-f${faces}-t${target}`,
      prompt,
      answer,
      difficulty,
      concept: "Stars & bars with a face cap (inclusion–exclusion)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: SOURCE,
    },
  };
}

/* ========================================================================== */
/*  Named numeric generators (adapters)                                        */
/* ========================================================================== */

export const genPermVsCombNumeric = (rng: Rng): NumericQuestion =>
  buildPermVsCombNumericInstance(rng, DIFFICULTY).numeric;
export const genReplacementTrapNumeric = (rng: Rng): NumericQuestion =>
  buildReplacementTrapNumericInstance(rng, DIFFICULTY).numeric;
export const genTiesOrderNumeric = (rng: Rng): NumericQuestion =>
  buildTiesOrderNumericInstance(rng, DIFFICULTY).numeric;
export const genStarsBarsCapNumeric = (rng: Rng): NumericQuestion =>
  buildStarsBarsCapNumericInstance(rng, DIFFICULTY).numeric;

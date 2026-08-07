import type { Rng } from "@/lib/rng";
import type { Difficulty, NumericQuestion, Question } from "@/types/content";
import type Fraction from "fraction.js";
import {
  F,
  allDifferentDigitsProb,
  biggerDieProb,
  decText,
  diceSumEvenProb,
  diceSumInSetProb,
  diceSumLEProb,
  evenHeadsProb,
  fracText,
  onesGreaterThanTensProb,
  secondLessProb,
} from "../coreSolvers";
import { type Choice, assembleChoices, numDp, numericErrors } from "../coreScaffold";

/**
 * Parametric generators for the Probability & Statistics → **Combinatorial
 * Analysis** subcategory covering dice sums, parity-by-symmetry, dice
 * comparison, and digit-ordering counting (re-homed from the former "General"
 * set; the geometric/area families moved to Geometric Probability).
 *
 * Every correct value is produced ONLY by the exact solvers in `../coreSolvers`;
 * every distractor is a re-derived, NAMED misconception guaranteed ≠ the answer
 * and distinct from the other distractors.
 *
 * Modes:
 *   • quiz   , genDiceSumQuiz, genParitySymmetry, genDieCompare
 *   • numeric, genDigitOrder
 */

/* ========================================================================== */
/* =====================  1. DICE-SUM QUIZ (quiz)  ======================== */
/* ========================================================================== */

/**
 * P(the total of two fair d`faces` dice ≤ T)  OR  P(total ∈ {a, a+1}). The
 * teaching point is the equally-likely SAMPLE SPACE: all faces² ORDERED outcomes
 * are equally likely, so (1,3) and (3,1) are two outcomes, not one.
 */
export function buildDiceSumQuizInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const faces = rng.pick([6, 8]);
  const denom = faces * faces;
  const unordered = (faces * (faces + 1)) / 2;
  const setMode = rng.chance(0.5);

  let value: Fraction;
  let fav: number;
  let prompt: string;
  let id: string;
  const distractors: Choice[] = [];

  if (!setMode) {
    // (i) P(total ≤ T)
    const T = rng.pick([3, 4, 5]);
    value = diceSumLEProb(2, faces, T);
    fav = Math.round(value.mul(denom).valueOf());

    prompt =
      `You roll two fair ${faces}-sided dice and add the pips. ` +
      `What is the probability the total comes out at most ${T}?`;
    id = `gen-dicesum-le-${faces}-${T}`;

    distractors.push(
      {
        text: fracText(F(fav, unordered)),
        rationale: `You treated (1,3) and (3,1) as the same outcome and divided by the ${unordered} unordered pairs. Keep the dice distinguishable, all ${denom} ORDERED outcomes are equally likely.`,
      },
      {
        text: fracText(diceSumLEProb(2, faces, T - 1)),
        rationale: `Off-by-one on the boundary: you excluded the total ${T} itself, but "at most ${T}" INCLUDES a total of exactly ${T}.`,
      },
      {
        text: fracText(F(fav - 1, denom)),
        rationale: `You dropped one favourable total, e.g. the single minimal outcome (1,1). The favourable count is ${fav}, not ${fav - 1}.`,
      },
    );
  } else {
    // (ii) P(total ∈ {a, a+1})
    const a = rng.pick([2, 3, 4]);
    value = diceSumInSetProb(faces, [a, a + 1]);
    fav = Math.round(value.mul(denom).valueOf());

    prompt =
      `You roll two fair ${faces}-sided dice and add the pips. ` +
      `What is the probability the total is either ${a} or ${a + 1}?`;
    id = `gen-dicesum-set-${faces}-${a}`;

    distractors.push(
      {
        text: fracText(F(fav, unordered)),
        rationale: `You treated (1,3) and (3,1) as the same outcome and divided by the ${unordered} unordered pairs. Keep the dice distinguishable, all ${denom} ORDERED outcomes are equally likely.`,
      },
      {
        text: fracText(diceSumInSetProb(faces, [a, a + 1, a + 2])),
        rationale: `Off-by-one: you swept in an extra neighbouring total (${a + 2}). The target set is only {${a}, ${a + 1}}.`,
      },
      {
        text: fracText(F(fav - 1, denom)),
        rationale: `You forgot one favourable total, the favourable count over {${a}, ${a + 1}} is ${fav}, not ${fav - 1}.`,
      },
    );
  }

  // Complement candidate: a fourth plausible option (P of the event NOT
  // happening), which also keeps four DISTINCT choices when two of the
  // misconception distractors above coincide for a particular (faces, target).
  distractors.push({
    text: fracText(F(1).sub(value)),
    rationale: `That's the complement: the probability the total does NOT meet the stated condition. The question asks for the event itself.`,
  });

  const correct: Choice = {
    text: fracText(value),
    rationale: `Correct, count the favourable ORDERED outcomes (${fav}) over the equally-likely sample space of ${denom} = ${faces}² outcomes: ${fracText(value)}.`,
  };

  const explanation =
    `Two fair d${faces} dice give ${denom} = ${faces}² equally-likely ORDERED outcomes. ` +
    `Counting the favourable ones (${fav} of them) gives ${fav}/${denom} = ${fracText(value)}. ` +
    `The classic slip is dividing by the ${unordered} UNORDERED pairs, but (1,3) and (3,1) are two distinct, equally-likely rolls.`;

  return {
    answer: fracText(value),
    question: {
      id,
      prompt,
      explanation,
      difficulty,
      concept: "Dice-sum probability (equally-likely ordered sample space)",
      source: "Combinatorial Analysis · Dice sums & symmetry",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/* ========================================================================== */
/* ================  2. PARITY BY SYMMETRY (quiz)  ======================== */
/* ========================================================================== */

const PARITY_COIN_TRAPS = [F(8, 15), F(9, 17), F(4, 9)];
const PARITY_DICE_TRAPS = [F(7, 13), F(5, 9), F(6, 11)];

/**
 * P(the total of `dice` fair d6 dice is even)  OR  P(an even count of heads in
 * `n` tosses). Both are EXACTLY ½ by a parity-pairing symmetry (flipping the
 * last die/coin toggles the running parity with prob ½ regardless of the rest).
 * The distractors are messy near-½ fractions, the values a binomial-sum
 * boundary error tends to produce instead of using the symmetry.
 */
export function buildParitySymmetryInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const coinMode = rng.chance(0.5);

  let value: Fraction;
  let prompt: string;
  let id: string;
  let traps: Fraction[];
  let mechanism: string;

  if (coinMode) {
    const n = rng.pick([256, 400, 512]);
    value = evenHeadsProb(n); // = 1/2
    traps = PARITY_COIN_TRAPS;
    mechanism = `flipping the last of the ${n} coins toggles the parity of the head-count with probability ½`;
    prompt =
      `${n} fair coins are all flipped at once. ` +
      `How likely is it that the tally of heads comes out even (a multiple of two)?`;
    id = `gen-parity-coin-${n}`;
  } else {
    const dice = rng.pick([2, 3, 4]);
    value = diceSumEvenProb(dice, 6); // = 1/2
    traps = PARITY_DICE_TRAPS;
    mechanism = `the last of the ${dice} dice makes the running total even with probability ½ regardless of the others`;
    prompt =
      `You roll ${dice} fair 6-sided dice and total the pips. ` +
      `How likely is that grand total to be even?`;
    id = `gen-parity-dice-${dice}`;
  }

  const correct: Choice = {
    text: fracText(value), // "1/2"
    rationale: `Correct, by symmetry ${mechanism}, so even and odd are equally likely: exactly ${fracText(value)}.`,
  };
  const distractors: Choice[] = traps.map((t) => ({
    text: fracText(t),
    rationale: `A trap value: this is the kind of messy fraction you get if you try to SUM the binomial terms and make an off-by-one / boundary error, instead of using the parity-pairing symmetry (which gives exactly ½).`,
  }));

  const explanation =
    `The answer is EXACTLY ${fracText(value)} by symmetry: ${mechanism}, pairing every outcome with a unique opposite-parity partner. ` +
    `The tempting messy fractions (${traps.map((t) => fracText(t)).join(", ")}) are what a botched binomial-sum with a boundary error looks like, the symmetry sidesteps all of that.`;

  return {
    answer: fracText(value),
    question: {
      id,
      prompt,
      explanation,
      difficulty,
      concept: "Parity by symmetry (answer is exactly ½)",
      source: "Combinatorial Analysis · Dice sums & symmetry",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/* ========================================================================== */
/* ==================  3. DIE COMPARISON (quiz)  ========================== */
/* ========================================================================== */

/**
 * (i) P(a second roll of a d`faces` is strictly less than the first) =
 * (1 − 1/faces)/2, the </> outcomes split the NON-tie mass equally. Or
 * (ii) P(a d`big` beats a d`small`) via conditioning on the big die. Both
 * hinge on correctly handling TIES / the overlap.
 */
export function buildDieCompareInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const selfMode = rng.chance(0.5);

  let value: Fraction;
  let prompt: string;
  let id: string;
  let concept: string;
  let explanation: string;
  const distractors: Choice[] = [];

  if (selfMode) {
    const faces = rng.pick([8, 10, 12, 20]);
    value = secondLessProb(faces); // (1 − 1/faces)/2
    id = `gen-diecmp-self-${faces}`;
    concept = "Dice comparison (halve the non-tie mass)";
    prompt =
      `The same fair ${faces}-faced die is thrown twice in succession. ` +
      `How likely is the SECOND result to land strictly below the FIRST?`;
    explanation =
      `P(second = first) = 1/${faces}, so the remaining 1 − 1/${faces} splits equally between "<" and ">". ` +
      `Hence P(second < first) = (1 − 1/${faces})/2 = ${fracText(value)}.`;
    distractors.push(
      {
        text: fracText(F(1, 2)),
        rationale: `Ignores TIES. P(second<first) = (1 − P(equal))/2 with P(equal) = 1/${faces} > 0, so it's below ½.`,
      },
      {
        text: fracText(F(1, faces)),
        rationale: `That's just P(a tie), 1/${faces}, not the chance the second roll is lower.`,
      },
      {
        text: fracText(F(faces - 1, faces)),
        rationale: `That's P(NOT a tie) = (${faces}−1)/${faces}. You still must halve it by the "<" vs ">" symmetry.`,
      },
    );
  } else {
    const [small, big] = rng.pick([
      [6, 10],
      [8, 12],
      [10, 20],
      [6, 20],
      [4, 6],
    ]);
    value = biggerDieProb(small, big);
    id = `gen-diecmp-pair-${small}-${big}`;
    concept = "Dice comparison (unequal dice, condition on the larger)";
    prompt =
      `Two fair dice of different sizes are thrown once each, one with ${small} faces and one with ${big} faces. ` +
      `What is the probability that the ${big}-face die outscores the ${small}-face die (comes up strictly greater)?`;
    explanation =
      `Condition on the d${big}. It exceeds ${small} outright w.p. (${big}−${small})/${big}; otherwise both land in 1..${small} and the strict-greater case is (${small}−1)/(2·${small}). ` +
      `Adding gives ${fracText(value)}.`;
    distractors.push(
      {
        text: fracText(F(big - small, big)),
        rationale: `Only counts the guaranteed-win region (${big}−${small})/${big}. You dropped the wins on the shared overlap 1..${small}.`,
      },
      {
        text: fracText(F(1, 2)),
        rationale: `Ignores the unequal die sizes, the larger die is favoured, so the answer isn't ½.`,
      },
      {
        text: fracText(F(small, big)),
        rationale: `Misuses the overlap fraction ${small}/${big}; that isn't the win probability.`,
      },
      // Extra candidates keep four DISTINCT options even when big = 2·small
      // makes the three above collapse (each reduces to ½ there).
      {
        text: fracText(F(1).sub(value)),
        rationale: `That's the complement P(the d${big} does NOT come out strictly ahead), i.e. it ties or loses. The question asks for a strict win.`,
      },
      {
        text: fracText(value.add(F(1, big))),
        rationale: `Counts TIES as wins (P(≥) instead of P(>)). A tie happens w.p. 1/${big}; subtract it for the strict-greater event.`,
      },
    );
  }

  const correct: Choice = {
    text: fracText(value),
    rationale: `Correct, ${fracText(value)}, handling the ${selfMode ? "tie mass" : "shared-overlap ties"} exactly.`,
  };

  return {
    answer: fracText(value),
    question: {
      id,
      prompt,
      explanation,
      difficulty,
      concept,
      source: "Combinatorial Analysis · Dice sums & symmetry",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

/* ========================================================================== */
/* ===================  4. DIGIT ORDERING (numeric)  ====================== */
/* ========================================================================== */

/**
 * (i) P(a uniform integer in [1, 10^L] has ALL digits distinct), or
 * (ii) P(the ones digit strictly exceeds the tens digit for a random 2-digit
 * integer) = 2/5. Sub-mode (ii) teaches the broken-symmetry trap: P(>) ≠ ½
 * because the ones digit ranges 0–9 while the tens digit ranges 1–9.
 */
export function buildDigitOrderInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const distinctMode = rng.chance(0.5);

  let value: Fraction;
  let prompt: string;
  let id: string;
  let explanation: string;
  const errorSpecs: { raw: Fraction; fb: string }[] = [];

  if (distinctMode) {
    const L = rng.pick([2, 4]);
    value = allDifferentDigitsProb(L);
    id = `gen-digits-distinct-${L}`;
    prompt =
      `An integer is picked uniformly from 1 up to ${10 ** L}. ` +
      `How likely is it that no two of its digits are equal (every digit used at most once)? (Round to {dp} decimals.)`;
    explanation =
      `Count integers in [1, ${10 ** L}] whose digits never repeat, summing over each digit-length, then divide by ${10 ** L}: ${fracText(value)}. ` +
      `Padding with leading zeros or treating each digit as independently 9/10 both mis-count, because every new digit must avoid ALL previously used digits.`;
    // Permutations of L distinct digits from all 10, ALLOWING a leading zero.
    let perm = 1;
    for (let i = 0; i < L; i++) perm *= 10 - i;
    errorSpecs.push(
      {
        raw: F(1).sub(value),
        fb: `That's the complement, the probability that SOME digit repeats.`,
      },
      {
        raw: F(9 ** L, 10 ** L),
        fb: `You treated each digit as independently avoiding one value (9/10 each), i.e. (9/10)^${L}. But each new digit must avoid every earlier digit, so the choices shrink 9, 8, 7, …`,
      },
      {
        raw: F(perm, 10 ** L),
        fb: `You counted permutations of ${L} distinct digits out of 10 (${perm}) but let the leading digit be 0, a genuine number in this range can't start with a padded zero.`,
      },
      {
        raw: F(1).sub(F(9 ** L, 10 ** L)),
        fb: `This compounds the independence shortcut (9/10)^${L} with its complement, two mistakes stacked.`,
      },
    );
  } else {
    value = onesGreaterThanTensProb(); // 2/5
    id = `gen-digits-onesgt`;
    prompt =
      `Pick one of the two-digit numbers 10–99, each equally likely. ` +
      `How often does the units place exceed the tens place (the last digit beats the first)? (Round to {dp} decimals.)`;
    explanation =
      `Among the 90 numbers 10–99, the favourable count is Σ over tens 1–9 of (9−tens) = 36, so the probability is 36/90 = ${fracText(value)}. ` +
      `It is NOT ½: the ones digit ranges 0–9 but the tens digit only 1–9, so P(ones>tens) < P(ones<tens); the ties P(ones=tens) also carve out mass.`;
    errorSpecs.push(
      {
        raw: F(1, 2),
        fb: `You assumed P(ones>tens)=½ by symmetry. But the ones digit ranges 0–9 while tens ranges 1–9, so the two directions aren't symmetric and ties have positive probability.`,
      },
      {
        raw: F(36, 100),
        fb: `You used all 100 strings 00–99 in the denominator instead of the 90 genuine 2-digit numbers 10–99.`,
      },
      {
        raw: F(36, 81),
        fb: `You restricted the ones digit to 1–9 (forgetting 0 is allowed), leaving 81 equally-likely pairs with 36 favourable → 4/9.`,
      },
    );
  }

  const dp = numDp(value);
  const answer = Number(decText(value, dp));
  prompt = prompt.replace("{dp}", String(dp));

  const { errors, push } = numericErrors(answer, dp);
  for (const spec of errorSpecs) push(spec.raw, spec.fb);

  return {
    answer,
    numeric: {
      id,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Digit-ordering / distinct-digit counting",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Combinatorial Analysis · Digit & integer counting",
    },
  };
}

/* ========================================================================== */
/*  Named generators (adapters)                                                */
/* ========================================================================== */

// QUIZ (Question)
export const genDiceSumQuiz = (rng: Rng): Question => buildDiceSumQuizInstance(rng, "easy").question;
export const genParitySymmetry = (rng: Rng): Question => buildParitySymmetryInstance(rng, "easy").question;
export const genDieCompare = (rng: Rng): Question => buildDieCompareInstance(rng, "medium").question;

// NUMERIC (NumericQuestion)
export const genDigitOrder = (rng: Rng): NumericQuestion => buildDigitOrderInstance(rng, "easy").numeric;

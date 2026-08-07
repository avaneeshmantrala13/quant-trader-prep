import type { Rng } from "@/lib/rng";
import type {
  Difficulty,
  NumericQuestion,
  Question,
  QuestionGenerator,
} from "@/types/content";
import { assemble, assembleDistinct, fmt, fracStr, pct, round } from "../shared";
import { mixQuestionGenerators } from "../mixFamilies";

/**
 * Mental-math generators in the timed, exact-arithmetic mold many quant firms
 * screen candidates on: fast, exact arithmetic. Every answer is computed directly, so
 * it is correct by construction. Distractors are *plausible slips*, place-value
 * (×10) errors, dropped carries/terms, and transpositions, not random numbers.
 */

const near = (n: number, d: number) => fmt(n + d);

function genAddition(rng: Rng): Question {
  const a = rng.int(120, 989);
  const b = rng.int(120, 989);
  const c = a + b;
  return assemble(rng, {
    id: `mm-add-${a}-${b}`,
    prompt: `${a} + ${b} = ?`,
    correct: fmt(c),
    distractors: [near(c, 10), near(c, -10), near(c, 100), near(c, -1)],
    explanation: `${a} + ${b} = ${fmt(c)}. Add hundreds, then tens, then ones and combine.`,
    difficulty: "easy",
    concept: "Addition",
    distractorRationaleByValue: {
      [near(c, 10)]: "Dropped a carry into the tens column (+10).",
      [near(c, -10)]: "Missed a carry out of the tens column (−10).",
      [near(c, 100)]: "Carry slipped into the hundreds column (+100).",
      [near(c, -1)]: "Ones-column off-by-one.",
    },
    source: "Zetamac-style addition",
  });
}

function genSubtraction(rng: Rng): Question {
  const a = rng.int(400, 990);
  const b = rng.int(110, a - 50);
  const c = a - b;
  return assemble(rng, {
    id: `mm-sub-${a}-${b}`,
    prompt: `${a} − ${b} = ?`,
    correct: fmt(c),
    distractors: [near(c, 10), near(c, -10), near(c, 1), near(c, 100)],
    explanation: `${a} − ${b} = ${fmt(c)}.`,
    difficulty: "easy",
    concept: "Subtraction",
    distractorRationaleByValue: {
      [near(c, 10)]: "Borrow error in the tens column (+10).",
      [near(c, -10)]: "Borrow error in the tens column (−10).",
      [near(c, 1)]: "Ones-column off-by-one.",
      [near(c, 100)]: "Borrow error in the hundreds column.",
    },
    source: "Zetamac-style subtraction",
  });
}

function genMultiply2x1(rng: Rng): Question {
  const a = rng.int(12, 99);
  const b = rng.int(3, 9);
  const c = a * b;
  return assemble(rng, {
    id: `mm-mul21-${a}-${b}`,
    prompt: `${a} × ${b} = ?`,
    correct: fmt(c),
    distractors: [fmt(a * b + a), fmt(a * b - a), fmt(a * b + b), fmt(a * (b - 1))],
    explanation: `${a} × ${b} = ${fmt(c)}. Split ${a} into tens and ones: (${Math.floor(a / 10) * 10}×${b}) + (${a % 10}×${b}).`,
    difficulty: "easy",
    concept: "Multiplication",
    distractorRationaleByValue: {
      [fmt(a * b + a)]: `Multiplied by ${b + 1} instead of ${b} (one extra group of ${a}).`,
      [fmt(a * b - a)]: `Multiplied by ${b - 1} (one group of ${a} short).`,
      [fmt(a * b + b)]: "Added an extra ones-digit product.",
      [fmt(a * (b - 1))]: "Off-by-one in the multiplier.",
    },
    source: "Speed multiplication (two-digit)",
  });
}

function genMultiply2x2(rng: Rng): Question {
  const a = rng.int(13, 49);
  const b = rng.int(13, 49);
  const c = a * b;
  // Common slip: forgetting one of the four partial-product cross terms.
  const missCross = Math.floor(a / 10) * 10 * b + (a % 10) * (b % 10); // drop ones×tens
  return assemble(rng, {
    id: `mm-mul22-${a}-${b}`,
    prompt: `${a} × ${b} = ?`,
    correct: fmt(c),
    distractors: [fmt(missCross), fmt(c + a), fmt(c - b), fmt(c + 100)],
    explanation: `${a} × ${b} = ${fmt(c)}. Use (a)(b) = (${Math.floor(a / 10) * 10}+${a % 10})(${b}) = ${Math.floor(a / 10) * 10 * b} + ${(a % 10) * b}.`,
    difficulty: "medium",
    concept: "Multiplication",
    distractorRationaleByValue: {
      [fmt(missCross)]: "Forgot one of the four cross-terms in the expansion.",
      [fmt(c + a)]: "Counted an extra group of the first factor.",
      [fmt(c - b)]: "One group of the second factor short.",
      [fmt(c + 100)]: "Place-value carry slip (+100).",
    },
    source: "Two-digit cross-term multiplication",
  });
}

function genDivision(rng: Rng): Question {
  const b = rng.int(3, 19);
  const q = rng.int(11, 89);
  const a = b * q; // exact division
  return assemble(rng, {
    id: `mm-div-${a}-${b}`,
    prompt: `${a} ÷ ${b} = ?`,
    correct: fmt(q),
    distractors: [fmt(q + 1), fmt(q - 1), fmt(q + 10), fmt(Math.round(a / (b + 1)))],
    explanation: `${a} ÷ ${b} = ${fmt(q)} because ${b} × ${fmt(q)} = ${fmt(a)}.`,
    difficulty: "medium",
    concept: "Division",
    distractorRationaleByValue: {
      [fmt(q + 1)]: "Overshot the quotient by one.",
      [fmt(q - 1)]: "Undershot the quotient by one.",
      [fmt(q + 10)]: "Place-value slip in the quotient (+10).",
      [fmt(Math.round(a / (b + 1)))]: "Divided by the wrong divisor.",
    },
    source: "Zetamac-style division",
  });
}

function genPercent(rng: Rng): Question {
  const p = rng.pick([5, 10, 12, 15, 20, 25, 30, 40, 75]);
  const base = rng.int(4, 40) * 10; // multiple of 10
  const c = (p / 100) * base;
  return assemble(rng, {
    id: `mm-pct-${p}-${base}`,
    prompt: `What is ${p}% of ${fmt(base)}?`,
    correct: fmt(c),
    distractors: [fmt(c * 10), fmt(c / 10), fmt(base * p), fmt(round(base / p, 2))],
    explanation: `${p}% of ${fmt(base)} = ${p}/100 × ${fmt(base)} = ${fmt(c)}.`,
    difficulty: "easy",
    concept: "Percentages",
    distractorRationaleByValue: {
      [fmt(c * 10)]: "Misplaced the decimal (×10 too big).",
      [fmt(c / 10)]: "Misplaced the decimal (÷10 too small).",
      [fmt(base * p)]: "Forgot to divide by 100.",
      [fmt(round(base / p, 2))]: "Divided base by the percent instead of multiplying.",
    },
    source: "Trading-interview percentage drill",
  });
}

/** Reduce a fraction to lowest terms; returns the numerator/denominator the
 * learner actually SEES in the prompt (via `fracStr`). All coaching and the
 * explanation must reference THESE numbers, not the raw draw (audit D3). */
function reduceFraction(num: number, den: number): { rn: number; rd: number } {
  let a = Math.abs(num);
  let b = Math.abs(den);
  while (b) [a, b] = [b, a % b];
  const g = a || 1;
  return { rn: num / g, rd: den / g };
}

function genFractionToDecimal(rng: Rng): Question {
  const den = rng.pick([4, 5, 8, 10, 16, 20, 25]);
  const num = rng.int(1, den - 1);
  const c = num / den;
  // The prompt shows the REDUCED fraction (fracStr reduces), so every distractor
  // rationale and the explanation must speak about the reduced numerator (rn) /
  // denominator (rd) — never the raw draw (audit D3).
  const { rn, rd } = reduceFraction(num, den);
  return assemble(rng, {
    id: `mm-frac-${num}-${den}`,
    prompt: `Express ${fracStr(num, den)} as a decimal.`,
    correct: fmt(c, 4),
    distractors: [
      fmt(round(rd / rn, 4), 4),
      fmt(round(c * 10, 4), 4),
      fmt(round(rn / (rd + 1), 4), 4),
    ],
    explanation: `${fracStr(num, den)} = ${rn} ÷ ${rd} = ${fmt(c, 4)}.`,
    difficulty: "medium",
    concept: "Fraction↔decimal",
    distractorRationaleByValue: {
      [fmt(round(rd / rn, 4), 4)]: `Inverted the fraction (${rd} ÷ ${rn}).`,
      [fmt(round(c * 10, 4), 4)]: "Decimal-place slip (×10).",
      [fmt(round(rn / (rd + 1), 4), 4)]: `Used ${rd + 1} on the bottom; the denominator is ${rd}.`,
    },
    source: "Odds/decimal conversion drill",
  });
}

function genOddsToProb(rng: Rng): Question {
  return assembleDistinct(rng, (r) => {
    // "Odds of a:b against" → probability = b/(a+b) of the event happening.
    const a = r.int(1, 7);
    const b = r.int(1, 7);
    const c = b / (a + b);
    return {
      id: `mm-odds-${a}-${b}`,
      prompt: `If the odds against an event are ${a} : ${b}, what is the probability the event happens? (as a %)`,
      correct: pct(c, 1),
      distractors: [
        pct(a / (a + b), 1),
        pct(b / a > 1 ? a / b : b / a, 1),
        pct(round(a / (a + b + 1), 4), 1),
      ],
      explanation: `Odds ${a}:${b} against means ${b} favorable to ${a} unfavorable, so P = ${b}/(${a}+${b}) = ${pct(c, 1)}.`,
      difficulty: "hard" as const,
      concept: "Odds↔probability",
      distractorRationaleByValue: {
        [pct(a / (a + b), 1)]: "Used the unfavorable count in the numerator (odds direction flipped).",
        [pct(b / a > 1 ? a / b : b / a, 1)]: "Reported the odds ratio itself, not a probability.",
        [pct(round(a / (a + b + 1), 4), 1)]: "Miscounted the total outcomes in the denominator.",
      },
      source: "Odds↔probability conversion (market-making prerequisite)",
    };
  });
}

export const MM_EASY: QuestionGenerator[] = [
  genAddition,
  genSubtraction,
  genMultiply2x1,
  genPercent,
];

export const MM_MEDIUM: QuestionGenerator[] = [
  genMultiply2x1,
  genMultiply2x2,
  genDivision,
  genPercent,
  genFractionToDecimal,
];

export const MM_HARD: QuestionGenerator[] = [
  genMultiply2x2,
  genDivision,
  genFractionToDecimal,
  genOddsToProb,
];

/**
 * Build a mixed generator over a pool of sub-generators. Delegates to the shared
 * family-tagging mixer so each item is stamped with its family and the returned
 * callable exposes a `.families` lookup for family-preserving regeneration.
 */
export function mixed(pool: QuestionGenerator[]): QuestionGenerator {
  return mixQuestionGenerators(pool);
}

export const ALL_MM_GENERATORS = {
  genAddition,
  genSubtraction,
  genMultiply2x1,
  genMultiply2x2,
  genDivision,
  genPercent,
  genFractionToDecimal,
  genOddsToProb,
};

/* ========================================================================== */
/* ===================  FREE-RESPONSE (numeric) CONVERSION  ================= */
/* ========================================================================== */

/**
 * MCQ → free-response conversion of the arithmetic drills (mirrors the geo-1
 * pattern). Each `build<Family>NumericInstance` computes the SAME answer as its
 * quiz sibling with the SAME exact arithmetic, and re-derives 2–5 GENUINE,
 * parametrically-computable slip values as a tagged error-mode catalog:
 *   • rung-1 coaching NAMES the arithmetic slip + asks a leading question,
 *     never revealing the answer;
 *   • rung-5 `explanation` is the worked computation;
 *   • the learner types a number, graded by `gradeFreeResponse`.
 *
 * These numeric generators are deliberately NOT added to `ALL_MM_GENERATORS`
 * (which stays quiz-only for the shared registry test); the levels reference the
 * adapters directly via `mixNumericGenerators`.
 */

/** Local decimals→answer helper: fewest places to represent `value`, ≤ `cap`. */
function decimalsNeeded(value: number, cap = 4): number {
  for (let dp = 0; dp < cap; dp++) {
    const f = 10 ** dp;
    if (Math.round(value * f) / f === value) return dp;
  }
  return cap;
}

/**
 * Local replicate of the probabilityStats `numericErrors` accumulator (numbers
 * only): dedupes wrong values against the answer (at `dp`) and carries an
 * optional machine-readable `misconception` tag onto each entry.
 */
function numericErrors(
  answer: number,
  dp: number,
): {
  errors: { value: number; feedback: string; misconception?: string }[];
  push: (raw: number, feedback: string, misconception?: string) => void;
} {
  const f = 10 ** dp;
  const seen = new Set<number>([Math.round(answer * f)]);
  const errors: { value: number; feedback: string; misconception?: string }[] =
    [];
  const push = (raw: number, feedback: string, misconception?: string) => {
    if (!Number.isFinite(raw)) return;
    const rounded = Math.round(raw * f) / f;
    const k = Math.round(rounded * f);
    if (seen.has(k)) return;
    seen.add(k);
    errors.push({
      value: rounded,
      feedback,
      ...(misconception ? { misconception } : {}),
    });
  };
  return { errors, push };
}

/* -----------------------------  Addition  -------------------------------- */

export function buildAdditionNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const a = rng.int(120, 989);
  const b = rng.int(120, 989);
  const answer = a + b;

  const { errors, push } = numericErrors(answer, 0);
  push(
    answer - 10,
    `Close, that's 10 short. Did a carry out of the ones column get dropped? Re-add the tens.`,
    "off_by_carry",
  );
  push(
    answer + 100,
    `That's 100 too big, a carry leaked into the hundreds column. Which column actually overflowed?`,
    "place_value_slip",
  );
  push(
    answer - 1,
    `Off by one in the ones column. Add the ones digits again carefully.`,
    "off_by_one",
  );

  return {
    answer,
    numeric: {
      id: `mm-add-num-${a}-${b}`,
      prompt: `${a} + ${b} = ? (Enter the number.)`,
      answer,
      difficulty,
      concept: "Addition",
      explanation: `${a} + ${b} = ${fmt(answer)}. Add hundreds, then tens, then ones and combine.`,
      unit: "",
      commonErrors: errors,
      source: "Zetamac-style addition",
    },
  };
}

/* ----------------------------  Subtraction  ------------------------------ */

export function buildSubtractionNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const a = rng.int(400, 990);
  const b = rng.int(110, a - 50);
  const answer = a - b;

  const { errors, push } = numericErrors(answer, 0);
  push(
    answer + 10,
    `That's 10 too high, a borrow in the tens column went the wrong way. Recheck the tens.`,
    "off_by_carry",
  );
  push(
    answer - 100,
    `That's 100 short, a borrow out of the hundreds column got mishandled. Which column did you borrow from?`,
    "place_value_slip",
  );
  push(
    b - a,
    `Looks like you subtracted the larger number from the smaller, which number is on top?`,
    "swapped_operands",
  );

  return {
    answer,
    numeric: {
      id: `mm-sub-num-${a}-${b}`,
      prompt: `${a} − ${b} = ? (Enter the number.)`,
      answer,
      difficulty,
      concept: "Subtraction",
      explanation: `${a} − ${b} = ${fmt(answer)}. Subtract ones, then tens, then hundreds, borrowing where a column would go negative.`,
      unit: "",
      commonErrors: errors,
      source: "Zetamac-style subtraction",
    },
  };
}

/* ---------------------------  Multiply 2×1  ------------------------------ */

export function buildMultiply2x1NumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const a = rng.int(12, 99);
  const b = rng.int(3, 9);
  const answer = a * b;

  const { errors, push } = numericErrors(answer, 0);
  push(
    a + b,
    `Did you ADD instead of multiply? ${a} × ${b} asks how many you get from ${b} groups of ${a}.`,
    "operation_confused",
  );
  push(
    answer + a,
    `That's one extra group of ${a}, are you multiplying by exactly ${b}, not ${b + 1}?`,
    "off_by_one",
  );
  push(
    answer - a,
    `That's one group of ${a} short, did you multiply by ${b - 1} instead of ${b}?`,
    "off_by_one",
  );

  return {
    answer,
    numeric: {
      id: `mm-mul21-num-${a}-${b}`,
      prompt: `${a} × ${b} = ? (Enter the number.)`,
      answer,
      difficulty,
      concept: "Multiplication",
      explanation: `${a} × ${b} = ${fmt(answer)}. Split ${a} into tens and ones: (${Math.floor(a / 10) * 10}×${b}) + (${a % 10}×${b}).`,
      unit: "",
      commonErrors: errors,
      source: "Speed multiplication (two-digit)",
    },
  };
}

/* ---------------------------  Multiply 2×2  ------------------------------ */

export function buildMultiply2x2NumericInstance(
  rng: Rng,
  difficulty: Difficulty,
  /**
   * OPTIONAL factor ranges. Omitted → the original 2-digit × 2-digit behaviour
   * (unchanged for lessons / Speed Arena). The mock arithmetic gate passes a
   * wider `aRange` to draw genuine 3-digit × 2-digit problems.
   */
  opts?: { aRange?: [number, number]; bRange?: [number, number] },
): { answer: number; numeric: NumericQuestion } {
  const a = rng.int(opts?.aRange?.[0] ?? 13, opts?.aRange?.[1] ?? 49);
  const b = rng.int(opts?.bRange?.[0] ?? 13, opts?.bRange?.[1] ?? 49);
  const answer = a * b;
  const missCross = Math.floor(a / 10) * 10 * b + (a % 10) * (b % 10);

  const { errors, push } = numericErrors(answer, 0);
  push(
    missCross,
    `You lost one of the four cross-products in (tens+ones)(tens+ones), did you include BOTH tens×ones and ones×tens?`,
    "dropped_cross_term",
  );
  push(
    answer + a,
    `That's one extra group of ${a}, recount the partial products, don't add a spare row.`,
    "off_by_one",
  );
  push(
    answer + 100,
    `That's 100 too big, a partial product landed one place-value column too high.`,
    "place_value_slip",
  );

  return {
    answer,
    numeric: {
      id: `mm-mul22-num-${a}-${b}`,
      prompt: `${a} × ${b} = ? (Enter the number.)`,
      answer,
      difficulty,
      concept: "Multiplication",
      explanation: `${a} × ${b} = ${fmt(answer)}. Expand (${Math.floor(a / 10) * 10}+${a % 10})(${b}) = ${Math.floor(a / 10) * 10 * b} + ${(a % 10) * b}.`,
      unit: "",
      commonErrors: errors,
      source: "Two-digit cross-term multiplication",
    },
  };
}

/* ------------------------------  Division  ------------------------------- */

export function buildDivisionNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
  /**
   * OPTIONAL divisor / quotient ranges. Omitted → the original behaviour
   * (unchanged for lessons / Speed Arena). The mock gate passes a 2-digit
   * `divisor` range so the dividend is always a genuine 3-digit ÷ 2-digit.
   */
  opts?: { divisor?: [number, number]; quotient?: [number, number] },
): { answer: number; numeric: NumericQuestion } {
  const b = rng.int(opts?.divisor?.[0] ?? 3, opts?.divisor?.[1] ?? 19);
  const q = rng.int(opts?.quotient?.[0] ?? 11, opts?.quotient?.[1] ?? 89);
  const a = b * q;
  const answer = q;

  const { errors, push } = numericErrors(answer, 0);
  push(
    q + 1,
    `Overshot by one, does ${b} × your answer land back on ${fmt(a)}?`,
    "off_by_one",
  );
  push(
    q + 10,
    `That's ten too many, check the tens digit of the quotient.`,
    "place_value_slip",
  );
  push(
    Math.round(a / (b + 1)),
    `Looks like you divided by ${b + 1}, the divisor is ${b}.`,
    "wrong_denominator",
  );

  return {
    answer,
    numeric: {
      id: `mm-div-num-${a}-${b}`,
      prompt: `${fmt(a)} ÷ ${b} = ? (Enter the number.)`,
      answer,
      difficulty,
      concept: "Division",
      explanation: `${fmt(a)} ÷ ${b} = ${fmt(q)} because ${b} × ${fmt(q)} = ${fmt(a)}. Divide from the most significant digit, then verify by multiplying the quotient back.`,
      unit: "",
      commonErrors: errors,
      source: "Zetamac-style division",
    },
  };
}

/* -----------------------------  Percentage  ------------------------------ */

export function buildPercentNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
  /**
   * OPTIONAL percent multipliers. Omitted → the original set (unchanged for
   * lessons / Speed Arena). The mock gate passes a set that excludes the
   * memorised shifts/quarters (5/10/20/25/50) so every gate item is genuinely
   * computed.
   */
  opts?: { ps?: number[] },
): { answer: number; numeric: NumericQuestion } {
  const p = rng.pick(opts?.ps ?? [5, 10, 12, 15, 20, 25, 30, 40, 75]);
  const base = rng.int(4, 40) * 10;
  const value = (p / 100) * base;
  const dp = decimalsNeeded(value, 2);
  const answer = Number(value.toFixed(dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    base * p,
    `You used ${p} as a whole number, but a percent is ${p}/100, what do you divide by?`,
    "percent_as_whole",
  );
  push(
    value * 10,
    `That's ten times too big, recheck where the decimal sits when you take 10% first.`,
    "place_value_slip",
  );
  push(
    round(base / p, 2),
    `You divided ${fmt(base)} by ${p}, but "percent OF" means multiply, not divide.`,
    "operation_confused",
  );

  return {
    answer,
    numeric: {
      id: `mm-pct-num-${p}-${base}`,
      prompt: `What is ${p}% of ${fmt(base)}? (Enter the number.)`,
      answer,
      decimals: dp,
      difficulty,
      concept: "Percentages",
      explanation: `${p}% of ${fmt(base)} = ${p}/100 × ${fmt(base)} = ${fmt(value)}. Convert the percent to a decimal (shift two places left), then multiply by the base.`,
      unit: "",
      commonErrors: errors,
      source: "Trading-interview percentage drill",
    },
  };
}

/* -------------------------  Fraction → decimal  -------------------------- */

export function buildFractionToDecimalNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
  /**
   * OPTIONAL denominator set. Omitted → the original set (unchanged for lessons
   * / Speed Arena, which legitimately teach easy fractions). The mock gate
   * passes {8,16,20,25} and additionally rejects any draw whose REDUCED form is
   * trivial, so it never renders a memorised freebie like 1/2 or 1/4.
   */
  opts?: { dens?: number[] },
): { answer: number; numeric: NumericQuestion } {
  const den = rng.pick(opts?.dens ?? [4, 5, 8, 10, 16, 20, 25]);
  const num = rng.int(1, den - 1);
  const value = num / den;
  const dp = Math.max(2, decimalsNeeded(value, 4));
  const answer = Number(value.toFixed(dp));
  // The prompt renders the REDUCED fraction (fracStr reduces), so the coaching
  // and explanation must cite the reduced numerator (rn) / denominator (rd),
  // not the raw draw — otherwise "3/5" is coached as "the denominator is 10"
  // (audit D3).
  const { rn, rd } = reduceFraction(num, den);

  const { errors, push } = numericErrors(answer, dp);
  push(
    rd / rn,
    `You divided ${rd} by ${rn}, which number is the numerator and which the denominator?`,
    "inverted_fraction",
  );
  push(
    rn / (rd + 1),
    `You used ${rd + 1} on the bottom, the denominator is ${rd}.`,
    "wrong_denominator",
  );
  push(
    value * 10,
    `The decimal point is one place off, that answer is ten times too big.`,
    "place_value_slip",
  );

  return {
    answer,
    numeric: {
      id: `mm-frac-num-${num}-${den}`,
      prompt: `Express ${fracStr(num, den)} as a decimal. (Enter a decimal.)`,
      answer,
      decimals: dp,
      difficulty,
      concept: "Fraction↔decimal",
      explanation: `${fracStr(num, den)} = ${rn} ÷ ${rd} = ${answer.toFixed(dp)}. Divide the numerator by the denominator to convert the fraction to a decimal.`,
      unit: "",
      commonErrors: errors,
      source: "Odds/decimal conversion drill",
    },
  };
}

/* ------------------------  Odds → probability  --------------------------- */

export function buildOddsToProbNumericInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const a = rng.int(1, 7);
  const b = rng.int(1, 7);
  const value = b / (a + b); // odds a:b AGAINST → P(event) = b/(a+b)
  const dp = Math.max(2, decimalsNeeded(value, 4));
  const answer = Number(value.toFixed(dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    a / (a + b),
    `That's the chance the event does NOT happen. Odds ${a}:${b} AGAINST put the ${b} favourable outcomes on top, which count is favourable?`,
    "odds_direction_flipped",
  );
  push(
    a < b ? a / b : b / a,
    `That's the odds ratio itself, not a probability. A probability is favourable ÷ TOTAL, what is the total?`,
    "odds_ratio_as_prob",
  );
  push(
    b / (a + b + 1),
    `You added one too many to the total, the denominator is ${a} + ${b}.`,
    "wrong_denominator",
  );

  return {
    answer,
    numeric: {
      id: `mm-odds-num-${a}-${b}`,
      prompt: `If the odds against an event are ${a} : ${b}, what is the probability the event happens? (Enter a decimal.)`,
      answer,
      decimals: dp,
      difficulty,
      concept: "Odds↔probability",
      explanation: `Odds ${a}:${b} against means ${b} favourable to ${a} unfavourable, so P = ${b}/(${a}+${b}) = ${answer.toFixed(dp)}.`,
      unit: "",
      commonErrors: errors,
      source: "Odds↔probability conversion (market-making prerequisite)",
    },
  };
}

/* --------------------  Named numeric generators (adapters)  -------------- */

export const genAdditionNumeric = (rng: Rng): NumericQuestion =>
  buildAdditionNumericInstance(rng, "easy").numeric;
export const genSubtractionNumeric = (rng: Rng): NumericQuestion =>
  buildSubtractionNumericInstance(rng, "easy").numeric;
export const genMultiply2x1Numeric = (rng: Rng): NumericQuestion =>
  buildMultiply2x1NumericInstance(rng, "easy").numeric;
export const genMultiply2x2Numeric = (rng: Rng): NumericQuestion =>
  buildMultiply2x2NumericInstance(rng, "medium").numeric;
export const genDivisionNumeric = (rng: Rng): NumericQuestion =>
  buildDivisionNumericInstance(rng, "medium").numeric;
export const genPercentNumeric = (rng: Rng): NumericQuestion =>
  buildPercentNumericInstance(rng, "easy").numeric;
export const genFractionToDecimalNumeric = (rng: Rng): NumericQuestion =>
  buildFractionToDecimalNumericInstance(rng, "medium").numeric;
export const genOddsToProbNumeric = (rng: Rng): NumericQuestion =>
  buildOddsToProbNumericInstance(rng, "hard").numeric;

type NumericQuestionAdapter = (rng: Rng) => NumericQuestion;

/** Numeric analog of the MM_* pools (free-response, family-tagged in levels). */
export const MM_EASY_NUMERIC: NumericQuestionAdapter[] = [
  genAdditionNumeric,
  genSubtractionNumeric,
  genMultiply2x1Numeric,
  genPercentNumeric,
];

export const MM_MEDIUM_NUMERIC: NumericQuestionAdapter[] = [
  genMultiply2x1Numeric,
  genMultiply2x2Numeric,
  genDivisionNumeric,
  genPercentNumeric,
  genFractionToDecimalNumeric,
];

export const MM_HARD_NUMERIC: NumericQuestionAdapter[] = [
  genMultiply2x2Numeric,
  genDivisionNumeric,
  genFractionToDecimalNumeric,
  genOddsToProbNumeric,
];

export const MM_CONVERSIONS_NUMERIC: NumericQuestionAdapter[] = [
  genPercentNumeric,
  genFractionToDecimalNumeric,
  genOddsToProbNumeric,
];

/** All numeric generators, keyed by name (for the round-trip coverage test). */
export const ALL_MM_NUMERIC_GENERATORS = {
  genAdditionNumeric,
  genSubtractionNumeric,
  genMultiply2x1Numeric,
  genMultiply2x2Numeric,
  genDivisionNumeric,
  genPercentNumeric,
  genFractionToDecimalNumeric,
  genOddsToProbNumeric,
};

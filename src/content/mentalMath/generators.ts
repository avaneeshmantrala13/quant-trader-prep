import type { Rng } from "@/lib/rng";
import type { Question, QuestionGenerator } from "@/types/content";
import { assemble, assembleDistinct, fmt, fracStr, pct, round } from "../shared";
import { mixQuestionGenerators } from "../mixFamilies";

/**
 * Mental-math generators in the Zetamac / Optiver "80-in-8" / Jane Street
 * "60-in-8" mold: fast, exact arithmetic. Every answer is computed directly, so
 * it is correct by construction. Distractors are *plausible slips* — place-value
 * (×10) errors, dropped carries/terms, and transpositions — not random numbers.
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
    source: "Optiver-style speed multiplication",
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
    source: "Jane Street-style 2×2 multiplication",
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

function genFractionToDecimal(rng: Rng): Question {
  const den = rng.pick([4, 5, 8, 10, 16, 20, 25]);
  const num = rng.int(1, den - 1);
  const c = num / den;
  return assemble(rng, {
    id: `mm-frac-${num}-${den}`,
    prompt: `Express ${fracStr(num, den)} as a decimal.`,
    correct: fmt(c, 4),
    distractors: [
      fmt(round(den / num, 4), 4),
      fmt(round(c * 10, 4), 4),
      fmt(round(num / (den + 1), 4), 4),
    ],
    explanation: `${fracStr(num, den)} = ${num} ÷ ${den} = ${fmt(c, 4)}.`,
    difficulty: "medium",
    concept: "Fraction↔decimal",
    distractorRationaleByValue: {
      [fmt(round(den / num, 4), 4)]: "Inverted the fraction (den ÷ num).",
      [fmt(round(c * 10, 4), 4)]: "Decimal-place slip (×10).",
      [fmt(round(num / (den + 1), 4), 4)]: "Used the wrong denominator.",
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

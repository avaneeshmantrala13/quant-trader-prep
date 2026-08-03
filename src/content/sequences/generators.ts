import type { Rng } from "@/lib/rng";
import type {
  Difficulty,
  NumericQuestion,
  NumericQuestionGenerator,
  QuestionGenerator,
} from "@/types/content";
import { assembleDistinct, type QuestionParts } from "../shared";
import {
  alternatingOp,
  alternatingShift,
  analogyMul,
  arithmetic,
  caesar,
  fibonacciLike,
  findOddByDivisor,
  geometric,
  interleaved,
  quadratic,
  type LetterSolution,
  type SeqSolution,
} from "./solvers";

/**
 * Parametric generators for the Sequences & Pattern-Recognition family (T2).
 *
 * Every answer is re-derived by an EXACT solver in `solvers.ts` (never a
 * hardcoded list); distractors encode NAMED rule-misreads (off-by-one
 * continuation, wrong operation, used the previous term, treated one rule as
 * another) and are FORMAT-PARITY with the answer (all integers, or all single
 * letters) so no option leaks the answer by shape.
 *
 * Two registries are exported:
 *   - {@link SEQUENCE_QUIZ_GENERATORS}    — MCQ "what comes next?"  (10 families)
 *   - {@link SEQUENCE_NUMERIC_GENERATORS} — free-entry "type the next number"
 *
 * Each produced item carries a stable `family` id (matching its registry key)
 * so a future integrator / regenerator can re-run THAT family with a fresh seed.
 */

const SOURCE = "Sequences & Pattern Recognition";
const S = (v: number): string => String(v);

/* -------------------------------------------------------------------------- */
/*  Shared assembly helpers                                                     */
/* -------------------------------------------------------------------------- */

/** Build the rationale/misconception maps + distractor list from misreads. */
function numericMaps(sol: SeqSolution): {
  distractors: string[];
  rationale: Record<string, string>;
  misc: Record<string, string>;
} {
  const rationale: Record<string, string> = {};
  const misc: Record<string, string> = {};
  const distractors: string[] = [];
  for (const m of sol.misreads) {
    const key = S(m.value);
    distractors.push(key);
    rationale[key] = m.why;
    misc[key] = m.tag;
  }
  return { distractors, rationale, misc };
}

/** Assemble a numeric-sequence "what comes next?" MCQ from a solved sequence. */
function numericSeqParts(
  sol: SeqSolution,
  opts: {
    idBase: string;
    concept: string;
    difficulty: Difficulty;
    rule: string;
  },
): QuestionParts {
  const { distractors, rationale, misc } = numericMaps(sol);
  const shown = sol.seq.join(", ");
  return {
    id: `${opts.idBase}-${sol.seq.join("-")}`,
    prompt: `What number comes next in the sequence?  ${shown}, ___`,
    correct: S(sol.answer),
    distractors,
    explanation: `${opts.rule} So the sequence continues ${shown}, ${sol.answer}.`,
    difficulty: opts.difficulty,
    concept: opts.concept,
    distractorRationaleByValue: rationale,
    misconceptionByValue: misc,
    source: SOURCE,
  };
}

/** Filter misreads to distinct positive integers ≠ the answer (numeric mode). */
function numericErrors(sol: SeqSolution): {
  value: number;
  feedback: string;
  misconception: string;
}[] {
  const seen = new Set<number>([sol.answer]);
  const out: { value: number; feedback: string; misconception: string }[] = [];
  for (const m of sol.misreads) {
    if (!Number.isInteger(m.value) || m.value < 0) continue;
    if (seen.has(m.value)) continue;
    seen.add(m.value);
    out.push({ value: m.value, feedback: m.why, misconception: m.tag });
  }
  return out;
}

/** Assemble a free-entry numeric question from a solved sequence. */
function numericSeqQuestion(
  sol: SeqSolution,
  opts: {
    idBase: string;
    family: string;
    concept: string;
    difficulty: Difficulty;
    rule: string;
  },
): NumericQuestion {
  const shown = sol.seq.join(", ");
  return {
    id: `${opts.idBase}-${sol.seq.join("-")}`,
    prompt: `What number comes next in the sequence?  ${shown}, ___`,
    answer: sol.answer,
    unit: "",
    difficulty: opts.difficulty,
    concept: opts.concept,
    explanation: `${opts.rule} So the next term is ${sol.answer}.`,
    commonErrors: numericErrors(sol),
    source: SOURCE,
    family: opts.family,
  };
}

/** Assemble a letter-sequence "what comes next?" MCQ from a solved sequence. */
function letterSeqParts(
  sol: LetterSolution,
  opts: {
    idBase: string;
    concept: string;
    difficulty: Difficulty;
    rule: string;
  },
): QuestionParts {
  const rationale: Record<string, string> = {};
  const misc: Record<string, string> = {};
  const distractors: string[] = [];
  for (const m of sol.misreads) {
    distractors.push(m.value);
    rationale[m.value] = m.why;
    misc[m.value] = m.tag;
  }
  const shown = sol.seq.join(", ");
  return {
    id: `${opts.idBase}-${sol.seq.join("")}`,
    prompt: `What letter comes next in the sequence?  ${shown}, ___`,
    correct: sol.answer,
    distractors,
    explanation: `${opts.rule} So the sequence continues ${shown}, ${sol.answer}.`,
    difficulty: opts.difficulty,
    concept: opts.concept,
    distractorRationaleByValue: rationale,
    misconceptionByValue: misc,
    source: SOURCE,
  };
}

/** Stamp a stable family id onto an assembled question and return it. */
function withFamily<T extends { family?: string }>(q: T, family: string): T {
  q.family = family;
  return q;
}

/* ========================================================================== */
/*  QUIZ generators — MCQ "what comes next?"                                    */
/* ========================================================================== */

const arithmeticNext: QuestionGenerator = (rng) =>
  withFamily(
    assembleDistinct(rng, (r) => {
      const a0 = r.int(1, 12);
      const d = r.int(2, 9);
      const n = r.int(4, 6);
      const sol = arithmetic(a0, d, n);
      return numericSeqParts(sol, {
        idBase: "seq-arith",
        concept: "Arithmetic sequence (constant common difference)",
        difficulty: "easy",
        rule: `Each term adds a constant difference of ${d}.`,
      });
    }),
    "arithmeticNext",
  );

const geometricNext: QuestionGenerator = (rng) =>
  withFamily(
    assembleDistinct(rng, (r) => {
      const a0 = r.int(1, 5);
      const ratio = r.pick([2, 3] as const);
      const n = r.int(4, 5);
      const sol = geometric(a0, ratio, n);
      return numericSeqParts(sol, {
        idBase: "seq-geo",
        concept: "Geometric sequence (constant ratio)",
        difficulty: "medium",
        rule: `Each term multiplies by a constant ratio of ${ratio}.`,
      });
    }),
    "geometricNext",
  );

const polynomialNext: QuestionGenerator = (rng) =>
  withFamily(
    assembleDistinct(rng, (r) => {
      const aCoef = r.int(1, 4);
      const bCoef = r.int(0, 5);
      const cCoef = r.int(1, 6);
      const n = r.int(4, 5);
      const sol = quadratic(aCoef, bCoef, cCoef, n);
      return numericSeqParts(sol, {
        idBase: "seq-poly",
        concept: "Polynomial sequence (constant second difference)",
        difficulty: "hard",
        rule: `The SECOND differences are constant at ${2 * aCoef} (a quadratic pattern).`,
      });
    }),
    "polynomialNext",
  );

const interleavedNext: QuestionGenerator = (rng) =>
  withFamily(
    assembleDistinct(rng, (r) => {
      const a0x = r.int(1, 8);
      const dx = r.int(2, 7);
      const a0y = r.int(2, 9);
      const dy = r.int(2, 7);
      const n = r.int(4, 6);
      const sol = interleaved(a0x, dx, a0y, dy, n);
      return numericSeqParts(sol, {
        idBase: "seq-inter",
        concept: "Interleaved sequences (two interwoven strands)",
        difficulty: "hard",
        rule: `Two arithmetic strands alternate: odd positions add ${dx}, even positions add ${dy}.`,
      });
    }),
    "interleavedNext",
  );

const fibonacciNext: QuestionGenerator = (rng) =>
  withFamily(
    assembleDistinct(rng, (r) => {
      const s0 = r.int(1, 5);
      const s1 = r.int(s0 + 1, s0 + 6);
      const n = r.int(5, 6);
      const sol = fibonacciLike(s0, s1, n);
      return numericSeqParts(sol, {
        idBase: "seq-fib",
        concept: "Fibonacci-like sequence (sum of the previous two)",
        difficulty: "medium",
        rule: "Each term is the sum of the two preceding terms.",
      });
    }),
    "fibonacciNext",
  );

const alternatingOpNext: QuestionGenerator = (rng) =>
  withFamily(
    assembleDistinct(rng, (r) => {
      const s = r.int(1, 6);
      const a = r.int(2, 7);
      const b = r.pick([2, 3] as const);
      const n = r.int(4, 6);
      const sol = alternatingOp(s, a, b, n);
      return numericSeqParts(sol, {
        idBase: "seq-alt",
        concept: "Alternating-operation sequence",
        difficulty: "hard",
        rule: `Operations alternate: add ${a}, then multiply by ${b}, repeating.`,
      });
    }),
    "alternatingOpNext",
  );

const caesarNext: QuestionGenerator = (rng) =>
  withFamily(
    assembleDistinct(rng, (r) => {
      const p0 = r.int(1, 20);
      const k = r.int(1, 5);
      const n = r.int(4, 5);
      const sol = caesar(p0, k, n);
      return letterSeqParts(sol, {
        idBase: "seq-caesar",
        concept: "Alphabetic shift (constant +k in the alphabet)",
        difficulty: "easy",
        rule: `Each letter advances +${k} position(s) in the alphabet.`,
      });
    }),
    "caesarNext",
  );

const alternatingShiftNext: QuestionGenerator = (rng) =>
  withFamily(
    assembleDistinct(rng, (r) => {
      const p0 = r.int(1, 14);
      const a = r.int(1, 4);
      const b = r.int(1, 4);
      const n = r.int(4, 6);
      const sol = alternatingShift(p0, a, b, n);
      return letterSeqParts(sol, {
        idBase: "seq-altshift",
        concept: "Alphabetic alternating shifts (+a, +b, …)",
        difficulty: "medium",
        rule: `Letter shifts alternate: +${a}, then +${b}, repeating.`,
      });
    }),
    "alternatingShiftNext",
  );

/** Odd-one-out: which value does NOT belong (breaks the divisibility rule)? */
const oddOneOut: QuestionGenerator = (rng) =>
  withFamily(
    assembleDistinct(rng, (r) => {
      const m = r.int(3, 7);
      // Three distinct multiples of m plus one near-miss intruder.
      const ts = r.shuffle([2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3);
      const multiples = ts.map((t) => m * t);
      const base = m * r.int(2, 9);
      const intruder = base + r.pick([1, 2, m - 1] as const); // not a multiple of m
      const answer = findOddByDivisor([...multiples, intruder], m);
      const rationale: Record<string, string> = {};
      const misc: Record<string, string> = {};
      const sorted = [...multiples].sort((x, y) => x - y);
      const tagFor = (v: number) =>
        v === sorted[0]
          ? {
              tag: "smallest_looks_odd",
              why: `Picked the smallest value, but ${v} is still divisible by ${m}, so it fits the rule.`,
            }
          : v === sorted[sorted.length - 1]
            ? {
                tag: "largest_looks_odd",
                why: `Picked the largest value, but ${v} is still divisible by ${m}, so it fits the rule.`,
              }
            : {
                tag: "conforming_member",
                why: `${v} is divisible by ${m}, so it obeys the rule and is not the odd one.`,
              };
      for (const v of multiples) {
        const { tag, why } = tagFor(v);
        rationale[S(v)] = why;
        misc[S(v)] = tag;
      }
      return {
        id: `seq-odd-${m}-${[...multiples, intruder].join("-")}`,
        prompt: `Which value does NOT belong?  ${[...multiples, intruder]
          .slice()
          .sort((x, y) => x - y)
          .join(", ")}`,
        correct: S(answer),
        distractors: multiples.map(S),
        explanation: `Every value except ${answer} is a multiple of ${m}. ${answer} is not, so it is the odd one out.`,
        difficulty: "medium",
        concept: "Odd-one-out (encoded divisibility rule)",
        distractorRationaleByValue: rationale,
        misconceptionByValue: misc,
        source: SOURCE,
      };
    }),
    "oddOneOut",
  );

/** Analogy: a : b :: c : ? under a multiplicative rule. */
const analogyNext: QuestionGenerator = (rng) =>
  withFamily(
    assembleDistinct(rng, (r) => {
      const ratio = r.pick([2, 3, 4] as const);
      const a = r.int(2, 9);
      let c = r.int(3, 9);
      while (c === a) c = r.int(3, 9);
      const sol = analogyMul(a, ratio, c);
      const rationale: Record<string, string> = {};
      const misc: Record<string, string> = {};
      const distractors: string[] = [];
      for (const mr of sol.misreads) {
        distractors.push(S(mr.value));
        rationale[S(mr.value)] = mr.why;
        misc[S(mr.value)] = mr.tag;
      }
      return {
        id: `seq-analogy-${a}-${ratio}-${c}`,
        prompt: `${a} is to ${sol.b} as ${c} is to ___ ?`,
        correct: S(sol.answer),
        distractors,
        explanation: `The rule maps a value to ${ratio}× itself (${a}→${sol.b}). Applying it to ${c} gives ${sol.answer}.`,
        difficulty: "medium",
        concept: "Numeric analogy (multiplicative rule transfer)",
        distractorRationaleByValue: rationale,
        misconceptionByValue: misc,
        source: SOURCE,
      };
    }),
    "analogyNext",
  );

/* ========================================================================== */
/*  NUMERIC generators — free-entry "type the next number"                      */
/* ========================================================================== */

const arithmeticNumeric: NumericQuestionGenerator = (rng) => {
  const a0 = rng.int(1, 12);
  const d = rng.int(2, 9);
  const n = rng.int(4, 6);
  return numericSeqQuestion(arithmetic(a0, d, n), {
    idBase: "seqn-arith",
    family: "arithmeticNumeric",
    concept: "Arithmetic sequence (constant common difference)",
    difficulty: "easy",
    rule: `Each term adds a constant difference of ${d}.`,
  });
};

const geometricNumeric: NumericQuestionGenerator = (rng) => {
  const a0 = rng.int(1, 5);
  const ratio = rng.pick([2, 3] as const);
  const n = rng.int(4, 5);
  return numericSeqQuestion(geometric(a0, ratio, n), {
    idBase: "seqn-geo",
    family: "geometricNumeric",
    concept: "Geometric sequence (constant ratio)",
    difficulty: "medium",
    rule: `Each term multiplies by a constant ratio of ${ratio}.`,
  });
};

const polynomialNumeric: NumericQuestionGenerator = (rng) => {
  const aCoef = rng.int(1, 4);
  const bCoef = rng.int(0, 5);
  const cCoef = rng.int(1, 6);
  const n = rng.int(4, 5);
  return numericSeqQuestion(quadratic(aCoef, bCoef, cCoef, n), {
    idBase: "seqn-poly",
    family: "polynomialNumeric",
    concept: "Polynomial sequence (constant second difference)",
    difficulty: "hard",
    rule: `The SECOND differences are constant at ${2 * aCoef} (a quadratic pattern).`,
  });
};

const interleavedNumeric: NumericQuestionGenerator = (rng) => {
  const a0x = rng.int(1, 8);
  const dx = rng.int(2, 7);
  const a0y = rng.int(2, 9);
  const dy = rng.int(2, 7);
  const n = rng.int(4, 6);
  return numericSeqQuestion(interleaved(a0x, dx, a0y, dy, n), {
    idBase: "seqn-inter",
    family: "interleavedNumeric",
    concept: "Interleaved sequences (two interwoven strands)",
    difficulty: "hard",
    rule: `Two arithmetic strands alternate: odd positions add ${dx}, even positions add ${dy}.`,
  });
};

const fibonacciNumeric: NumericQuestionGenerator = (rng) => {
  const s0 = rng.int(1, 5);
  const s1 = rng.int(s0 + 1, s0 + 6);
  const n = rng.int(5, 6);
  return numericSeqQuestion(fibonacciLike(s0, s1, n), {
    idBase: "seqn-fib",
    family: "fibonacciNumeric",
    concept: "Fibonacci-like sequence (sum of the previous two)",
    difficulty: "medium",
    rule: "Each term is the sum of the two preceding terms.",
  });
};

const alternatingOpNumeric: NumericQuestionGenerator = (rng) => {
  const s = rng.int(1, 6);
  const a = rng.int(2, 7);
  const b = rng.pick([2, 3] as const);
  const n = rng.int(4, 6);
  return numericSeqQuestion(alternatingOp(s, a, b, n), {
    idBase: "seqn-alt",
    family: "alternatingOpNumeric",
    concept: "Alternating-operation sequence",
    difficulty: "hard",
    rule: `Operations alternate: add ${a}, then multiply by ${b}, repeating.`,
  });
};

/* ========================================================================== */
/*  Registries + simple family mixers                                           */
/* ========================================================================== */

export const SEQUENCE_QUIZ_GENERATORS: Record<string, QuestionGenerator> = {
  arithmeticNext,
  geometricNext,
  polynomialNext,
  interleavedNext,
  fibonacciNext,
  alternatingOpNext,
  caesarNext,
  alternatingShiftNext,
  oddOneOut,
  analogyNext,
};

export const SEQUENCE_NUMERIC_GENERATORS: Record<
  string,
  NumericQuestionGenerator
> = {
  arithmeticNumeric,
  geometricNumeric,
  polynomialNumeric,
  interleavedNumeric,
  fibonacciNumeric,
  alternatingOpNumeric,
};

/** Round-robin-ish mixer: draws one family per call (deterministic per seed). */
export function mixSequenceQuiz(pool: QuestionGenerator[]): QuestionGenerator {
  return (rng: Rng) => rng.pick(pool)(rng);
}

export function mixSequenceNumeric(
  pool: NumericQuestionGenerator[],
): NumericQuestionGenerator {
  return (rng: Rng) => rng.pick(pool)(rng);
}

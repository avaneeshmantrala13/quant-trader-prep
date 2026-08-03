import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import type { NumericQuestion, Question } from "@/types/content";
import {
  alternatingOp,
  arithmetic,
  caesar,
  fibonacciLike,
  findOddByDivisor,
  geometric,
  interleaved,
  letterToPos,
  posToLetter,
  quadratic,
} from "./solvers";
import {
  SEQUENCE_NUMERIC_GENERATORS,
  SEQUENCE_QUIZ_GENERATORS,
} from "./generators";

const SEEDS = Array.from({ length: 250 }, (_, i) => i * 13 + 1);

/* -------------------------------------------------------------------------- */
/*  Parsing + independent re-derivation helpers                                */
/* -------------------------------------------------------------------------- */

/** Numbers shown before the "___" blank in a "what comes next?" prompt. */
function parseNumericSeq(prompt: string): number[] {
  const m = prompt.match(/sequence\?\s+(.+),\s+___/);
  expect(m).not.toBeNull();
  return m![1].split(", ").map(Number);
}

/** Letters shown before the "___" blank in a letter prompt. */
function parseLetterSeq(prompt: string): string[] {
  const m = prompt.match(/sequence\?\s+(.+),\s+___/);
  expect(m).not.toBeNull();
  return m![1].split(", ");
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Independent next-term derivation per numeric family "kind". */
const NUMERIC_KIND: Record<string, (s: number[]) => number> = {
  arithmetic: (s) => s[s.length - 1] + (s[1] - s[0]),
  geometric: (s) => s[s.length - 1] * (s[1] / s[0]),
  polynomial: (s) => {
    const first = s.slice(1).map((v, i) => v - s[i]);
    const sd = first[1] - first[0];
    return s[s.length - 1] + (first[first.length - 1] + sd);
  },
  interleaved: (s) => {
    const n = s.length;
    const even = s.filter((_, i) => i % 2 === 0);
    const odd = s.filter((_, i) => i % 2 === 1);
    if (n % 2 === 0) return even[even.length - 1] + (even[1] - even[0]);
    return odd[odd.length - 1] + (odd[1] - odd[0]);
  },
  fibonacci: (s) => s[s.length - 1] + s[s.length - 2],
  alternatingOp: (s) => {
    const a = s[1] - s[0];
    const b = s[2] / s[1];
    const last = s[s.length - 1];
    return (s.length - 1) % 2 === 0 ? last + a : last * b;
  },
};

const QUIZ_KIND: Record<string, string> = {
  arithmeticNext: "arithmetic",
  geometricNext: "geometric",
  polynomialNext: "polynomial",
  interleavedNext: "interleaved",
  fibonacciNext: "fibonacci",
  alternatingOpNext: "alternatingOp",
};

const NUMERIC_GEN_KIND: Record<string, string> = {
  arithmeticNumeric: "arithmetic",
  geometricNumeric: "geometric",
  polynomialNumeric: "polynomial",
  interleavedNumeric: "interleaved",
  fibonacciNumeric: "fibonacci",
  alternatingOpNumeric: "alternatingOp",
};

/** Numeric-generator name → its quiz-registry counterpart. */
const QUIZ_KEY: Record<string, string> = {
  arithmeticNumeric: "arithmeticNext",
  geometricNumeric: "geometricNext",
  polynomialNumeric: "polynomialNext",
  interleavedNumeric: "interleavedNext",
  fibonacciNumeric: "fibonacciNext",
  alternatingOpNumeric: "alternatingOpNext",
};

/* ========================================================================== */
/*  1. Exact solver unit fixtures                                              */
/* ========================================================================== */

describe("sequence solvers — exact fixtures", () => {
  it("arithmetic / geometric next terms", () => {
    expect(arithmetic(3, 5, 4).answer).toBe(3 + 5 * 4);
    expect(arithmetic(3, 5, 4).seq).toEqual([3, 8, 13, 18]);
    expect(geometric(2, 3, 4).answer).toBe(2 * 3 ** 4);
    expect(geometric(2, 3, 4).seq).toEqual([2, 6, 18, 54]);
  });

  it("quadratic has a constant second difference of 2·a", () => {
    const sol = quadratic(2, 1, 3, 5); // 2i²+i+3
    const first = sol.seq.slice(1).map((v, i) => v - sol.seq[i]);
    const second = first.slice(1).map((v, i) => v - first[i]);
    for (const sd of second) expect(sd).toBe(4);
    expect(sol.answer).toBe(2 * 25 + 5 + 3);
  });

  it("fibonacci-like sums the previous two from general seeds", () => {
    const sol = fibonacciLike(2, 5, 6); // 2,5,7,12,19,31 → next 50
    expect(sol.seq).toEqual([2, 5, 7, 12, 19, 31]);
    expect(sol.answer).toBe(50);
  });

  it("alternating-operation cycles +a then ×b", () => {
    const sol = alternatingOp(3, 4, 2, 5); // 3,+4→7,×2→14,+4→18,×2→36 ; next +4 → 40
    expect(sol.seq).toEqual([3, 7, 14, 18, 36]);
    expect(sol.answer).toBe(40);
  });

  it("interleaved continues the correct strand", () => {
    // X: 1,4,7 (dx 3) at even idx; Y: 2,5 (dy 3) at odd idx → 1,2,4,5,7 ; next Y=8
    const sol = interleaved(1, 3, 2, 3, 5);
    expect(sol.seq).toEqual([1, 2, 4, 5, 7]);
    expect(sol.answer).toBe(8);
  });

  it("letter mapping + caesar shift wrap", () => {
    expect(letterToPos("A")).toBe(1);
    expect(letterToPos("Z")).toBe(26);
    expect(posToLetter(27)).toBe("A");
    expect(posToLetter(0)).toBe("Z");
    const sol = caesar(letterToPos("X"), 2, 3); // X,Z,B → next D
    expect(sol.seq).toEqual(["X", "Z", "B"]);
    expect(sol.answer).toBe("D");
  });

  it("findOddByDivisor returns the unique violator", () => {
    expect(findOddByDivisor([6, 9, 12, 10], 3)).toBe(10);
    expect(() => findOddByDivisor([6, 9, 12, 15], 3)).toThrow();
  });
});

/* ========================================================================== */
/*  2. Every quiz generator — structural invariants + format parity           */
/* ========================================================================== */

describe("sequence quiz generators: 4 distinct, format-parity choices", () => {
  for (const [name, gen] of Object.entries(SEQUENCE_QUIZ_GENERATORS)) {
    it(`${name}: valid over ${SEEDS.length} seeds`, () => {
      for (const seed of SEEDS) {
        const q: Question = gen(new Rng(seed));
        // (b) 4 distinct choices, no padding placeholder leaked.
        expect(q.choices).toHaveLength(4);
        expect(new Set(q.choices).size).toBe(4);
        for (const c of q.choices) expect(c.includes("·alt")).toBe(false);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(4);
        // Format parity: EVERY choice matches the format of the correct one.
        const correct = q.choices[q.correctIndex];
        const isLetter = /^[A-Z]$/.test(correct);
        const isInt = /^\d+$/.test(correct);
        expect(isLetter || isInt).toBe(true);
        const shape = isLetter ? /^[A-Z]$/ : /^\d+$/;
        for (const c of q.choices) expect(shape.test(c)).toBe(true);
        // Rationale + misconception arrays align to the shuffled choices.
        expect(q.distractorRationale).toHaveLength(4);
        expect(q.distractorRationale![q.correctIndex]).toBe("Correct.");
        expect(q.misconceptions).toHaveLength(4);
        expect(q.misconceptions![q.correctIndex]).toBe("");
        for (let i = 0; i < 4; i++) {
          if (i === q.correctIndex) continue;
          expect(q.misconceptions![i].length).toBeGreaterThan(0);
          expect(q.distractorRationale![i].length).toBeGreaterThan(0);
        }
        expect(q.prompt.length).toBeGreaterThan(10);
        expect(q.explanation.length).toBeGreaterThan(20);
        expect(q.family).toBe(name);
      }
    });
  }
});

/* ========================================================================== */
/*  3. Numeric-family quiz — correct choice re-derives independently           */
/* ========================================================================== */

describe("sequence quiz generators: numeric families re-derive the answer", () => {
  for (const [name, kind] of Object.entries(QUIZ_KIND)) {
    it(`${name}: correct = independent ${kind} continuation`, () => {
      for (const seed of SEEDS) {
        const q = SEQUENCE_QUIZ_GENERATORS[name](new Rng(seed));
        const seq = parseNumericSeq(q.prompt);
        const expected = NUMERIC_KIND[kind](seq);
        expect(Number(q.choices[q.correctIndex])).toBe(expected);
      }
    });
  }
});

/* ========================================================================== */
/*  4. Alphabetic quiz families — correct letter re-derives independently       */
/* ========================================================================== */

describe("sequence quiz generators: alphabetic families (>=2)", () => {
  it("caesarNext: constant shift mod 26", () => {
    for (const seed of SEEDS) {
      const q = SEQUENCE_QUIZ_GENERATORS.caesarNext(new Rng(seed));
      const seq = parseLetterSeq(q.prompt).map(letterToPos);
      const k = (((seq[1] - seq[0]) % 26) + 26) % 26;
      for (let i = 1; i < seq.length; i++) {
        expect((((seq[i] - seq[i - 1]) % 26) + 26) % 26).toBe(k);
      }
      const expected = posToLetter(seq[seq.length - 1] + k);
      expect(q.choices[q.correctIndex]).toBe(expected);
    }
  });

  it("alternatingShiftNext: alternating shifts mod 26", () => {
    for (const seed of SEEDS) {
      const q = SEQUENCE_QUIZ_GENERATORS.alternatingShiftNext(new Rng(seed));
      const seq = parseLetterSeq(q.prompt).map(letterToPos);
      const a = (((seq[1] - seq[0]) % 26) + 26) % 26;
      const b = (((seq[2] - seq[1]) % 26) + 26) % 26;
      const n = seq.length;
      const shift = (n - 1) % 2 === 0 ? a : b;
      const expected = posToLetter(seq[n - 1] + shift);
      expect(q.choices[q.correctIndex]).toBe(expected);
    }
  });
});

/* ========================================================================== */
/*  5. Matrix / odd-one-out / analogy families (>=1)                            */
/* ========================================================================== */

describe("sequence quiz generators: odd-one-out & analogy (matrix family)", () => {
  it("oddOneOut: the correct value breaks the divisibility rule its peers share", () => {
    for (const seed of SEEDS) {
      const q = SEQUENCE_QUIZ_GENERATORS.oddOneOut(new Rng(seed));
      const correct = Number(q.choices[q.correctIndex]);
      const others = q.choices
        .filter((_, i) => i !== q.correctIndex)
        .map(Number);
      const g = others.reduce((acc, v) => gcd(acc, v));
      expect(g).toBeGreaterThan(1);
      expect(correct % g).not.toBe(0);
      // Prompt shows exactly the four choice values.
      const shown = q.prompt.match(/belong\?\s+(.+)$/)![1].split(", ").map(Number);
      expect(new Set(shown)).toEqual(new Set(q.choices.map(Number)));
    }
  });

  it("analogyNext: answer transfers the a→b ratio onto c", () => {
    for (const seed of SEEDS) {
      const q = SEQUENCE_QUIZ_GENERATORS.analogyNext(new Rng(seed));
      const m = q.prompt.match(/^(\d+) is to (\d+) as (\d+) is to/)!;
      const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
      expect(b % a).toBe(0);
      expect(Number(q.choices[q.correctIndex])).toBe(c * (b / a));
    }
  });
});

/* ========================================================================== */
/*  6. Every numeric generator — validity + independent re-derivation (>=6)     */
/* ========================================================================== */

describe("sequence numeric generators: valid, traceable, re-derivable", () => {
  for (const [name, kind] of Object.entries(NUMERIC_GEN_KIND)) {
    it(`${name}: answer = independent ${kind} continuation over ${SEEDS.length} seeds`, () => {
      for (const seed of SEEDS) {
        const q: NumericQuestion = SEQUENCE_NUMERIC_GENERATORS[name](
          new Rng(seed),
        );
        // Integer answer, positive.
        expect(q.decimals).toBeUndefined();
        expect(Number.isInteger(q.answer)).toBe(true);
        expect(q.answer).toBeGreaterThan(0);
        // Independent re-derivation.
        const seq = parseNumericSeq(q.prompt);
        expect(NUMERIC_KIND[kind](seq)).toBe(q.answer);
        // (b) commonErrors: distinct integers, never equal to the answer.
        const errs = q.commonErrors ?? [];
        expect(errs.length).toBeGreaterThanOrEqual(1);
        const seen = new Set<number>();
        for (const ce of errs) {
          expect(Number.isInteger(ce.value)).toBe(true);
          expect(ce.value).not.toBe(q.answer);
          expect(seen.has(ce.value)).toBe(false);
          seen.add(ce.value);
          expect(ce.feedback.length).toBeGreaterThan(10);
          expect(ce.misconception).toBeTruthy();
        }
        expect(q.family).toBe(name);
        expect(q.explanation.length).toBeGreaterThan(20);
      }
    });
  }
});

/* ========================================================================== */
/*  7. Determinism + parametricity (all generators)                            */
/* ========================================================================== */

describe("sequence generators: deterministic and parametric", () => {
  const allGens: Record<string, (rng: Rng) => Question | NumericQuestion> = {
    ...SEQUENCE_QUIZ_GENERATORS,
    ...SEQUENCE_NUMERIC_GENERATORS,
  };

  for (const [name, gen] of Object.entries(allGens)) {
    it(`${name}: same seed → identical item; seeds vary the item`, () => {
      // (c) Determinism: same seed reproduces a byte-identical question.
      for (const seed of [1, 7, 42, 100, 999]) {
        const a = JSON.stringify(gen(new Rng(seed)));
        const b = JSON.stringify(gen(new Rng(seed)));
        expect(a).toBe(b);
      }
      // Parametric: across many seeds the prompts are not all identical.
      const prompts = new Set(SEEDS.map((s) => gen(new Rng(s)).prompt));
      expect(prompts.size).toBeGreaterThan(1);
    });
  }
});

/* ========================================================================== */
/*  8. Coverage guarantees (>=6 numeric, >=2 alphabetic, >=1 matrix)            */
/* ========================================================================== */

describe("sequence family coverage", () => {
  it("exposes >=6 numeric families in both quiz and numeric modes", () => {
    expect(Object.keys(NUMERIC_GEN_KIND).length).toBeGreaterThanOrEqual(6);
    for (const name of Object.keys(NUMERIC_GEN_KIND)) {
      expect(typeof SEQUENCE_NUMERIC_GENERATORS[name]).toBe("function");
      expect(typeof SEQUENCE_QUIZ_GENERATORS[QUIZ_KEY[name]]).toBe("function");
    }
  });

  it("exposes >=2 alphabetic families and >=1 matrix/odd-one-out/analogy family", () => {
    for (const alpha of ["caesarNext", "alternatingShiftNext"]) {
      expect(typeof SEQUENCE_QUIZ_GENERATORS[alpha]).toBe("function");
    }
    for (const mat of ["oddOneOut", "analogyNext"]) {
      expect(typeof SEQUENCE_QUIZ_GENERATORS[mat]).toBe("function");
    }
  });
});

import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import type { Question, QuestionGenerator } from "@/types/content";
import { ALL_MM_GENERATORS } from "./mentalMath/generators";
import { PROB_GENERATORS } from "./probability/generators";
import { EV_GENERATORS } from "./interviewGames/generators";

const ALL: Record<string, QuestionGenerator> = {
  ...ALL_MM_GENERATORS,
  ...PROB_GENERATORS,
  ...EV_GENERATORS,
};

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7 + 1);

/** Strip formatting ($ , %) to compare numeric option strings. */
function num(s: string): number {
  return Number(s.replace(/[$,%\s]/g, ""));
}

describe("generator structural invariants", () => {
  for (const [name, gen] of Object.entries(ALL)) {
    it(`${name}: always yields 4 distinct choices with a valid, present answer`, () => {
      for (const seed of SEEDS) {
        const q: Question = gen(new Rng(seed));
        expect(q.choices).toHaveLength(4);
        // No padding placeholder — proves 3 genuinely distinct distractors exist.
        for (const c of q.choices) {
          expect(c.includes("·alt")).toBe(false);
        }
        expect(new Set(q.choices).size).toBe(4);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(4);
        expect(q.choices[q.correctIndex]).toBeTruthy();
        expect(q.prompt.length).toBeGreaterThan(5);
        expect(q.explanation.length).toBeGreaterThan(5);
        if (q.distractorRationale) {
          expect(q.distractorRationale).toHaveLength(q.choices.length);
        }
      }
    });
  }
});

describe("mental math: independent re-derivation from the prompt", () => {
  const ops = {
    genAddition: (a: number, b: number) => a + b,
    genSubtraction: (a: number, b: number) => a - b,
    genMultiply2x1: (a: number, b: number) => a * b,
    genMultiply2x2: (a: number, b: number) => a * b,
    genDivision: (a: number, b: number) => a / b,
  } as const;

  for (const [name, fn] of Object.entries(ops)) {
    it(`${name} answer matches a fresh computation`, () => {
      const gen = ALL_MM_GENERATORS[name as keyof typeof ALL_MM_GENERATORS];
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        const m = q.prompt.match(/([\d,]+)\s*[+\-−×÷x*/]\s*([\d,]+)/);
        expect(m).not.toBeNull();
        const a = num(m![1]);
        const b = num(m![2]);
        const expected = fn(a, b);
        expect(num(q.choices[q.correctIndex])).toBeCloseTo(expected, 6);
      }
    });
  }

  it("genPercent answer matches p% of base", () => {
    for (const seed of SEEDS) {
      const q = ALL_MM_GENERATORS.genPercent(new Rng(seed));
      const m = q.prompt.match(/is\s+(\d+)%\s+of\s+([\d,]+)/);
      expect(m).not.toBeNull();
      const p = num(m![1]);
      const base = num(m![2]);
      expect(num(q.choices[q.correctIndex])).toBeCloseTo((p / 100) * base, 6);
    }
  });
});

describe("probability: independent re-derivation from the prompt", () => {
  const choose = (n: number, r: number) => {
    r = Math.min(r, n - r);
    let v = 1;
    for (let i = 0; i < r; i++) v = (v * (n - i)) / (i + 1);
    return Math.round(v);
  };

  it("genUnion matches inclusion–exclusion", () => {
    for (const seed of SEEDS) {
      const q = PROB_GENERATORS.genUnion(new Rng(seed));
      const N = Number(q.prompt.match(/from 1 to (\d+)/)![1]);
      const divs = [...q.prompt.matchAll(/divisible by (\d+)/g)].map((x) =>
        Number(x[1]),
      );
      const [d1, d2] = divs;
      const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
      const lcm = (d1 * d2) / g(d1, d2);
      const p =
        Math.floor(N / d1) / N +
        Math.floor(N / d2) / N -
        Math.floor(N / lcm) / N;
      expect(num(q.choices[q.correctIndex])).toBeCloseTo(p, 4);
    }
  });

  it("genAtLeastOne matches 1-(1-p)^n", () => {
    for (const seed of SEEDS) {
      const q = PROB_GENERATORS.genAtLeastOne(new Rng(seed));
      const frac = q.prompt.match(/probability (\d+)\/(\d+)/)!;
      const n = Number(q.prompt.match(/tried (\d+) times/)![1]);
      const p = Number(frac[1]) / Number(frac[2]);
      expect(num(q.choices[q.correctIndex])).toBeCloseTo(
        1 - Math.pow(1 - p, n),
        4,
      );
    }
  });

  it("genCombinations matches C(n,r)", () => {
    for (const seed of SEEDS) {
      const q = PROB_GENERATORS.genCombinations(new Rng(seed));
      const r = Number(q.prompt.match(/committee of (\d+)/)![1]);
      const n = Number(q.prompt.match(/from (\d+)/)![1]);
      expect(num(q.choices[q.correctIndex])).toBe(choose(n, r));
    }
  });

  it("genBinomial matches C(n,k)/2^n", () => {
    for (const seed of SEEDS) {
      const q = PROB_GENERATORS.genBinomial(new Rng(seed));
      const n = Number(q.prompt.match(/flipped (\d+) times/)![1]);
      const k = Number(q.prompt.match(/exactly (\d+) head/)![1]);
      expect(num(q.choices[q.correctIndex])).toBeCloseTo(
        choose(n, k) / Math.pow(2, n),
        4,
      );
    }
  });
});

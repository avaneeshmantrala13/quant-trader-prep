import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import type { Question } from "@/types/content";
import {
  genChebyshev,
  genCltCondition,
  genCltStatement,
  genLlnStatement,
} from "./generators";

const GENS: Record<string, (rng: Rng) => Question> = {
  genChebyshev,
  genCltStatement,
  genLlnStatement,
  genCltCondition,
};

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 31 + 3);

describe("Limit-theorem quiz generators: structural invariants", () => {
  for (const [name, gen] of Object.entries(GENS)) {
    it(`${name} — 4 distinct choices, valid answer, aligned rationale`, () => {
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        expect(q.choices.length).toBe(4);
        expect(new Set(q.choices).size).toBe(4);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(4);
        expect(q.choices[q.correctIndex]).toBeTruthy();
        expect(q.prompt.length).toBeGreaterThan(10);
        expect(q.explanation.length).toBeGreaterThan(40);
        expect(q.distractorRationale).toHaveLength(4);
        expect(q.distractorRationale![q.correctIndex].length).toBeGreaterThan(0);
      }
    });
  }
});

describe("Limit-theorem correctness spot-checks", () => {
  it("Chebyshev bound is σ²/a²", () => {
    const q = genChebyshev(new Rng(1));
    const v = Number(q.prompt.match(/σ² = (\d+)/)![1]);
    const a = Number(q.prompt.match(/≥ (\d+)\)/)![1]);
    const [num, den] = q.choices[q.correctIndex].split("/").map(Number);
    const expected = v / (a * a);
    const got = den ? num / den : num;
    expect(got).toBeCloseTo(expected, 9);
  });
  it("CLT answer is the convergence-in-distribution statement", () => {
    const q = genCltStatement(new Rng(7));
    expect(q.choices[q.correctIndex]).toContain("converges in distribution to N(0,1)");
  });
  it("LLN answer is the mean-convergence statement", () => {
    const q = genLlnStatement(new Rng(7));
    expect(q.choices[q.correctIndex]).toContain("converges to the true mean");
  });
});

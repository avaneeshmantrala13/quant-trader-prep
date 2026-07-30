import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import type { Question } from "@/types/content";
import { genMgfIdentify, genMgfMean, genMgfSum, genMgfVar } from "./generators";

const GENS: Record<string, (rng: Rng) => Question> = {
  genMgfMean,
  genMgfVar,
  genMgfIdentify,
  genMgfSum,
};

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 29 + 3);

describe("MGF quiz generators: structural invariants", () => {
  for (const [name, gen] of Object.entries(GENS)) {
    it(`${name} — distinct choices, valid answer, aligned rationale`, () => {
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        expect(q.choices.length).toBeGreaterThanOrEqual(3);
        expect(new Set(q.choices).size).toBe(q.choices.length);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.choices.length);
        expect(q.choices[q.correctIndex]).toBeTruthy();
        expect(q.prompt.length).toBeGreaterThan(10);
        expect(q.explanation.length).toBeGreaterThan(40);
        expect(q.distractorRationale).toHaveLength(q.choices.length);
        expect(q.distractorRationale![q.correctIndex].length).toBeGreaterThan(0);
      }
    });
  }
});

describe("MGF correctness spot-checks", () => {
  it("E[X] from λ/(λ−t) is 1/λ", () => {
    const q = genMgfMean(new Rng(1)); // λ=... whatever seed picks
    const m = q.prompt.match(/(\d+)\/\(\1 − t\)/);
    expect(m).not.toBeNull();
    const lambda = Number(m![1]);
    expect(q.choices[q.correctIndex]).toBe(`1/${lambda}`);
  });
  it("MGF of an independent iid sum is M(t)²", () => {
    const q = genMgfSum(new Rng(5));
    expect(q.choices[q.correctIndex]).toBe("M(t)²");
  });
  it("identifies the Poisson MGF form", () => {
    for (const seed of SEEDS) {
      const q = genMgfIdentify(new Rng(seed));
      if (q.prompt.includes("e^{λ(e^t − 1)}")) {
        expect(q.choices[q.correctIndex]).toBe("Poisson");
      }
    }
  });
});

import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { gradeNumeric } from "@/lib/numeric";
import type { NumericQuestion } from "@/types/content";
import { F } from "../coreSolvers";
import { expectedGenN, extinctionProb, offspringMean } from "./branching";
import { genBranchingMean, genExtinction } from "./generators";

describe("Branching solvers reproduce standard results", () => {
  it("offspring (1,1,2)/4: μ=5/4, E[Z2]=25/16, extinction=1/2", () => {
    const mu = offspringMean(1, 2, 4);
    expect(mu.equals(F(5, 4))).toBe(true);
    expect(expectedGenN(mu, 2).equals(F(25, 16))).toBe(true);
    expect(extinctionProb(1, 2).equals(F(1, 2))).toBe(true);
  });
  it("subcritical/critical extinction is certain (=1)", () => {
    expect(extinctionProb(2, 1).equals(F(1))).toBe(true); // p0>p2 ⇒ μ<1
    expect(extinctionProb(1, 1).equals(F(1))).toBe(true); // p0=p2 ⇒ μ=1
  });
});

const NUMERIC_GENS: Record<string, (rng: Rng) => NumericQuestion> = {
  genBranchingMean,
  genExtinction,
};

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 43 + 9);

describe("Branching numeric generators: grading round-trips + clean distractors", () => {
  for (const [name, gen] of Object.entries(NUMERIC_GENS)) {
    it(`${name} — answer grades, commonErrors clean, deterministic`, () => {
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        const dp = q.decimals ?? 0;
        const f = 10 ** dp;
        expect(Number.isFinite(q.answer)).toBe(true);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        const typed = dp === 0 ? String(q.answer) : q.answer.toFixed(dp);
        expect(gradeNumeric(q, typed).correct).toBe(true);
        expect(gen(new Rng(seed)).answer).toBe(q.answer);
        expect((q.commonErrors ?? []).length).toBeGreaterThanOrEqual(1);
        const keys = new Set<number>([Math.round(q.answer * f)]);
        for (const ce of q.commonErrors ?? []) {
          const k = Math.round(ce.value * f);
          expect(keys.has(k)).toBe(false);
          keys.add(k);
          const g = gradeNumeric(q, dp === 0 ? String(ce.value) : ce.value.toFixed(dp));
          expect(g.correct).toBe(false);
          expect(g.matchedError?.feedback.length).toBeGreaterThan(10);
        }
        expect(q.explanation.trim().length).toBeGreaterThan(40);
      }
    });
  }
});

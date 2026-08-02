import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { gradeNumeric } from "@/lib/numeric";
import type { NumericQuestion } from "@/types/content";
import { F } from "../coreSolvers";
import {
  condMeanGivenY,
  mixtureExpectation,
  randomSumMean,
  randomSumVar,
  towerMeanFromTable,
} from "./condExp";
import {
  genCondMean,
  genMixture,
  genRandomSumMean,
  genRandomSumVar,
  genTowerTable,
} from "./generators";

describe("Conditional-expectation solvers reproduce standard results", () => {
  const W = [
    [2, 1],
    [3, 2],
    [1, 4],
  ];
  const X = [1, 2, 3];

  it("E[X|Y=col] renormalises to the column", () => {
    // col 0: (1·2 + 2·3 + 3·1)/(2+3+1) = 11/6
    expect(condMeanGivenY(W, X, 0).equals(F(11, 6))).toBe(true);
    // col 1: (1·1 + 2·2 + 3·4)/(1+2+4) = 17/7
    expect(condMeanGivenY(W, X, 1).equals(F(17, 7))).toBe(true);
  });

  it("tower rule recovers the X-marginal mean", () => {
    // Σ x·count / N = (1·3 + 2·5 + 3·5)/13 = 28/13
    expect(towerMeanFromTable(W, X).equals(F(28, 13))).toBe(true);
  });

  it("mixture / total expectation blends by probability", () => {
    // 1/4·8 + 3/4·4 = 2 + 3 = 5
    expect(mixtureExpectation([F(1, 4), F(3, 4)], [F(8), F(4)]).equals(F(5))).toBe(
      true,
    );
  });

  it("Wald random-sum mean multiplies", () => {
    expect(randomSumMean(F(10), F(5, 2)).equals(F(25))).toBe(true);
  });

  it("law of total variance adds both terms", () => {
    // E[N]Var(X) + Var(N)E[X]² = 10·2 + 4·9 = 56
    expect(randomSumVar(F(10), F(4), F(3), F(2)).equals(F(56))).toBe(true);
  });
});

const NUMERIC_GENS: Record<string, (rng: Rng) => NumericQuestion> = {
  genCondMean,
  genMixture,
  genRandomSumMean,
  genRandomSumVar,
  genTowerTable,
};

const SEEDS = Array.from({ length: 80 }, (_, i) => i * 53 + 11);

describe("Conditional-expectation generators: grading round-trips + clean distractors", () => {
  for (const [name, gen] of Object.entries(NUMERIC_GENS)) {
    it(`${name} — answer grades, commonErrors clean, deterministic`, () => {
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        const dp = q.decimals ?? 0;
        const f = 10 ** dp;
        expect(Number.isFinite(q.answer)).toBe(true);
        expect(q.answer).toBeGreaterThan(0);
        const typed = dp === 0 ? String(q.answer) : q.answer.toFixed(dp);
        expect(gradeNumeric(q, typed).correct).toBe(true);
        expect(gen(new Rng(seed)).answer).toBe(q.answer);
        expect((q.commonErrors ?? []).length).toBeGreaterThanOrEqual(1);
        const keys = new Set<number>([Math.round(q.answer * f)]);
        for (const ce of q.commonErrors ?? []) {
          const k = Math.round(ce.value * f);
          expect(keys.has(k)).toBe(false);
          keys.add(k);
          const g = gradeNumeric(
            q,
            dp === 0 ? String(ce.value) : ce.value.toFixed(dp),
          );
          expect(g.correct).toBe(false);
          expect(g.matchedError?.feedback.length).toBeGreaterThan(10);
        }
        expect(q.explanation.trim().length).toBeGreaterThan(40);
      }
    });
  }
});

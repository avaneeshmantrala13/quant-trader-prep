import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { gradeNumeric } from "@/lib/numeric";
import type { NumericQuestion } from "@/types/content";
import { F } from "../coreSolvers";
import {
  condProbXgivenY,
  covarianceFromTable,
  independentJointProb,
  jointMeanX,
  jointNormConst,
  marginalX,
  marginalY,
  sumBelowUnitSquare,
  sumDensityRectProb,
  transformSqrtCDF,
} from "./joint";
import {
  genJointConditional,
  genJointCovariance,
  genJointIndependence,
  genJointMarginal,
  genJointMean,
  genJointNorm,
  genJointSum,
  genSumDensityRect,
  genTransform,
} from "./generators";

describe("Joint solvers reproduce standard results", () => {
  it("normalisation, marginal mean, sum-region, transform", () => {
    expect(jointNormConst(2, 3).equals(F(4, 36))).toBe(true); // 1/9
    expect(jointMeanX(3).equals(F(2))).toBe(true); // 2·3/3
    expect(sumBelowUnitSquare(1, 2).equals(F(1, 8))).toBe(true); // (1/2)²/2
    expect(transformSqrtCDF(3, 5).equals(F(3, 5))).toBe(true); // P(Y≤9/25)=3/5
  });

  it("discrete table: marginals, conditionals, independence, covariance", () => {
    const W = [
      [2, 1],
      [1, 3],
    ];
    expect(marginalX(W, 0).equals(F(3, 7))).toBe(true); // (2+1)/7
    expect(marginalY(W, 1).equals(F(4, 7))).toBe(true); // (1+3)/7
    expect(condProbXgivenY(W, 0, 0).equals(F(2, 3))).toBe(true); // 2/(2+1)
    expect(independentJointProb(W, 0, 0).equals(F(9, 49))).toBe(true); // 3/7·3/7
    // Cov: E[XY]=18/7, E[X]=E[Y]=11/7 ⇒ 18/7 − 121/49 = 5/49
    expect(covarianceFromTable(W, [1, 2], [1, 2]).equals(F(5, 49))).toBe(true);
  });

  it("non-uniform density f=x+y: P(X≤a,Y≤b)=ab(a+b)/2", () => {
    // a=1/2, b=1/3 ⇒ (1/6)(5/6)/2 = 5/72
    expect(sumDensityRectProb(1, 2, 1, 3).equals(F(5, 72))).toBe(true);
  });
});

const NUMERIC_GENS: Record<string, (rng: Rng) => NumericQuestion> = {
  genJointNorm,
  genJointMean,
  genJointSum,
  genTransform,
  genJointMarginal,
  genJointConditional,
  genJointIndependence,
  genJointCovariance,
  genSumDensityRect,
};

const SEEDS = Array.from({ length: 80 }, (_, i) => i * 59 + 7);

describe("Joint numeric generators: grading round-trips + clean distractors", () => {
  for (const [name, gen] of Object.entries(NUMERIC_GENS)) {
    it(`${name} — answer grades, commonErrors clean, deterministic`, () => {
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        const dp = q.decimals ?? 0;
        const f = 10 ** dp;
        // Covariance may be signed; other families are non-negative.
        expect(Number.isFinite(q.answer)).toBe(true);
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

import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { gradeNumeric } from "@/lib/numeric";
import type { NumericQuestion, Question } from "@/types/content";
import {
  F,
  affineCorrelation,
  cltDifferenceZ,
  cltUpperTail,
  markovBound,
  maxCovariance,
  noRainIndependentProb,
  twoDrumSumSD,
  varLinearCombo,
} from "../coreSolvers";
import {
  genAffineCorr,
  genCltDiffZ,
  genCltTail,
  genMarkovBound,
  genMaxCov,
  genSumSD,
  genVarCombo,
} from "./generators";
import { varianceCovarianceCltFlashcards } from "./flashcards";

/**
 * Re-homed from the former `general/general.test.ts`: the second-moment slice of
 * the original seed fixtures (CLT tails, the variance-doubling z, Markov bound,
 * the Cauchy–Schwarz covariance ceiling, affine correlation, variance of a sum,
 * SD addition, and the independence case) plus the generators' round-trip +
 * distractor checks and the two non-scalar reasoning flashcards.
 */

const r = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;

const NUMERIC_GENS: Record<string, (rng: Rng) => NumericQuestion> = {
  genVarCombo,
  genCltTail,
  genMarkovBound,
};

const QUIZ_GENS: Record<string, (rng: Rng) => Question> = {
  genMaxCov,
  genAffineCorr,
  genSumSD,
  genCltDiffZ,
};

const SEED_ANSWERS: Record<string, number> = {
  GN1_230Heads: 0.00135,
  GN2_BetaGap: -2,
  GN3_CandleBatch: 0.8,
  GN39_CovarianceCeiling: 10,
  GN40_CorrelationFlip: -0.6,
  GN41_VarianceTwoVars: 30,
  GN42_TwinDrums: 2.83,
  GN44_RainyDay: 0.3,
};

describe("solver reproduces documented answers — CLT & concentration", () => {
  it("230 Heads (GN1) ≈ 0.00135 at 5dp", () => {
    expect(r(cltUpperTail(230, 400, 0.5, 0.25), 5)).toBe(SEED_ANSWERS.GN1_230Heads);
  });
  it("Beta Gap (GN2) z-argument a = −2", () => {
    expect(r(cltDifferenceZ(10, 250, 0.05), 6)).toBe(SEED_ANSWERS.GN2_BetaGap);
  });
  it("Candle Batch (GN3) Markov bound = 0.8", () => {
    expect(markovBound(F(10000), F(12500)).equals(F(4, 5))).toBe(true);
    expect(markovBound(F(10000), F(12500)).valueOf()).toBe(SEED_ANSWERS.GN3_CandleBatch);
  });
});

describe("solver reproduces documented answers — covariance / variance", () => {
  it("Covariance Ceiling (GN39) = √100 = 10 (means are red herrings)", () => {
    expect(maxCovariance(20, 5)).toBe(SEED_ANSWERS.GN39_CovarianceCeiling);
  });
  it("Correlation Flip (GN40) = −0.6", () => {
    expect(affineCorrelation(-5, 3, F(6, 10)).equals(F(-6, 10))).toBe(true);
    expect(affineCorrelation(-5, 3, F(6, 10)).valueOf()).toBe(SEED_ANSWERS.GN40_CorrelationFlip);
  });
  it("Variance of Two Variables (GN41) = 30", () => {
    expect(varLinearCombo(2, F(3), 3, F(2)).equals(F(30))).toBe(true);
    expect(varLinearCombo(2, F(3), 3, F(2)).valueOf()).toBe(SEED_ANSWERS.GN41_VarianceTwoVars);
  });
  it("Twin Drums (GN42) sd(S) = √8 ≈ 2.83 (NOT 2+2)", () => {
    const { variance, sd } = twoDrumSumSD(7);
    expect(variance.equals(F(8))).toBe(true);
    expect(r(sd, 2)).toBe(SEED_ANSWERS.GN42_TwinDrums);
  });
  it("Rainy Day (GN44) independent case = 0.3", () => {
    expect(noRainIndependentProb(F(4, 10), F(5, 10)).equals(F(3, 10))).toBe(true);
    expect(noRainIndependentProb(F(4, 10), F(5, 10)).valueOf()).toBe(SEED_ANSWERS.GN44_RainyDay);
  });
});

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 131 + 5);

describe("numeric generators: grading round-trips + clean distractors", () => {
  for (const [name, gen] of Object.entries(NUMERIC_GENS)) {
    it(`${name} — answer grades, commonErrors are clean`, () => {
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        const dp = q.decimals ?? 0;
        const f = 10 ** dp;
        expect(Number.isFinite(q.answer)).toBe(true);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        if (q.decimals == null) {
          expect(Number.isInteger(q.answer)).toBe(true);
          expect(q.answer).toBeGreaterThan(0);
        }
        const typed = dp === 0 ? String(q.answer) : q.answer.toFixed(dp);
        expect(gradeNumeric(q, typed).correct).toBe(true);
        const q2 = gen(new Rng(seed));
        expect(q2.answer).toBe(q.answer);
        for (const ce of q.commonErrors ?? []) {
          expect(Number.isFinite(ce.value)).toBe(true);
          expect(Math.round(ce.value * f)).not.toBe(Math.round(q.answer * f));
          const g = gradeNumeric(q, dp === 0 ? String(ce.value) : ce.value.toFixed(dp));
          expect(g.correct).toBe(false);
          expect(g.matchedError?.feedback).toBeTruthy();
        }
        const keys = (q.commonErrors ?? []).map((e) => Math.round(e.value * f));
        expect(new Set(keys).size).toBe(keys.length);
        expect(q.explanation.trim().length).toBeGreaterThan(40);
      }
    });
  }
});

describe("quiz generators: valid correct index + distinct, aligned choices", () => {
  for (const [name, gen] of Object.entries(QUIZ_GENS)) {
    it(`${name} — options clean, rationale aligned`, () => {
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.choices.length);
        expect(q.choices.length).toBeGreaterThanOrEqual(2);
        expect(new Set(q.choices).size).toBe(q.choices.length);
        expect(q.distractorRationale?.length).toBe(q.choices.length);
        q.choices.forEach((c, i) => {
          if (i !== q.correctIndex) expect(c).not.toBe(q.choices[q.correctIndex]);
        });
        expect(q.explanation.trim().length).toBeGreaterThan(40);
      }
    });
  }
});

const FINGERPRINTS = [
  "230 Heads", "Beta Gap", "Candle Batch", "Covariance Ceiling", "Correlation Flip",
  "Variance of Two Variables", "Twin Drums", "Perfect Correlation", "Rainy Day",
];

describe("no source-dataset title/wording leaks into generated prompts", () => {
  it("generated prompts never contain a verbatim dataset fingerprint", () => {
    const gens = [
      ...Object.values(NUMERIC_GENS),
      ...Object.values(QUIZ_GENS),
    ] as ((rng: Rng) => { prompt: string })[];
    for (const seed of SEEDS) {
      for (const gen of gens) {
        const q = gen(new Rng(seed));
        for (const fp of FINGERPRINTS) expect(q.prompt).not.toContain(fp);
      }
    }
  });
});

describe("re-homed reasoning flashcards (procedure + conditional)", () => {
  it("perfect-correlation special asks for two (X,Y) pairs", () => {
    const fc = varianceCovarianceCltFlashcards.find((c) => c.id === "gen-fc-perfectcorr")!;
    expect(/two/i.test(fc.answer)).toBe(true);
    expect(fc.explanation.trim().length).toBeGreaterThan(40);
  });
  it("dependence special gives 0.3 only under independence", () => {
    const fc = varianceCovarianceCltFlashcards.find((c) => c.id === "gen-fc-dependence")!;
    expect(fc.answer).toContain("0.3");
    expect(fc.explanation.trim().length).toBeGreaterThan(40);
  });
});

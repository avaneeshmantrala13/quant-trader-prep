import { describe, expect, it } from "vitest";
import {
  AT_LEAST_ONE_ERRORS,
  BAYES_POSTERIOR_ERRORS,
  INDEPENDENT_AND_ERRORS,
  bayes,
} from "./errorModeCatalogs";
import { buildCommonErrors, matchErrorMode } from "@/lib/tutor/errorModes";
import { gradeFreeResponse } from "@/lib/numeric";
import { buildHintLadder } from "@/lib/tutor/hintLadder";
import { creditForEpisode } from "@/lib/tutor/creditSchedule";
import type { NumericQuestion } from "@/types/content";

describe("INDEPENDENT_AND error-mode catalog", () => {
  const params = { pa: 0.5, pb: 0.4 };
  const correct = params.pa * params.pb; // 0.2

  it("computes parametric wrong values with coaching + misconception", () => {
    const errs = buildCommonErrors(INDEPENDENT_AND_ERRORS, params, correct, {
      decimals: 4,
    });
    const byMisc = Object.fromEntries(errs.map((e) => [e.misconception, e]));
    expect(byMisc["and_means_add"].value).toBeCloseTo(0.9, 6);
    expect(byMisc["and_means_add"].feedback).toContain("added");
    expect(byMisc["and_is_max"].value).toBeCloseTo(0.5, 6);
    expect(byMisc["or_means_add_no_overlap"].value).toBeCloseTo(0.7, 6);
  });

  it("names the mistake WITHOUT stating the corrective operation (name-only rung 1)", () => {
    const errs = buildCommonErrors(INDEPENDENT_AND_ERRORS, params, correct, {
      decimals: 4,
    });
    const byMisc = Object.fromEntries(errs.map((e) => [e.misconception, e]));
    // Keeps the naming verb ("added") but never the corrective directive.
    expect(byMisc["and_means_add"].feedback).toContain("added");
    expect(byMisc["and_means_add"].feedback).not.toMatch(/should|multiply|instead/i);
    expect(byMisc["and_is_max"].feedback).toContain("larger");
    expect(byMisc["and_is_max"].feedback).not.toMatch(/should|instead|bigger or smaller/i);
  });

  it("end-to-end: a wrong 'added' entry is graded wrong AND surfaces rung-1 coaching", () => {
    const q: NumericQuestion = {
      id: "demo-and-1",
      prompt: "Independent events with P(A)=0.5, P(B)=0.4. Find P(A and B).",
      answer: correct,
      decimals: 4,
      difficulty: "easy",
      explanation: "Independent ⇒ P(A and B) = 0.5 × 0.4 = 0.2.",
      family: "independent_and",
      commonErrors: buildCommonErrors(INDEPENDENT_AND_ERRORS, params, correct, {
        decimals: 4,
      }),
    };
    // Learner adds instead of multiplying → 0.9 (typed as an expression).
    const g = gradeFreeResponse(q, "0.5 + 0.4");
    expect(g.correct).toBe(false);
    expect(g.matchedError?.misconception).toBe("and_means_add");

    // Rung 1 of the ladder shows the detected-misconception coaching sentence,
    // and it never leaks the answer.
    const ladder = buildHintLadder({
      question: q,
      chosenValue: g.parsed ?? undefined,
      misconceptionTag: g.matchedError?.misconception,
    });
    expect(ladder[0].rung).toBe(1);
    expect(ladder[0].text).toContain("added");
    expect(ladder[0].text).not.toContain("0.2");

    // A correct re-attempt after rung 1 earns the rung-1 credit.
    expect(creditForEpisode(true, 1)).toBe(0.65);
    // The correct answer typed as a fraction still grades correct.
    expect(gradeFreeResponse(q, "1/5").correct).toBe(true);
  });
});

describe("AT_LEAST_ONE error-mode catalog", () => {
  const params = { p: 0.1, n: 3 };
  const correct = 1 - (1 - params.p) ** params.n; // 0.271

  it("matches the naive n·p and the 'never happens' complement modes", () => {
    const q = {
      answer: correct,
      decimals: 4,
      commonErrors: buildCommonErrors(AT_LEAST_ONE_ERRORS, params, correct, {
        decimals: 4,
      }),
    };
    expect(gradeFreeResponse(q, "0.3").matchedError?.misconception).toBe(
      "at_least_one_naive",
    );
    expect(gradeFreeResponse(q, "0.729").matchedError?.misconception).toBe(
      "complement_confusion",
    );
    expect(gradeFreeResponse(q, "0.271").correct).toBe(true);
  });
});

describe("BAYES_POSTERIOR error-mode catalog", () => {
  const params = { prior: 0.01, sens: 0.9, fpr: 0.05 };
  const correct = bayes.posterior(params); // ≈ 0.1538

  it("distinguishes likelihood-as-posterior and base-rate-neglect", () => {
    const m1 = matchErrorMode(BAYES_POSTERIOR_ERRORS, params, correct, 0.9, {
      decimals: 4,
    });
    expect(m1?.misconception).toBe("likelihood_as_posterior");
    // base-rate neglect: sens/(sens+fpr) = 0.9/0.95 ≈ 0.9474
    const m2 = matchErrorMode(BAYES_POSTERIOR_ERRORS, params, correct, 0.9474, {
      decimals: 4,
    });
    expect(m2?.misconception).toBe("base_rate_neglect");
    // the true posterior is not flagged as an error
    expect(
      matchErrorMode(BAYES_POSTERIOR_ERRORS, params, correct, correct, {
        decimals: 4,
      }),
    ).toBeUndefined();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import type { NumericQuestion, Question } from "@/types/content";
import {
  SELF_EXPLAIN_CHECKS,
  decomposeChecks,
  gradeSelfExplanation,
  mergeNarration,
} from "./aiSelfExplain";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/**
 * Decompose-then-verify: the VERIFIER decides correctness + which structural
 * check failed; the LLM may only narrate around that FIXED verdict and can never
 * flip it. With the flag off (the default in tests) grading is 100% deterministic
 * and returns no narration. No network / API key here.
 */

const bayes: NumericQuestion = {
  id: "se-1",
  prompt:
    "Out of 1000 people, 1% have it; the test is 80% sensitive and 9.6% false positive. How many true positives?",
  answer: 8, // 1000 × 0.01 × 0.80
  explanation: "1000 × 1% = 10 have it; 80% of 10 = 8 true positives.",
  difficulty: "medium",
};

describe("decomposeChecks", () => {
  it("marks a correct, well-reasoned explanation correct:true", () => {
    const text =
      "Out of 1000 people, 1% = 10 have it; the 80% sensitivity gives 8 true positives, and the 9.6% false-positive rate doesn't change those 8.";
    expect(decomposeChecks(bayes, text)).toEqual({ correct: true });
  });

  it("flags a wrong conclusion with failedCheck = reaches-correct-result", () => {
    const text =
      "Out of 1000 people, with 1%, 80% and 9.6% you end up with about 96 positives total.";
    expect(decomposeChecks(bayes, text)).toEqual({
      correct: false,
      failedCheck: SELF_EXPLAIN_CHECKS.reachesResult,
    });
  });

  it("flags a bare guess (no setup engaged) with failedCheck = references-the-setup", () => {
    expect(decomposeChecks(bayes, "The answer is 8.")).toEqual({
      correct: false,
      failedCheck: SELF_EXPLAIN_CHECKS.referencesSetup,
    });
  });

  it("flags empty text as incorrect", () => {
    const res = decomposeChecks(bayes, "   ");
    expect(res.correct).toBe(false);
    expect(res.failedCheck).toBe(SELF_EXPLAIN_CHECKS.referencesSetup);
  });

  it("works for a quiz item (correct choice value stated)", () => {
    const quiz: Question = {
      id: "se-q",
      prompt: "A bag holds 3 red and 2 blue. P(red)? Give the fraction.",
      choices: ["3/5", "2/5", "1/2", "3/2"],
      correctIndex: 0,
      explanation: "3 red of 5 total → 3/5.",
      difficulty: "easy",
    };
    expect(
      decomposeChecks(quiz, "There are 3 red out of 5 total, so it's 3/5.")
        .correct,
    ).toBe(true);
    expect(
      decomposeChecks(quiz, "There are 3 red out of 5 total, so it's 2/5.")
        .correct,
    ).toBe(false);
  });
});

describe("gradeSelfExplanation (flag OFF)", () => {
  // Force the flag off (the test env's .env.local may switch the AI layer on) so
  // the grader is fully deterministic with NO network.
  const off = () => vi.stubEnv("VITE_AI_LAYER", "off");

  it("returns the verifier result with NO narration", async () => {
    off();
    const grade = await gradeSelfExplanation(
      bayes,
      "Out of 1000, 1% = 10 have it; 80% of 10 = 8 true positives; 9.6% is irrelevant.",
    );
    expect(grade.correct).toBe(true);
    expect(grade.narration).toBeUndefined();
    expect(grade.failedCheck).toBeUndefined();
  });

  it("returns correct:false + failedCheck (still no narration) for a wrong one", async () => {
    off();
    const grade = await gradeSelfExplanation(bayes, "The answer is 8.");
    expect(grade.correct).toBe(false);
    expect(grade.failedCheck).toBe(SELF_EXPLAIN_CHECKS.referencesSetup);
    expect(grade.narration).toBeUndefined();
  });
});

describe("mergeNarration — the LLM can NEVER flip correctness", () => {
  it("keeps the verifier verdict verbatim and lifts only the narration", () => {
    const verdict = {
      correct: false,
      failedCheck: SELF_EXPLAIN_CHECKS.reachesResult,
    };
    // Simulate a rogue model payload trying to flip the grade.
    const payload = {
      correct: true,
      failedCheck: "totally-different",
      narration: "Nice try — here's a nudge.",
    };
    const g = mergeNarration(verdict, payload);
    expect(g.correct).toBe(false); // NOT flipped
    expect(g.failedCheck).toBe(SELF_EXPLAIN_CHECKS.reachesResult); // NOT changed
    expect(g.narration).toBe("Nice try — here's a nudge.");
  });

  it("drops empty/absent narration", () => {
    expect(mergeNarration({ correct: true }, { narration: "  " })).toEqual({
      correct: true,
    });
    expect(mergeNarration({ correct: true }, null)).toEqual({ correct: true });
  });
});

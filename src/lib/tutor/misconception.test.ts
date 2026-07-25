import { describe, expect, it } from "vitest";
import type { NumericQuestion, Question } from "@/types/content";
import {
  confrontForTag,
  MISCONCEPTION,
  resolveNumericMisconceptionKeys,
  resolveNumericTag,
  resolveQuizMisconceptionKeys,
  resolveQuizTag,
} from "./misconception";

const topic = "probability::Conditional Probability";

const quizQ: Question = {
  id: "cp-both-6",
  prompt: "P(both sixes | at least one six)?",
  choices: ["1/11", "1/6", "1/36", "2/11"],
  correctIndex: 0,
  explanation: "1/11.",
  difficulty: "easy",
  distractorRationale: ["Correct.", "Naive.", "Unconditional.", "Double-count."],
  misconceptions: ["", MISCONCEPTION.reversedConditional, "", ""],
};

describe("resolveQuizTag / keys", () => {
  it("uses the authored tag for a wrong choice", () => {
    expect(resolveQuizTag(quizQ, 1)).toBe(MISCONCEPTION.reversedConditional);
    expect(resolveQuizMisconceptionKeys(topic, quizQ, 1)).toEqual([
      `${topic}::${MISCONCEPTION.reversedConditional}`,
    ]);
  });

  it("falls back to idx:<i> when a choice is untagged", () => {
    expect(resolveQuizTag(quizQ, 2)).toBe("idx:2");
    expect(resolveQuizMisconceptionKeys(topic, quizQ, 2)).toEqual([
      `${topic}::idx:2`,
    ]);
  });

  it("returns [] for a correct answer (the fold decays flags instead)", () => {
    expect(resolveQuizMisconceptionKeys(topic, quizQ, 0)).toEqual([]);
  });
});

const numQ: NumericQuestion = {
  id: "cp-lotp-1",
  prompt: "P(defect)?",
  answer: 0.074,
  decimals: 4,
  difficulty: "medium",
  explanation: "0.074.",
  unit: "",
  commonErrors: [
    {
      value: 0.085,
      feedback: "Averaged equally.",
      misconception: MISCONCEPTION.equalWeightMixture,
    },
  ],
};

describe("resolveNumericTag / keys", () => {
  it("uses the authored tag for a matching common error", () => {
    expect(resolveNumericTag(numQ, 0.085)).toBe(MISCONCEPTION.equalWeightMixture);
    expect(resolveNumericMisconceptionKeys(topic, numQ, 0.085)).toEqual([
      `${topic}::${MISCONCEPTION.equalWeightMixture}`,
    ]);
  });

  it("falls back to err:<value> for an unrecognised wrong value", () => {
    expect(resolveNumericTag(numQ, 0.5)).toBe("err:0.5");
    expect(resolveNumericMisconceptionKeys(topic, numQ, 0.5)).toEqual([
      `${topic}::err:0.5`,
    ]);
  });

  it("returns [] for a correct value", () => {
    expect(resolveNumericMisconceptionKeys(topic, numQ, 0.074)).toEqual([]);
  });
});

describe("confrontForTag", () => {
  it("maps tags to their deterministic confront strategy", () => {
    expect(confrontForTag(MISCONCEPTION.baseRateNeglect)).toBe("nf-tree");
    expect(confrontForTag(MISCONCEPTION.reversedConditional)).toBe("nf-tree");
    expect(confrontForTag(MISCONCEPTION.gamblersFallacy)).toBe("coin-sim");
    expect(confrontForTag(MISCONCEPTION.outcomeApproach)).toBe("dice-sim");
    expect(confrontForTag(MISCONCEPTION.conjunctionFallacy)).toBe("nested-set");
    expect(confrontForTag("idx:2")).toBe("none");
    expect(confrontForTag(undefined)).toBe("none");
  });
});

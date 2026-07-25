import { describe, expect, it } from "vitest";
import type { NumericQuestion, Question } from "@/types/content";
import { buildHintLadder, type HintRung } from "./hintLadder";
import { containsFinalAnswer } from "./answerWithholding";
import { MISCONCEPTION } from "./misconception";
import type { NaturalFrequencyTree } from "./naturalFrequency";
import type { MonteCarloSpec } from "./monteCarlo";

const bayesQ: Question = {
  id: "cp-bayestest-1-80-9",
  prompt:
    "A condition affects 1% of a population. A screening test flags 80% of people who have it, but also flags 9.6% of people who don't. A random person tests positive. What is the probability they have the condition?",
  choices: ["0.0748", "0.80", "0.90", "0.01"],
  correctIndex: 0,
  explanation:
    "Bayes: P(D|+) = (0.8)(0.01)/[(0.8)(0.01)+(0.096)(0.99)] = 0.0748. Reporting 80% is base-rate neglect.",
  difficulty: "medium",
  distractorRationale: [
    "Correct — prior times sensitivity over the total probability of a positive.",
    "Base-rate neglect: you reported the sensitivity as if it were the posterior.",
    "That is the specificity, not the asked posterior.",
    "That is just the prior, ignoring the evidence.",
  ],
  misconceptions: ["", MISCONCEPTION.baseRateNeglect, "", ""],
};

function isNfTree(p: HintRung["payload"]): p is NaturalFrequencyTree {
  return !!p && "branches" in p && "finalRatioBlank" in p;
}
function isMcSpec(p: HintRung["payload"]): p is MonteCarloSpec {
  return !!p && "kind" in p && "trials" in p;
}

describe("buildHintLadder", () => {
  it("returns exactly 5 rungs in order 1..5 with the expected kinds", () => {
    const ladder = buildHintLadder({
      question: bayesQ,
      chosenIndex: 1,
      misconceptionTag: MISCONCEPTION.baseRateNeglect,
    });
    expect(ladder.map((r) => r.rung)).toEqual([1, 2, 3, 4, 5]);
    expect(ladder.map((r) => r.kind)).toEqual([
      "name-trap",
      "representation",
      "worked-sibling",
      "elicit-confront",
      "reveal",
    ]);
  });

  it("rungs 1–4 never contain the final answer; rung 5 (reveal) may", () => {
    const answer = bayesQ.choices[bayesQ.correctIndex];
    const ladder = buildHintLadder({
      question: bayesQ,
      chosenIndex: 1,
      misconceptionTag: MISCONCEPTION.baseRateNeglect,
    });
    for (const rung of ladder.slice(0, 4)) {
      expect(containsFinalAnswer(rung.text, answer)).toBe(false);
    }
    // The reveal rung IS allowed to contain the answer.
    expect(containsFinalAnswer(ladder[4].text, answer)).toBe(true);
  });

  it("a Bayesian item's rung 2 payload is a natural-frequency tree", () => {
    const ladder = buildHintLadder({
      question: bayesQ,
      chosenIndex: 1,
      misconceptionTag: MISCONCEPTION.baseRateNeglect,
    });
    const rung2 = ladder[1];
    expect(rung2.kind).toBe("representation");
    expect(isNfTree(rung2.payload)).toBe(true);
    if (isNfTree(rung2.payload)) {
      expect(rung2.payload.finalRatioBlank).toBe("8 / (8 + 95)");
    }
  });

  it("a gambler's-fallacy tag yields a coin MonteCarloSpec at rung 4", () => {
    const coinQ: Question = {
      id: "gf-1",
      prompt:
        "A fair coin has landed heads five times in a row. What is the probability the next flip is tails?",
      choices: ["1/2", "5/6", "1/6", "6/7"],
      correctIndex: 0,
      explanation: "Flips are independent, so the answer is 1/2.",
      difficulty: "easy",
      distractorRationale: [
        "Correct — independence means the streak is irrelevant.",
        "The gambler's fallacy: expecting a correction after a streak.",
        "Confusing the streak with a fixed budget of outcomes.",
        "Miscounting the sequence space.",
      ],
      misconceptions: ["", MISCONCEPTION.gamblersFallacy, "", ""],
    };
    const ladder = buildHintLadder({
      question: coinQ,
      chosenIndex: 1,
      misconceptionTag: MISCONCEPTION.gamblersFallacy,
    });
    const rung4 = ladder[3];
    expect(rung4.kind).toBe("elicit-confront");
    expect(isMcSpec(rung4.payload)).toBe(true);
    if (isMcSpec(rung4.payload)) {
      expect(rung4.payload.kind).toBe("coin");
      expect(rung4.payload.trials).toBe(10_000);
    }
    // still answer-withholding on rungs 1–4
    const answer = coinQ.choices[coinQ.correctIndex];
    for (const rung of ladder.slice(0, 4)) {
      expect(containsFinalAnswer(rung.text, answer)).toBe(false);
    }
  });

  it("sanitises a rung-1 rationale that would leak the answer", () => {
    const leaky: Question = {
      id: "leak-1",
      prompt: "P?",
      choices: ["1/3", "1/2"],
      correctIndex: 0,
      explanation: "It is 1/3.",
      difficulty: "easy",
      // The chosen distractor's rationale accidentally states the answer 1/3.
      distractorRationale: ["Correct.", "You said 1/2 but the answer is 1/3."],
    };
    const ladder = buildHintLadder({ question: leaky, chosenIndex: 1 });
    expect(containsFinalAnswer(ladder[0].text, "1/3")).toBe(false);
  });

  it("works for numeric items (rung-1 from commonErrors, answer withheld)", () => {
    const numQ: NumericQuestion = {
      id: "cp-lotp-1",
      prompt: "Overall defect probability? (Round to 4 decimals.)",
      answer: 0.074,
      decimals: 4,
      difficulty: "medium",
      explanation: "Weight each rate by its share: 0.074.",
      unit: "",
      commonErrors: [
        {
          value: 0.085,
          feedback: "You averaged the two rates equally instead of weighting by share.",
          misconception: MISCONCEPTION.equalWeightMixture,
        },
      ],
    };
    const ladder = buildHintLadder({
      question: numQ,
      chosenValue: 0.085,
      misconceptionTag: MISCONCEPTION.equalWeightMixture,
    });
    expect(ladder).toHaveLength(5);
    expect(ladder[0].text).toContain("averaged");
    for (const rung of ladder.slice(0, 4)) {
      expect(containsFinalAnswer(rung.text, numQ.answer, 1e-9)).toBe(false);
    }
  });
});

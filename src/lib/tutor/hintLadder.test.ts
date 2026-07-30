import { describe, expect, it } from "vitest";
import type { NumericQuestion, Question } from "@/types/content";
import { buildHintLadder, nameOnlyCoaching, type HintRung } from "./hintLadder";
import { containsFinalAnswer } from "./answerWithholding";
import { MISCONCEPTION } from "./misconception";
import type { MonteCarloSpec } from "./monteCarlo";
import { SIM_BY_ID } from "@/lib/simulations/catalog";

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

  it("a Bayesian item's rung 2 is a guided plan of attack (no NF-tree, answer withheld)", () => {
    const ladder = buildHintLadder({
      question: bayesQ,
      chosenIndex: 1,
      misconceptionTag: MISCONCEPTION.baseRateNeglect,
    });
    const rung2 = ladder[1];
    expect(rung2.kind).toBe("representation");
    // Rung 2 is now a plan, NOT a natural-frequency visualization (that would
    // duplicate the Bayes NF simulation at rung 4).
    expect(rung2.payload).toBeUndefined();
    // Question-driven plan naming WHAT to determine — never the method/answer.
    expect(rung2.text).toContain("?");
    expect(rung2.text.toLowerCase()).toMatch(/plan|figure out|determine|which|what/);
    const answer = bayesQ.choices[bayesQ.correctIndex];
    expect(containsFinalAnswer(rung2.text, answer)).toBe(false);
    expect(rung2.text.toLowerCase()).not.toMatch(/multiply|divide/);
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

  const indepAndQ: Question = {
    id: "ci-indep-1",
    prompt:
      "A fair coin is flipped and a fair die is rolled. What is the probability of BOTH heads and a six?",
    choices: ["0.0833", "0.6667", "0.5833", "0.25"],
    correctIndex: 0,
    explanation: "Independent: P(H)·P(6) = 0.5 · (1/6) = 0.0833.",
    difficulty: "easy",
    distractorRationale: [
      "Correct — multiply the two independent probabilities.",
      "You added the probabilities instead of multiplying them.",
      "Mixed up the operation on independent events.",
      "Used the wrong die probability.",
    ],
    family: "genIntersectionIndep",
  };

  it("rung 2 is a guided plan of attack for a non-Bayesian item (answer + method withheld)", () => {
    const ladder = buildHintLadder({
      question: indepAndQ,
      chosenIndex: 1,
      misconceptionTag: MISCONCEPTION.conjunctionFallacy,
      section: "Core Probability",
    });
    const rung2 = ladder[1];
    expect(rung2.kind).toBe("representation");
    // A question-driven plan that names WHAT to determine — never the operation
    // ("multiply"/"add") and never a rung-4-style visualization.
    expect(rung2.text).toContain("?");
    expect(rung2.text.toLowerCase()).not.toMatch(
      /multiply|\badd\b|subtract|divide|draw|venn|visualize|simulate/,
    );
    // Still answer-withholding.
    const answer = indepAndQ.choices[indepAndQ.correctIndex];
    expect(containsFinalAnswer(rung2.text, answer)).toBe(false);
  });

  it("rung 4 carries a catalog-valid simLink and answer-free pointer text", () => {
    const ladder = buildHintLadder({
      question: indepAndQ,
      chosenIndex: 1,
      misconceptionTag: MISCONCEPTION.conjunctionFallacy,
      section: "Core Probability",
    });
    const rung4 = ladder[3];
    expect(rung4.kind).toBe("elicit-confront");
    // conjunction_fallacy resolves to the two-independent-events sim.
    expect(rung4.simLink).toBeTruthy();
    expect(rung4.simLink?.href).toBe("/simulations#two-independent-events");
    expect(rung4.simLink?.href.startsWith("/simulations#")).toBe(true);
    expect(rung4.simLink?.title).toBe(SIM_BY_ID["two-independent-events"].title);
    // The pointer text names the sim and withholds the answer.
    expect(rung4.text).toContain(SIM_BY_ID["two-independent-events"].title);
    const answer = indepAndQ.choices[indepAndQ.correctIndex];
    expect(containsFinalAnswer(rung4.text, answer)).toBe(false);
  });

  it("gambler's-fallacy rung 4 keeps the coin sim AND links to coin-flips", () => {
    const coinQ: Question = {
      id: "gf-2",
      prompt:
        "A fair coin has landed heads five times in a row. What is the probability the next flip is tails?",
      choices: ["1/2", "5/6", "1/6", "6/7"],
      correctIndex: 0,
      explanation: "Flips are independent, so the answer is 1/2.",
      difficulty: "easy",
      misconceptions: ["", MISCONCEPTION.gamblersFallacy, "", ""],
    };
    const ladder = buildHintLadder({
      question: coinQ,
      chosenIndex: 1,
      misconceptionTag: MISCONCEPTION.gamblersFallacy,
      section: "Core Probability",
    });
    const rung4 = ladder[3];
    // The inline confront payload survives...
    expect(isMcSpec(rung4.payload)).toBe(true);
    if (isMcSpec(rung4.payload)) {
      expect(rung4.payload.kind).toBe("coin");
    }
    // ...and now ALSO deep-links to the coin-flips sim.
    expect(rung4.simLink?.href).toBe("/simulations#coin-flips");
    expect(rung4.simLink?.title).toBe(SIM_BY_ID["coin-flips"].title);
    const answer = coinQ.choices[coinQ.correctIndex];
    for (const rung of ladder.slice(0, 4)) {
      expect(containsFinalAnswer(rung.text, answer)).toBe(false);
    }
  });
});

describe("nameOnlyCoaching", () => {
  it("keeps the naming clause and strips a trailing corrective directive", () => {
    const out = nameOnlyCoaching(
      "It looks like you added the two probabilities — but you should multiply them.",
    );
    expect(out).toContain("added");
    expect(out).not.toMatch(/multiply|should/i);
  });

  it("strips an 'instead' / 'to get' corrective tail but keeps the mistake name", () => {
    expect(
      nameOnlyCoaching("You averaged the two rates instead of weighting by share."),
    ).toContain("averaged");
    expect(
      nameOnlyCoaching("You averaged the two rates instead of weighting by share."),
    ).not.toMatch(/instead/i);
  });

  it("never returns empty; falls back to the first sentence when the cut is too short", () => {
    expect(nameOnlyCoaching("")).toBe("");
    const s = nameOnlyCoaching(
      "Nope. You mislabeled the branch and mixed the conditionals up completely.",
    );
    expect(s.length).toBeGreaterThan(0);
  });
});

describe("buildHintLadder rung-1 (prioritised numeric name-trap cases)", () => {
  const baseNum = (over: Partial<NumericQuestion>): NumericQuestion => ({
    id: "num-x",
    prompt: "What is the probability?",
    answer: 0.2,
    decimals: 4,
    difficulty: "easy",
    explanation: "It is 0.2.",
    unit: "",
    ...over,
  });

  it("(a) an out-of-[0,1] probability entry yields the domain pointer (answer withheld)", () => {
    const q = baseNum({ commonErrors: [] });
    const ladder = buildHintLadder({
      question: q,
      chosenValue: 1.4,
      section: "Core Probability",
    });
    expect(ladder[0].kind).toBe("name-trap");
    expect(ladder[0].text).toContain("[0, 1]");
    expect(containsFinalAnswer(ladder[0].text, q.answer, 1e-9)).toBe(false);
  });

  it("(b) a close-but-not-exact unmatched entry yields the arithmetic-slip nudge", () => {
    const q = baseNum({ commonErrors: [] });
    const ladder = buildHintLadder({
      question: q,
      chosenValue: 0.19,
      section: "Core Probability",
    });
    expect(ladder[0].text.toLowerCase()).toContain("arithmetic");
    // No operational method, no answer.
    expect(ladder[0].text).not.toMatch(/multiply|add\b/i);
    expect(containsFinalAnswer(ladder[0].text, q.answer, 1e-9)).toBe(false);
  });

  it("(c) a matched misconception entry names the mistake WITHOUT the corrective op or answer", () => {
    const q = baseNum({
      commonErrors: [
        {
          value: 0.9,
          feedback:
            "It looks like you added the two probabilities here. Re-read what the wording is asking you to combine.",
          misconception: "and_means_add",
        },
      ],
    });
    const ladder = buildHintLadder({
      question: q,
      chosenValue: 0.9,
      section: "Core Probability",
    });
    expect(ladder[0].text).toContain("added");
    expect(ladder[0].text).not.toMatch(/multiply|you should|instead/i);
    expect(containsFinalAnswer(ladder[0].text, q.answer, 1e-9)).toBe(false);
  });

  it("(d) a far-off unmatched entry yields the method-free generic nudge", () => {
    const q = baseNum({
      answer: 42,
      decimals: undefined,
      commonErrors: [],
    });
    const ladder = buildHintLadder({
      question: q,
      chosenValue: 5,
      section: "Core Puzzles",
    });
    expect(ladder[0].text.toLowerCase()).toContain("not the right answer");
    expect(ladder[0].text).not.toMatch(
      /multiply|order matters|probability × value/i,
    );
    expect(containsFinalAnswer(ladder[0].text, q.answer, 1e-9)).toBe(false);
  });

  it("rungs 1–4 never leak the answer across all four rung-1 cases", () => {
    const cases: { q: NumericQuestion; v: number; section: string }[] = [
      { q: baseNum({ commonErrors: [] }), v: 1.4, section: "Core Probability" },
      { q: baseNum({ commonErrors: [] }), v: 0.19, section: "Core Probability" },
      {
        q: baseNum({
          commonErrors: [
            {
              value: 0.9,
              feedback: "It looks like you added the two probabilities here.",
              misconception: "and_means_add",
            },
          ],
        }),
        v: 0.9,
        section: "Core Probability",
      },
      {
        q: baseNum({ answer: 42, decimals: undefined, commonErrors: [] }),
        v: 5,
        section: "Core Puzzles",
      },
    ];
    for (const { q, v, section } of cases) {
      const ladder = buildHintLadder({ question: q, chosenValue: v, section });
      for (const rung of ladder.slice(0, 4)) {
        expect(containsFinalAnswer(rung.text, q.answer, 1e-9)).toBe(false);
      }
    }
  });
});

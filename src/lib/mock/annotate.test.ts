/**
 * mock/annotate.test.ts — SPAN-LEVEL good/flawed annotation suite.
 *
 * Proves the annotator marks the RIGHT parts of a candidate's own words green
 * (correct step / valid mechanism / reaches the verified answer) vs red (false
 * arithmetic / contradiction / hedge), with accurate char offsets the UI can
 * highlight, and that the deterministic checks can never be gamed.
 */
import { describe, expect, it } from "vitest";
import { annotateReasoning, annotateReasoningForAnswer } from "./annotate";

describe("annotateReasoning — GOOD (green) spans", () => {
  it("marks a correct stated computation as good", () => {
    const text = "The second difference is constant at 6. 24 + 6 = 30, so the next term is 95.";
    const spans = annotateReasoning(text, {
      verifiedAnswer: 95,
      mechanismSignals: ["second difference is constant"],
    });
    const good = spans.filter((s) => s.label === "good");
    expect(good.length).toBeGreaterThanOrEqual(2);
    // The mechanism clause and the reaches-95 clause are both green.
    expect(good.some((s) => /mechanism/i.test(s.why))).toBe(true);
    expect(good.some((s) => /correct value|arithmetic/i.test(s.why))).toBe(true);
  });

  it("marks a clause that reaches the verified answer as good", () => {
    const spans = annotateReasoning("Therefore it is 0.5.", { verifiedAnswer: 0.5 });
    expect(spans).toHaveLength(1);
    expect(spans[0].label).toBe("good");
  });
});

describe("annotateReasoning — FLAWED (red) spans", () => {
  it("marks a demonstrably false stated computation as flawed", () => {
    const text = "1 divided by 2 is 5, so the probability is 5.";
    const spans = annotateReasoning(text, { verifiedAnswer: 0.5 });
    const flawed = spans.filter((s) => s.label === "flawed");
    expect(flawed.length).toBeGreaterThanOrEqual(1);
    expect(flawed[0].why).toMatch(/incorrect step/i);
  });

  it("marks a hedge as flawed (points both ways)", () => {
    const spans = annotateReasoning("It could be either the same or different.", {});
    expect(spans.some((s) => s.label === "flawed" && /hedging/i.test(s.why))).toBe(true);
  });

  it("marks an internally-inconsistent equality as flawed", () => {
    const spans = annotateReasoning("3 * 1/2 = 3/8 here.", {});
    expect(spans.some((s) => s.label === "flawed")).toBe(true);
  });
});

describe("annotateReasoning — offsets & structure", () => {
  it("every span's excerpt matches the original text slice", () => {
    const text = "24 + 6 = 30. Then 30 + 41 = 71. So the answer is 95.";
    const spans = annotateReasoning(text, { verifiedAnswer: 95 });
    for (const s of spans) {
      expect(text.slice(s.start, s.end)).toBe(s.excerpt);
    }
  });

  it("spans are disjoint and ordered by position", () => {
    const text = "1 divided by 2 is 5. The answer is 0.5.";
    const spans = annotateReasoning(text, { verifiedAnswer: 0.5 });
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i].start).toBeGreaterThanOrEqual(spans[i - 1].end);
    }
  });

  it("garbled / empty text yields no spans", () => {
    expect(annotateReasoning("", {})).toHaveLength(0);
    expect(annotateReasoning("zxcvbnm qwrtp hjkl sdfgh", {})).toHaveLength(0);
  });
});

describe("annotateReasoningForAnswer — string answer convenience", () => {
  it("parses a string answer and highlights the reaching clause", () => {
    const spans = annotateReasoningForAnswer("So it comes out to 0.1667.", "0.1667");
    expect(spans.some((s) => s.label === "good")).toBe(true);
  });
});

describe("annotateReasoning — ROOT-CAUSE localization (premise flaws)", () => {
  const DICE_PROMPT =
    "Two fair six-sided dice are rolled. What is the expected value of the LARGER of the two (the maximum)?";
  const DICE_REASONING =
    "There is a 50% chance that one die is 3 or less. This means the larger is just the EV of the next die, which is 3.5. The other 50% chance is that the die rolls 4, 5, or 6 which averages to 5 so the answer is 0.5(3.5) + 0.5(5) = 4.25.";

  it("localizes the dice-max mistake to the FIRST sentence with a correct explanation", () => {
    const spans = annotateReasoning(DICE_REASONING, {
      prompt: DICE_PROMPT,
      verifiedAnswer: 4.4722,
      answerWasWrong: true,
    });
    const flawed = spans.filter((s) => s.label === "flawed");
    expect(flawed.length).toBeGreaterThanOrEqual(1);
    // The red span COVERS the first sentence (the imposed sequential ordering).
    const root = flawed.find((s) =>
      s.excerpt.includes("There is a 50% chance that one die is 3 or less"),
    );
    expect(root, "root cause is the first sentence").toBeTruthy();
    // The explanation names the sequential-ordering error AND the 4.25-vs-4.4722 gap.
    expect(root!.why).toMatch(/sequential|ordering|next die|both dice|jointly/i);
    expect(root!.why).toMatch(/4\.25/);
    expect(root!.why).toMatch(/4\.4722/);
  });

  it("does NOT falsely redden a CORRECT order-statistics derivation (green, no red)", () => {
    const spans = annotateReasoning(
      "By order statistics, P(max = m) = (2m − 1)/36, so E[max] = Σ m·(2m − 1)/36 = 161/36 ≈ 4.4722.",
      {
        prompt: DICE_PROMPT,
        verifiedAnswer: 4.4722,
        mechanismSignals: ["order statistic", "2m-1"],
        answerWasWrong: false,
      },
    );
    expect(spans.some((s) => s.label === "flawed")).toBe(false);
    expect(spans.some((s) => s.label === "good")).toBe(true);
  });

  it("localizes an independence-abuse premise on a without-replacement problem", () => {
    const spans = annotateReasoning(
      "The draws are independent, so P(both red) = p × p = (5/8)(5/8) = 25/64.",
      {
        prompt:
          "An urn has 5 red and 3 blue balls. Two are drawn WITHOUT replacement. What is P(both red)?",
        verifiedAnswer: 0.3571,
        answerWasWrong: true,
      },
    );
    const flawed = spans.filter((s) => s.label === "flawed");
    expect(flawed.length).toBeGreaterThanOrEqual(1);
    expect(flawed.some((s) => /independent|dependent|without replacement/i.test(s.why))).toBe(
      true,
    );
  });
});
